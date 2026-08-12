-- 009_deposit_savings_atomic.sql
-- Fixes two race conditions found auditing "Setoran": (1) students.balance was
-- read-then-written from client state (lost update if 2 staff deposit to the
-- same student concurrently), (2) transaction_number was derived from
-- transactions.length in client memory (collision risk under concurrency).
-- Both are fixed by moving the critical section into one atomic function:
-- a row lock on the student (SELECT ... FOR UPDATE) serializes concurrent
-- deposits per-student, and a dedicated sequence makes numbering collision-free
-- regardless of concurrency.

CREATE SEQUENCE IF NOT EXISTS transaction_number_seq;
-- Seed past current row count so numbering continues roughly where the old
-- client-side counter left off instead of visibly resetting to 00001.
SELECT setval('transaction_number_seq', GREATEST((SELECT count(*) FROM transactions), 1), false);

CREATE OR REPLACE FUNCTION next_transaction_number(p_prefix text, p_year_label text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq bigint;
  v_year text;
BEGIN
  v_seq := nextval('transaction_number_seq');
  v_year := split_part(p_year_label, '/', 1);
  IF v_year IS NULL OR v_year = '' THEN
    v_year := to_char(now(), 'YYYY');
  END IF;
  RETURN p_prefix || '/' || v_year || '/' || lpad(v_seq::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION deposit_savings(
  p_transaction_id text,
  p_student_id text,
  p_amount int,
  p_reason text,
  p_academic_year_id text,
  p_academic_year_label text,
  p_created_by_id text,
  p_created_by_name text,
  p_created_by_role text,
  p_debt_transaction_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student students%ROWTYPE;
  v_balance_before int;
  v_balance_after int;
  v_debt int;
  v_trx_number text;
  v_debt_trx_number text;
  v_final_balance int;
  v_remaining_debt int;
  v_debt_amount int;
  v_debt_reason text;
  v_debt_tx jsonb := null;
BEGIN
  -- SECURITY DEFINER bypasses RLS on the tables this function touches, so the
  -- same checks the RLS policies would have made (006_rls_real.sql) are
  -- re-asserted explicitly here, same pattern as restore_backup (007).
  IF auth_rank() < 1 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Tidak memiliki akses untuk input setoran';
  END IF;
  IF p_amount <= 0 OR p_amount > 99999000 THEN
    RAISE EXCEPTION 'Nominal setoran tidak valid';
  END IF;

  -- Row lock: a second concurrent call for the SAME student blocks here until
  -- this transaction commits, then reads the just-committed balance — this is
  -- what eliminates the lost-update race the audit found.
  SELECT * INTO v_student FROM students WHERE id = p_student_id AND NOT is_deleted FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan';
  END IF;
  IF NOT auth_can_see_class(v_student.class_grade) THEN
    RAISE EXCEPTION 'Akses ditolak: siswa berada di luar level Anda';
  END IF;

  v_balance_before := v_student.balance;
  v_balance_after := v_balance_before + p_amount;
  v_trx_number := next_transaction_number('ST', p_academic_year_label);

  INSERT INTO transactions (
    id, transaction_number, student_id, student_name, student_nis, class_grade,
    type, amount, status, reason, created_by_id, created_by_name, created_by_role,
    academic_year_id, created_at
  ) VALUES (
    p_transaction_id, v_trx_number, p_student_id, v_student.name, v_student.nis, v_student.class_grade,
    'Setoran', p_amount, 'Disetujui', p_reason, p_created_by_id, p_created_by_name, p_created_by_role,
    p_academic_year_id, now()
  );

  UPDATE students SET balance = v_balance_after WHERE id = p_student_id;

  -- Auto-deduct pending debt — mirrors the pre-existing client logic in
  -- AppContext.tsx addDeposit() exactly (full payoff vs partial payoff).
  v_debt := coalesce(v_student.pending_debt, 0);
  IF v_debt > 0 THEN
    IF v_balance_after >= v_debt THEN
      v_final_balance := v_balance_after - v_debt;
      v_debt_amount := v_debt;
      v_remaining_debt := 0;
      v_debt_reason := format('Pelunasan Otomatis Tunggakan Potongan Bulanan (Rp %s)', v_debt);
    ELSIF v_balance_after > 0 THEN
      v_remaining_debt := v_debt - v_balance_after;
      v_debt_amount := v_balance_after;
      v_final_balance := 0;
      v_debt_reason := format('Potongan Otomatis Tunggakan Sebagian (Sisa Rp %s)', v_remaining_debt);
    ELSE
      v_debt_amount := NULL;
    END IF;

    IF v_debt_amount IS NOT NULL THEN
      v_debt_trx_number := next_transaction_number('ST', p_academic_year_label);
      INSERT INTO transactions (
        id, transaction_number, student_id, student_name, student_nis, class_grade,
        type, amount, status, reason, created_by_id, created_by_name, created_by_role,
        academic_year_id, created_at
      ) VALUES (
        coalesce(p_debt_transaction_id, p_transaction_id || '-debt'), v_debt_trx_number,
        p_student_id, v_student.name, v_student.nis, v_student.class_grade,
        'Potongan Bulanan', v_debt_amount, 'Disetujui', v_debt_reason,
        p_created_by_id, p_created_by_name || ' (Sistem Otomatis)', p_created_by_role,
        p_academic_year_id, now()
      );

      IF v_remaining_debt = 0 THEN
        UPDATE students SET balance = v_final_balance, pending_debt = 0 WHERE id = p_student_id;
        v_balance_after := v_final_balance;
      ELSE
        UPDATE students SET balance = 0, pending_debt = v_remaining_debt WHERE id = p_student_id;
        v_balance_after := 0;
      END IF;

      v_debt_tx := jsonb_build_object(
        'id', coalesce(p_debt_transaction_id, p_transaction_id || '-debt'),
        'transactionNumber', v_debt_trx_number,
        'amount', v_debt_amount,
        'reason', v_debt_reason,
        'remainingDebt', v_remaining_debt
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'transactionId', p_transaction_id,
    'transactionNumber', v_trx_number,
    'balanceBefore', v_balance_before,
    'balanceAfter', v_balance_after,
    'debtTransaction', v_debt_tx
  );
END;
$$;
