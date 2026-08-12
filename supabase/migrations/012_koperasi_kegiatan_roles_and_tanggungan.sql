-- 012_koperasi_kegiatan_roles_and_tanggungan.sql
--
-- Reworks who operates Koperasi & Kegiatan and how unpaid charges are tracked:
--
-- 1. New role 'Admin Koperasi' (rank 1, same floor as Wali Kelas) — scoped to
--    Koperasi item catalog + sales only (seragam, buku, alat tulis, dst).
-- 2. Wali Kelas (Guru Kelas) becomes the one who records Kegiatan participation
--    /payment, scoped to Kegiatan items only. Wires up the pre-existing but
--    never-used profiles.assigned_class column as their exact class (TK A.1
--    .. Kelas 6B), tighter than the existing TK/MI access_level split — a
--    Wali Kelas assigned a class only sees/touches that one class's Kegiatan
--    charges and tanggungan, not their whole TK/MI level.
-- 3. Partial-payment ("tanggungan") support: Potong Tabungan never drives a
--    balance negative — it takes whatever the student has, the shortfall
--    becomes outstanding debt attached to the student (book_payments.
--    outstanding_amount) until settled or the student graduates. A charge
--    can also be recorded fully unpaid up front ("Belum Bayar").
-- 4. process_book_payment_atomic() / settle_book_payment_atomic(): atomic,
--    row-locked RPCs so the balance-touching parts of this can't race, same
--    family as deposit_savings (009) / request_withdrawal_atomic (011).
--    approve_withdrawal_final (010) is patched so approving the
--    savings-covered portion of a partial charge doesn't overwrite the
--    book_payment's 'Lunas Sebagian' status back to 'Disetujui'.

-- ========== 1. role ==========
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['Developer', 'Super Admin', 'Admin', 'Wali Kelas', 'Admin Koperasi', 'Viewer']));

CREATE OR REPLACE FUNCTION auth_rank()
  RETURNS int
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT CASE auth_role()
    WHEN 'Developer' THEN 4
    WHEN 'Super Admin' THEN 3
    WHEN 'Admin' THEN 2
    WHEN 'Wali Kelas' THEN 1
    WHEN 'Admin Koperasi' THEN 1
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION auth_assigned_class()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT assigned_class FROM profiles WHERE id = auth.uid()
$$;

-- assigned_class is now security-relevant (scopes Kegiatan input + tunggakan
-- report) — extend the existing self-escalation guard to cover it too.
CREATE OR REPLACE FUNCTION prevent_self_escalation()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  IF NEW.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role';
    END IF;
    IF NEW.access_level IS DISTINCT FROM OLD.access_level THEN
      RAISE EXCEPTION 'Cannot change your own access level';
    END IF;
    IF NEW.assigned_class IS DISTINCT FROM OLD.assigned_class THEN
      RAISE EXCEPTION 'Cannot change your own assigned class';
    END IF;
    IF NEW.demo_mode IS DISTINCT FROM OLD.demo_mode THEN
      RAISE EXCEPTION 'Cannot change your own demo mode';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ========== 2. tanggungan columns on book_payments ==========
ALTER TABLE book_payments ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE book_payments ADD COLUMN IF NOT EXISTS outstanding_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE book_payments ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Backfill: every row that predates this migration was full-amount-or-nothing
-- (old addBookPayment either fully charged or rejected outright), so treat
-- existing rows as fully paid.
UPDATE book_payments SET amount_paid = amount, outstanding_amount = 0
  WHERE amount_paid = 0 AND outstanding_amount = 0 AND amount > 0;

ALTER TABLE book_payments DROP CONSTRAINT book_payments_payment_method_check;
ALTER TABLE book_payments ADD CONSTRAINT book_payments_payment_method_check
  CHECK (payment_method = ANY (ARRAY['Tunai', 'Potong Tabungan', 'Belum Bayar']));

ALTER TABLE book_payments DROP CONSTRAINT book_payments_status_check;
ALTER TABLE book_payments ADD CONSTRAINT book_payments_status_check
  CHECK (status = ANY (ARRAY[
    'Disetujui', 'Menunggu Persetujuan', 'Menunggu Approval Admin',
    'Menunggu Approval Super Admin', 'Ditolak', 'Belum Lunas', 'Lunas Sebagian'
  ]));

-- ========== 3. atomic payment processor ==========
CREATE OR REPLACE FUNCTION process_book_payment_atomic(
  p_book_payment_id text,
  p_item_id text,
  p_student_id text,
  p_payment_method text, -- 'Tunai' | 'Potong Tabungan' | 'Belum Bayar'
  p_academic_year_id text,
  p_academic_year_label text,
  p_created_by_id text,
  p_created_by_name text,
  p_created_by_role text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item books%ROWTYPE;
  v_student students%ROWTYPE;
  v_trx_number text;
  v_available int := 0;
  v_outstanding int := 0;
  v_bp_status text;
  v_tx_id text;
  v_tx_number text;
  v_tx_status text;
  v_admin_approved boolean := false;
  v_admin_name text := NULL;
  v_super_approved boolean := false;
  v_super_name text := NULL;
  v_balance_before int;
  v_balance_after int;
BEGIN
  IF auth_rank() < 1 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Tidak memiliki akses untuk mencatat pembayaran';
  END IF;
  IF p_payment_method NOT IN ('Tunai', 'Potong Tabungan', 'Belum Bayar') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid';
  END IF;

  SELECT * INTO v_item FROM books WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item Koperasi/Kegiatan tidak ditemukan';
  END IF;

  -- Scope per role — re-asserted here since this function is SECURITY
  -- DEFINER (bypasses the matching RLS check on book_payments_insert).
  IF auth_role() = 'Admin Koperasi' AND v_item.type <> 'Koperasi' THEN
    RAISE EXCEPTION 'Admin Koperasi hanya dapat memproses item Koperasi';
  END IF;
  IF auth_role() = 'Wali Kelas' AND v_item.type <> 'Kegiatan' THEN
    RAISE EXCEPTION 'Guru Kelas hanya dapat memproses item Kegiatan';
  END IF;

  -- Row lock: serializes concurrent charges against the SAME student (same
  -- pattern as deposit_savings / request_withdrawal_atomic).
  SELECT * INTO v_student FROM students WHERE id = p_student_id AND NOT is_deleted FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan';
  END IF;
  IF NOT auth_can_see_class(v_student.class_grade) THEN
    RAISE EXCEPTION 'Akses ditolak: siswa berada di luar level Anda';
  END IF;
  IF auth_role() = 'Wali Kelas' AND auth_assigned_class() IS NOT NULL AND auth_assigned_class() <> v_student.class_grade THEN
    RAISE EXCEPTION 'Akses ditolak: siswa berada di luar kelas yang Anda pegang';
  END IF;

  v_trx_number := next_transaction_number('KP', p_academic_year_label);
  v_balance_before := v_student.balance;
  v_balance_after := v_student.balance;

  IF p_payment_method = 'Tunai' THEN
    v_bp_status := 'Disetujui';
    v_outstanding := 0;

  ELSIF p_payment_method = 'Belum Bayar' THEN
    v_bp_status := 'Belum Lunas';
    v_outstanding := v_item.price;

  ELSE -- Potong Tabungan — never drives balance negative; shortfall sticks as tanggungan
    v_available := LEAST(v_item.price, v_student.balance);
    v_outstanding := v_item.price - v_available;

    IF v_available > 0 THEN
      v_tx_id := p_book_payment_id || '-tx';

      IF p_created_by_role IN ('Wali Kelas', 'Admin', 'Admin Koperasi') THEN
        v_tx_status := 'Menunggu Approval Super Admin';
        v_admin_approved := true;
        v_admin_name := p_created_by_name;
      ELSIF p_created_by_role IN ('Super Admin', 'Developer') THEN
        v_tx_status := 'Disetujui';
        v_admin_approved := true;
        v_admin_name := p_created_by_name;
        v_super_approved := true;
        v_super_name := p_created_by_name;
      ELSE
        v_tx_status := 'Menunggu Approval Admin';
      END IF;

      v_tx_number := next_transaction_number('PT', p_academic_year_label);

      INSERT INTO transactions (
        id, transaction_number, student_id, student_name, student_nis, class_grade,
        type, amount, status, reason,
        approved_by_admin, approved_by_admin_name,
        approved_by_super_admin, approved_by_super_admin_name,
        created_by_id, created_by_name, created_by_role,
        academic_year_id, created_at
      ) VALUES (
        v_tx_id, v_tx_number, p_student_id, v_student.name, v_student.nis, v_student.class_grade,
        'Penarikan', v_available, v_tx_status,
        format('Pembayaran %s (%s) via Potong Tabungan', v_item.type, v_item.title),
        v_admin_approved, v_admin_name, v_super_approved, v_super_name,
        p_created_by_id, p_created_by_name, p_created_by_role,
        p_academic_year_id, now()
      );

      IF v_tx_status = 'Disetujui' THEN
        v_balance_after := v_student.balance - v_available;
        UPDATE students SET balance = v_balance_after WHERE id = p_student_id;
      END IF;
    END IF;

    IF v_outstanding = 0 THEN
      v_bp_status := COALESCE(v_tx_status, 'Disetujui');
    ELSIF v_available > 0 THEN
      v_bp_status := 'Lunas Sebagian';
    ELSE
      v_bp_status := 'Belum Lunas';
    END IF;
  END IF;

  INSERT INTO book_payments (
    id, transaction_number, item_id, book_id, item_title, book_title, item_type, category,
    student_id, student_name, student_nis, class_grade,
    amount, amount_paid, outstanding_amount, payment_method, status,
    approved_by_admin, approved_by_admin_name, approved_by_super_admin, approved_by_super_admin_name,
    savings_transaction_id, created_by_name, created_at, academic_year_id
  ) VALUES (
    p_book_payment_id, v_trx_number, v_item.id, v_item.id, v_item.title, v_item.title, v_item.type, v_item.category,
    p_student_id, v_student.name, v_student.nis, v_student.class_grade,
    v_item.price, v_item.price - v_outstanding, v_outstanding, p_payment_method, v_bp_status,
    v_admin_approved, v_admin_name, v_super_approved, v_super_name,
    v_tx_id, p_created_by_name, now(), p_academic_year_id
  );

  RETURN jsonb_build_object(
    'id', p_book_payment_id,
    'transactionNumber', v_trx_number,
    'status', v_bp_status,
    'amount', v_item.price,
    'amountPaid', v_item.price - v_outstanding,
    'outstandingAmount', v_outstanding,
    'approvedByAdmin', v_admin_approved,
    'approvedByAdminName', v_admin_name,
    'approvedBySuperAdmin', v_super_approved,
    'approvedBySuperAdminName', v_super_name,
    'savingsTransactionId', v_tx_id,
    'savingsTransactionNumber', v_tx_number,
    'savingsTransactionStatus', v_tx_status,
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after,
    'createdAt', now(),
    'itemTitle', v_item.title,
    'itemType', v_item.type,
    'category', v_item.category,
    'studentName', v_student.name,
    'studentNis', v_student.nis,
    'classGrade', v_student.class_grade
  );
END;
$$;

-- ========== 4. settling outstanding tanggungan later ==========
CREATE OR REPLACE FUNCTION settle_book_payment_atomic(
  p_book_payment_id text,
  p_payment_method text, -- 'Tunai' | 'Potong Tabungan'
  p_created_by_id text,
  p_created_by_name text,
  p_created_by_role text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bp book_payments%ROWTYPE;
  v_student students%ROWTYPE;
  v_available int := 0;
  v_new_outstanding int;
  v_new_status text;
  v_tx_id text;
  v_tx_number text;
  v_tx_status text;
  v_admin_approved boolean := false;
  v_admin_name text := NULL;
  v_super_approved boolean := false;
  v_super_name text := NULL;
  v_balance_before int;
  v_balance_after int;
BEGIN
  IF auth_rank() < 1 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Tidak memiliki akses untuk melunasi tanggungan';
  END IF;
  IF p_payment_method NOT IN ('Tunai', 'Potong Tabungan') THEN
    RAISE EXCEPTION 'Metode pelunasan tidak valid';
  END IF;

  SELECT * INTO v_bp FROM book_payments WHERE id = p_book_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data tanggungan tidak ditemukan';
  END IF;
  IF v_bp.outstanding_amount <= 0 THEN
    RAISE EXCEPTION 'Tanggungan ini sudah lunas';
  END IF;
  IF NOT auth_can_see_class(v_bp.class_grade) THEN
    RAISE EXCEPTION 'Akses ditolak: siswa berada di luar level Anda';
  END IF;
  IF auth_role() = 'Admin Koperasi' AND v_bp.item_type <> 'Koperasi' THEN
    RAISE EXCEPTION 'Admin Koperasi hanya dapat memproses item Koperasi';
  END IF;
  IF auth_role() = 'Wali Kelas' THEN
    IF v_bp.item_type <> 'Kegiatan' THEN
      RAISE EXCEPTION 'Guru Kelas hanya dapat memproses item Kegiatan';
    END IF;
    IF auth_assigned_class() IS NOT NULL AND auth_assigned_class() <> v_bp.class_grade THEN
      RAISE EXCEPTION 'Akses ditolak: siswa berada di luar kelas yang Anda pegang';
    END IF;
  END IF;

  IF p_payment_method = 'Tunai' THEN
    v_new_outstanding := 0;
    v_new_status := 'Disetujui';
  ELSE
    SELECT * INTO v_student FROM students WHERE id = v_bp.student_id AND NOT is_deleted FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Siswa tidak ditemukan';
    END IF;
    v_balance_before := v_student.balance;
    v_available := LEAST(v_bp.outstanding_amount, v_student.balance);
    IF v_available <= 0 THEN
      RAISE EXCEPTION 'Saldo tabungan siswa Rp 0, tidak ada yang bisa dipotong';
    END IF;

    v_tx_id := p_book_payment_id || '-settle-' || floor(random() * 1000000)::text;
    IF p_created_by_role IN ('Wali Kelas', 'Admin', 'Admin Koperasi') THEN
      v_tx_status := 'Menunggu Approval Super Admin';
      v_admin_approved := true;
      v_admin_name := p_created_by_name;
    ELSIF p_created_by_role IN ('Super Admin', 'Developer') THEN
      v_tx_status := 'Disetujui';
      v_admin_approved := true;
      v_admin_name := p_created_by_name;
      v_super_approved := true;
      v_super_name := p_created_by_name;
    ELSE
      v_tx_status := 'Menunggu Approval Admin';
    END IF;

    v_tx_number := next_transaction_number('PT', to_char(now(), 'YYYY'));

    INSERT INTO transactions (
      id, transaction_number, student_id, student_name, student_nis, class_grade,
      type, amount, status, reason,
      approved_by_admin, approved_by_admin_name,
      approved_by_super_admin, approved_by_super_admin_name,
      created_by_id, created_by_name, created_by_role,
      academic_year_id, created_at
    ) VALUES (
      v_tx_id, v_tx_number, v_bp.student_id, v_student.name, v_student.nis, v_student.class_grade,
      'Penarikan', v_available, v_tx_status,
      format('Pelunasan tanggungan %s (%s)', v_bp.item_type, v_bp.item_title),
      v_admin_approved, v_admin_name, v_super_approved, v_super_name,
      p_created_by_id, p_created_by_name, p_created_by_role,
      v_bp.academic_year_id, now()
    );

    v_balance_after := v_student.balance;
    IF v_tx_status = 'Disetujui' THEN
      v_balance_after := v_student.balance - v_available;
      UPDATE students SET balance = v_balance_after WHERE id = v_bp.student_id;
    END IF;

    v_new_outstanding := v_bp.outstanding_amount - v_available;
    v_new_status := CASE WHEN v_new_outstanding = 0 THEN COALESCE(v_tx_status, 'Disetujui') ELSE 'Lunas Sebagian' END;
  END IF;

  UPDATE book_payments SET
    amount_paid = amount - v_new_outstanding,
    outstanding_amount = v_new_outstanding,
    status = v_new_status,
    settled_at = CASE WHEN v_new_outstanding = 0 THEN now() ELSE settled_at END
  WHERE id = p_book_payment_id;

  RETURN jsonb_build_object(
    'id', p_book_payment_id,
    'status', v_new_status,
    'amountPaid', v_bp.amount - v_new_outstanding,
    'outstandingAmount', v_new_outstanding,
    'settled', v_new_outstanding = 0,
    'savingsTransactionId', v_tx_id,
    'savingsTransactionNumber', v_tx_number,
    'savingsTransactionStatus', v_tx_status,
    'approvedByAdmin', v_admin_approved,
    'approvedByAdminName', v_admin_name,
    'approvedBySuperAdmin', v_super_approved,
    'approvedBySuperAdminName', v_super_name,
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after,
    'createdAt', now(),
    'studentId', v_bp.student_id,
    'classGrade', v_bp.class_grade
  );
END;
$$;

-- ========== 5. approve_withdrawal_final must not clobber partial status ==========
-- Approving the savings-covered slice of a partial charge must not flip a
-- 'Lunas Sebagian' book_payment back to 'Disetujui' — only the un-covered
-- outstanding_amount decides that.
CREATE OR REPLACE FUNCTION approve_withdrawal_final(
  p_transaction_id text,
  p_approved_by_id text,
  p_approved_by_name text,
  p_approved_by_role text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
  v_student students%ROWTYPE;
  v_balance_before int;
  v_balance_after int;
BEGIN
  IF auth_rank() < 3 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Hanya Super Admin/Developer yang dapat menyetujui final';
  END IF;

  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;
  IF v_tx.status NOT IN ('Menunggu Approval Admin', 'Menunggu Approval Super Admin') THEN
    RAISE EXCEPTION 'Transaksi sudah diproses (status: %)', v_tx.status;
  END IF;

  SELECT * INTO v_student FROM students WHERE id = v_tx.student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan';
  END IF;
  IF NOT auth_can_see_class(v_student.class_grade) THEN
    RAISE EXCEPTION 'Akses ditolak: siswa berada di luar level Anda';
  END IF;

  v_balance_before := v_student.balance;
  IF v_balance_before < v_tx.amount THEN
    RAISE EXCEPTION 'Saldo siswa saat ini (Rp %) tidak mencukupi nominal (Rp %)', v_balance_before, v_tx.amount;
  END IF;
  v_balance_after := v_balance_before - v_tx.amount;

  UPDATE students SET balance = v_balance_after WHERE id = v_tx.student_id;

  UPDATE transactions SET
    status = 'Disetujui',
    approved_by_admin = true,
    approved_by_super_admin = true,
    approved_by_super_admin_name = p_approved_by_name,
    approved_by_id = p_approved_by_id,
    approved_by_name = p_approved_by_name,
    approved_by_role = p_approved_by_role
  WHERE id = p_transaction_id;

  UPDATE book_payments SET
    approved_by_admin = true,
    approved_by_super_admin = true,
    approved_by_super_admin_name = p_approved_by_name,
    status = CASE WHEN outstanding_amount > 0 THEN 'Lunas Sebagian' ELSE 'Disetujui' END
  WHERE savings_transaction_id = p_transaction_id;

  RETURN jsonb_build_object(
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after
  );
END;
$$;

-- ========== 6. RLS: scope by role + item_type + exact assigned class ==========
DROP POLICY IF EXISTS books_insert ON books;
CREATE POLICY books_insert ON books
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT auth_is_demo() AND (
      auth_rank() >= 2
      OR (auth_role() = 'Admin Koperasi' AND type = 'Koperasi')
    )
  );

DROP POLICY IF EXISTS books_update ON books;
CREATE POLICY books_update ON books
  FOR UPDATE TO authenticated
  USING (
    NOT auth_is_demo() AND (
      auth_rank() >= 2
      OR (auth_role() = 'Admin Koperasi' AND type = 'Koperasi')
    )
  )
  WITH CHECK (
    NOT auth_is_demo() AND (
      auth_rank() >= 2
      OR (auth_role() = 'Admin Koperasi' AND type = 'Koperasi')
    )
  );

DROP POLICY IF EXISTS books_delete ON books;
CREATE POLICY books_delete ON books
  FOR DELETE TO authenticated
  USING (
    NOT auth_is_demo() AND (
      auth_rank() >= 2
      OR (auth_role() = 'Admin Koperasi' AND type = 'Koperasi')
    )
  );

DROP POLICY IF EXISTS book_payments_select ON book_payments;
CREATE POLICY book_payments_select ON book_payments
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND student_id = auth_student_id())
    OR (auth_rank() >= 2 AND auth_can_see_class(class_grade))
    OR (auth_role() = 'Admin Koperasi' AND auth_can_see_class(class_grade))
    OR (
      auth_role() = 'Wali Kelas' AND auth_can_see_class(class_grade)
      AND (auth_assigned_class() IS NULL OR auth_assigned_class() = class_grade)
    )
  );

DROP POLICY IF EXISTS book_payments_insert ON book_payments;
CREATE POLICY book_payments_insert ON book_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT auth_is_demo() AND auth_can_see_class(class_grade) AND (
      auth_rank() >= 2
      OR (auth_role() = 'Admin Koperasi' AND item_type = 'Koperasi')
      OR (
        auth_role() = 'Wali Kelas' AND item_type = 'Kegiatan'
        AND (auth_assigned_class() IS NULL OR auth_assigned_class() = class_grade)
      )
    )
  );

DROP POLICY IF EXISTS book_payments_update ON book_payments;
CREATE POLICY book_payments_update ON book_payments
  FOR UPDATE TO authenticated
  USING (
    auth_rank() >= 1 AND auth_can_see_class(class_grade)
  )
  WITH CHECK (
    NOT auth_is_demo() AND auth_can_see_class(class_grade) AND (
      auth_rank() >= 2
      OR (auth_role() = 'Admin Koperasi' AND item_type = 'Koperasi')
      OR (
        auth_role() = 'Wali Kelas' AND item_type = 'Kegiatan'
        AND (auth_assigned_class() IS NULL OR auth_assigned_class() = class_grade)
      )
    )
  );

DROP POLICY IF EXISTS book_distributions_select ON book_distributions;
CREATE POLICY book_distributions_select ON book_distributions
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND student_id = auth_student_id())
    OR EXISTS (
      SELECT 1 FROM students s WHERE s.id = book_distributions.student_id AND auth_can_see_class(s.class_grade)
      AND (
        auth_rank() >= 2
        OR auth_role() = 'Admin Koperasi'
        OR (auth_role() = 'Wali Kelas' AND (auth_assigned_class() IS NULL OR auth_assigned_class() = s.class_grade))
      )
    )
  );

DROP POLICY IF EXISTS book_distributions_insert ON book_distributions;
CREATE POLICY book_distributions_insert ON book_distributions
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT auth_is_demo() AND EXISTS (
      SELECT 1 FROM students s WHERE s.id = student_id AND auth_can_see_class(s.class_grade)
      AND (
        auth_rank() >= 2
        OR auth_role() = 'Admin Koperasi'
        OR (auth_role() = 'Wali Kelas' AND (auth_assigned_class() IS NULL OR auth_assigned_class() = s.class_grade))
      )
    )
  );

DROP POLICY IF EXISTS book_distributions_update ON book_distributions;
CREATE POLICY book_distributions_update ON book_distributions
  FOR UPDATE TO authenticated
  USING (
    auth_rank() >= 1 AND NOT auth_is_demo()
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND auth_can_see_class(s.class_grade))
  )
  WITH CHECK (
    NOT auth_is_demo() AND EXISTS (
      SELECT 1 FROM students s WHERE s.id = student_id AND auth_can_see_class(s.class_grade)
      AND (
        auth_rank() >= 2
        OR auth_role() = 'Admin Koperasi'
        OR (auth_role() = 'Wali Kelas' AND (auth_assigned_class() IS NULL OR auth_assigned_class() = s.class_grade))
      )
    )
  );
