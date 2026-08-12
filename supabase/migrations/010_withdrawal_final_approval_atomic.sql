-- 010_withdrawal_final_approval_atomic.sql
-- Same race condition as Setoran (fixed in 009_deposit_savings_atomic.sql):
-- final withdrawal approval read-then-wrote students.balance from client
-- state. Two Super Admins approving two withdrawals for the same student
-- near-simultaneously could lose one deduction. Fixed by moving the balance
-- deduction + status updates into one atomic, row-locked function.
-- (Only covers the non-closesAccount path — closing an account deletes the
-- student outright via executeCloseAccount, a different code path.)

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
    status = 'Disetujui',
    approved_by_admin = true,
    approved_by_super_admin = true,
    approved_by_super_admin_name = p_approved_by_name
  WHERE savings_transaction_id = p_transaction_id;

  RETURN jsonb_build_object(
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after
  );
END;
$$;
