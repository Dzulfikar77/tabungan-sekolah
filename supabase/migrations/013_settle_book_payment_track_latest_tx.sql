-- 013_settle_book_payment_track_latest_tx.sql
-- settle_book_payment_atomic (012) created a new Penarikan transaction per
-- settlement attempt but never wrote its id back onto
-- book_payments.savings_transaction_id — so approveWithdrawal/rejectWithdrawal
-- (which look up the linked book_payment by that column) couldn't find/sync
-- a SECOND-or-later settlement attempt, only the original charge's tx. Now
-- keeps the column pointed at the most recent pending settlement's tx.
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
    savings_transaction_id = COALESCE(v_tx_id, savings_transaction_id),
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
