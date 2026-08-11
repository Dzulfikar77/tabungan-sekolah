-- 007_restore_rpc.sql
-- Two problems with the old restore path (src/context/AppContext.tsx
-- restoreBackupData): it ran one upsertRow() per row via Promise.all — a
-- partial failure left the database half-restored while telling the user
-- "data lokal tidak diubah" (true for the client, false for the DB). And its
-- safety-net snapshot lived in localStorage: per-machine, gone if the
-- browser's storage is cleared, useless for an actual rollback.
--
-- Fix: one plpgsql function per operation. A Postgres function body is
-- implicitly one transaction — any RAISE EXCEPTION (a NOT NULL violation, a
-- bad FK, an explicit permission check) rolls back everything the function
-- already did. Restore either fully applies or leaves the database
-- untouched, matching what the error message has always claimed.
--
-- The client must snake_case each row (src/lib/db.ts toDbRow — already used
-- for every normal upsert) before passing it in: jsonb_populate_recordset
-- matches JSON object keys to column names directly, no camelCase mapping.

-- ========== snapshots (server-side, replaces localStorage) ==========
CREATE TABLE IF NOT EXISTS snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  payload JSONB NOT NULL
);
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_select ON snapshots
  FOR SELECT TO authenticated
  USING (auth_rank() >= 4);

CREATE POLICY snapshots_insert ON snapshots
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 4 AND NOT auth_is_demo());
-- No UPDATE/DELETE policy and no pruning function: 10 JSON blobs of a school's
-- data is not worth the complexity of an auto-prune job. Rely on periodic
-- manual cleanup (or a storage-lifecycle rule) if this table grows large.

-- ========== restore_backup(payload) ==========
-- payload shape: { school_settings: {...}, academic_years: [...], students: [...],
-- transactions: [...], books: [...], book_distributions: [...], book_payments: [...],
-- spp_payments: [...], audit_logs: [...] } — every row already snake_cased.
CREATE OR REPLACE FUNCTION restore_backup(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth_rank() < 4 OR auth_is_demo() THEN
    RAISE EXCEPTION 'Only a non-demo Developer can restore a backup';
  END IF;

  -- Children first (explicit order, not relying on ON DELETE CASCADE to fire
  -- in a particular sequence).
  DELETE FROM book_payments;
  DELETE FROM book_distributions;
  DELETE FROM spp_payments;
  DELETE FROM transactions;
  DELETE FROM students;
  DELETE FROM books;
  DELETE FROM academic_years;

  IF payload->'school_settings' IS NOT NULL THEN
    INSERT INTO school_settings SELECT * FROM jsonb_populate_record(null::school_settings, payload->'school_settings')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      phone = EXCLUDED.phone,
      logo_url = EXCLUDED.logo_url,
      monthly_deduction_enabled = EXCLUDED.monthly_deduction_enabled,
      monthly_deduction_amount = EXCLUDED.monthly_deduction_amount,
      last_monthly_deduction_run = EXCLUDED.last_monthly_deduction_run,
      spp_tk_amount = EXCLUDED.spp_tk_amount,
      spp_sd_amount = EXCLUDED.spp_sd_amount;
  END IF;

  INSERT INTO academic_years SELECT * FROM jsonb_populate_recordset(null::academic_years, coalesce(payload->'academic_years', '[]'::jsonb));
  INSERT INTO books SELECT * FROM jsonb_populate_recordset(null::books, coalesce(payload->'books', '[]'::jsonb));
  INSERT INTO students SELECT * FROM jsonb_populate_recordset(null::students, coalesce(payload->'students', '[]'::jsonb));
  INSERT INTO transactions SELECT * FROM jsonb_populate_recordset(null::transactions, coalesce(payload->'transactions', '[]'::jsonb));
  INSERT INTO book_distributions SELECT * FROM jsonb_populate_recordset(null::book_distributions, coalesce(payload->'book_distributions', '[]'::jsonb));
  INSERT INTO book_payments SELECT * FROM jsonb_populate_recordset(null::book_payments, coalesce(payload->'book_payments', '[]'::jsonb));
  INSERT INTO spp_payments SELECT * FROM jsonb_populate_recordset(null::spp_payments, coalesce(payload->'spp_payments', '[]'::jsonb));

  -- audit_logs is append-only by design (see 006_rls_real.sql) — upsert by id,
  -- never delete, so restoring an old backup can't erase what actually happened.
  INSERT INTO audit_logs SELECT * FROM jsonb_populate_recordset(null::audit_logs, coalesce(payload->'audit_logs', '[]'::jsonb))
  ON CONFLICT (id) DO NOTHING;
END;
$$;
