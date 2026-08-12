-- 011_koperasi_kegiatan_audit_fixes.sql
-- Fixes 3 issues found auditing Koperasi & Kegiatan:
--
-- 1. requestWithdrawal() (AppContext.tsx) read-then-wrote students.balance
--    from client state when a Super Admin/Developer creates an
--    already-"Disetujui" withdrawal (incl. the Koperasi/Kegiatan "Potong
--    Tabungan" path) — same lost-update race already fixed for Setoran
--    (009) and final approval (010), just missed on this creation path.
--    Client-side staleness window is worse here: students refresh only via
--    20s poll, not just a click-to-click race. Fixed by moving the whole
--    create-with-conditional-immediate-deduct into one atomic, row-locked
--    function, reusing next_transaction_number() from 009 for the 'PT'
--    number too (closes part of issue 3 below for this path).
--
-- 2. book_distributions_insert/update (006_rls_real.sql) were missing the
--    auth_can_see_class() scoping that the migration's own design comment
--    says should apply to INSERT/UPDATE on data tables (only DELETE is
--    documented as exempt) — sibling policies book_payments_insert/update
--    already have it. Without it, a Wali Kelas of class A could toggle
--    distribution/keikutsertaan status for class B students via direct API.
--
-- 3. book_payments transaction numbers ('KP' prefix) were generated from
--    bookPayments.length in client memory (AppContext.tsx addBookPayment) —
--    collision risk if two Koperasi/Kegiatan payments are submitted around
--    the same moment. Guarded next_transaction_number() itself so it's safe
--    to call directly from the client for this prefix too.

-- ========== fix 1: atomic withdrawal request ==========
CREATE OR REPLACE FUNCTION request_withdrawal_atomic(
  p_transaction_id text,
  p_student_id text,
  p_amount int,
  p_reason text,
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
  v_student students%ROWTYPE;
  v_balance_before int;
  v_balance_after int;
  v_trx_number text;
  v_status text;
  v_admin_approved boolean := false;
  v_admin_name text := NULL;
  v_super_approved boolean := false;
  v_super_name text := NULL;
BEGIN
  IF auth_rank() < 1 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Tidak memiliki akses untuk mengajukan penarikan';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal potongan harus lebih besar dari 0';
  END IF;

  -- Row lock: a second concurrent request for the SAME student blocks here
  -- until this one commits, then reads the just-committed balance.
  SELECT * INTO v_student FROM students WHERE id = p_student_id AND NOT is_deleted FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan';
  END IF;
  IF NOT auth_can_see_class(v_student.class_grade) THEN
    RAISE EXCEPTION 'Akses ditolak: siswa berada di luar level Anda';
  END IF;

  v_balance_before := v_student.balance;
  IF p_amount > v_balance_before THEN
    RAISE EXCEPTION 'Saldo tidak mencukupi. Saldo saat ini: Rp %', v_balance_before;
  END IF;

  -- Mirrors ROLE_RANK in AppContext.tsx: Wali Kelas/Admin land in Tier-2
  -- pending, Super Admin/Developer are auto-approved immediately.
  IF p_created_by_role IN ('Wali Kelas', 'Admin') THEN
    v_status := 'Menunggu Approval Super Admin';
    v_admin_approved := true;
    v_admin_name := p_created_by_name;
  ELSIF p_created_by_role IN ('Super Admin', 'Developer') THEN
    v_status := 'Disetujui';
    v_admin_approved := true;
    v_admin_name := p_created_by_name;
    v_super_approved := true;
    v_super_name := p_created_by_name;
  ELSE
    v_status := 'Menunggu Approval Admin';
  END IF;

  v_trx_number := next_transaction_number('PT', p_academic_year_label);

  INSERT INTO transactions (
    id, transaction_number, student_id, student_name, student_nis, class_grade,
    type, amount, status, reason,
    approved_by_admin, approved_by_admin_name,
    approved_by_super_admin, approved_by_super_admin_name,
    created_by_id, created_by_name, created_by_role,
    academic_year_id, created_at
  ) VALUES (
    p_transaction_id, v_trx_number, p_student_id, v_student.name, v_student.nis, v_student.class_grade,
    'Penarikan', p_amount, v_status, p_reason,
    v_admin_approved, v_admin_name,
    v_super_approved, v_super_name,
    p_created_by_id, p_created_by_name, p_created_by_role,
    p_academic_year_id, now()
  );

  v_balance_after := v_balance_before;
  IF v_status = 'Disetujui' THEN
    v_balance_after := v_balance_before - p_amount;
    UPDATE students SET balance = v_balance_after WHERE id = p_student_id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_transaction_id,
    'transactionNumber', v_trx_number,
    'status', v_status,
    'approvedByAdmin', v_admin_approved,
    'approvedByAdminName', v_admin_name,
    'approvedBySuperAdmin', v_super_approved,
    'approvedBySuperAdminName', v_super_name,
    'createdAt', now(),
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after
  );
END;
$$;

-- ========== fix 2: class-scope book_distributions insert/update ==========
DROP POLICY IF EXISTS book_distributions_insert ON book_distributions;
CREATE POLICY book_distributions_insert ON book_distributions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_rank() >= 1 AND NOT auth_is_demo()
    AND EXISTS (
      SELECT 1 FROM students s WHERE s.id = student_id AND auth_can_see_class(s.class_grade)
    )
  );

DROP POLICY IF EXISTS book_distributions_update ON book_distributions;
CREATE POLICY book_distributions_update ON book_distributions
  FOR UPDATE TO authenticated
  USING (
    auth_rank() >= 1 AND NOT auth_is_demo()
    AND EXISTS (
      SELECT 1 FROM students s WHERE s.id = student_id AND auth_can_see_class(s.class_grade)
    )
  )
  WITH CHECK (
    auth_rank() >= 1 AND NOT auth_is_demo()
    AND EXISTS (
      SELECT 1 FROM students s WHERE s.id = student_id AND auth_can_see_class(s.class_grade)
    )
  );

-- ========== fix 3: guard next_transaction_number for direct client calls ==========
-- Was only ever called from inside deposit_savings/request_withdrawal_atomic
-- (already rank-checked before reaching it). Now also called directly from
-- the client for the 'KP' (book payment) prefix, so it needs its own guard.
CREATE OR REPLACE FUNCTION next_transaction_number(p_prefix text, p_year_label text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
  v_year text;
BEGIN
  IF auth_rank() < 1 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Tidak memiliki akses untuk membuat nomor transaksi';
  END IF;
  v_seq := nextval('transaction_number_seq');
  v_year := split_part(p_year_label, '/', 1);
  IF v_year IS NULL OR v_year = '' THEN
    v_year := to_char(now(), 'YYYY');
  END IF;
  RETURN p_prefix || '/' || v_year || '/' || lpad(v_seq::text, 5, '0');
END;
$$;
