-- 006_rls_real.sql
-- Replace the permissive "allow_all" policies from 002_rls_policies.sql
-- (that file's own header called them a dev placeholder, "TODO: tighten for
-- production" — this is that tightening) and finally add the policies for
-- `profiles` that 004_auth_profiles.sql promised ("policies added in
-- 006_rls_real.sql") but never shipped, leaving `profiles` RLS-enabled with
-- zero policies — every SELECT on it silently returned no rows, which is why
-- the Settings "Manajemen User" list was always empty and why currentUser
-- resolution after login had nothing to read.
--
-- Design notes:
-- * Uses the auth_role()/auth_rank()/auth_access_level()/auth_student_id()/
--   auth_is_demo() helpers already defined in 004_auth_profiles.sql.
-- * A staff "rank floor" (auth_rank() >= 1, i.e. anything above Viewer) is
--   used for most staff-area tables, matching this migration's own charter:
--   keep anon/Viewer out of staff data and scope Viewer to their own child.
--   It does NOT attempt to replicate every fine-grained per-role UI gate
--   (e.g. exactly which Navbar tabs Wali Kelas can see vs Admin) — that finer
--   split stays a UI-only concern, same as before. RLS here is a coarser,
--   correct backstop, not a 1:1 mirror of the app's current role UI matrix.
-- * Class-level scoping (auth_access_level() TK/MI) is applied to SELECT/
--   INSERT/UPDATE on data tables, but not to the rarer DELETE paths (account
--   closure, rollback of a failed insert) — those are gated by role floor +
--   auth_is_demo() only, to keep the policies readable.
-- * profiles.must_change_password: a Viewer must be able to update their OWN
--   row (to clear this flag after changing their password) without being
--   able to touch their own role/access_level/demo_mode — that finer block
--   is NOT re-implemented here; it is already enforced by the
--   prevent_self_escalation trigger from 004_auth_profiles.sql, so the RLS
--   policy below can stay a simple "own row OR admin rank" check.

-- ========== helper: class-level scope check ==========
-- TK classes are 'TK A.1' / 'TK A.2' / 'TK B.1' / 'TK B.2' (src/utils/format.ts
-- TK_CLASSES); every other class_grade value is MI. Mirrors isClassInUserLevel().
CREATE OR REPLACE FUNCTION auth_can_see_class(p_class_grade text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $$
  SELECT auth_access_level() IS NULL
    OR (auth_access_level() = 'TK' AND p_class_grade LIKE 'TK%')
    OR (auth_access_level() = 'MI' AND p_class_grade NOT LIKE 'TK%')
$$;

-- ========== drop the permissive dev policies ==========
-- allow_all_users is skipped: 005_drop_legacy_users.sql already dropped the
-- `users` table (and, with it, that policy).
DROP POLICY IF EXISTS allow_all_students ON students;
DROP POLICY IF EXISTS allow_all_transactions ON transactions;
DROP POLICY IF EXISTS allow_all_books ON books;
DROP POLICY IF EXISTS allow_all_book_distributions ON book_distributions;
DROP POLICY IF EXISTS allow_all_book_payments ON book_payments;
DROP POLICY IF EXISTS allow_all_spp_payments ON spp_payments;
DROP POLICY IF EXISTS allow_all_academic_years ON academic_years;
DROP POLICY IF EXISTS allow_all_school_settings ON school_settings;
DROP POLICY IF EXISTS allow_all_audit_logs ON audit_logs;

-- ========== profiles ==========
-- (RLS already enabled by 004_auth_profiles.sql)
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_update ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR auth_rank() >= 3)
  WITH CHECK (id = auth.uid() OR auth_rank() >= 3);
-- No INSERT/DELETE policy: profiles are only ever created/deleted by the
-- admin-users edge function via its service-role key, which bypasses RLS.

-- ========== school_settings ==========
-- Read is public (anon + authenticated): the login screens show the school
-- name/logo before anyone signs in (LoginPage.tsx, ViewerLoginPage.tsx).
CREATE POLICY school_settings_select ON school_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY school_settings_insert ON school_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 3 AND NOT auth_is_demo());

CREATE POLICY school_settings_update ON school_settings
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 3 AND NOT auth_is_demo())
  WITH CHECK (auth_rank() >= 3 AND NOT auth_is_demo());

-- ========== academic_years ==========
CREATE POLICY academic_years_select ON academic_years
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY academic_years_insert ON academic_years
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 4 AND NOT auth_is_demo());

CREATE POLICY academic_years_update ON academic_years
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 4 AND NOT auth_is_demo())
  WITH CHECK (auth_rank() >= 4 AND NOT auth_is_demo());

CREATE POLICY academic_years_delete ON academic_years
  FOR DELETE TO authenticated
  USING (auth_rank() >= 4 AND NOT auth_is_demo());

-- ========== students ==========
CREATE POLICY students_select ON students
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND id = auth_student_id())
    OR (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  );

CREATE POLICY students_insert ON students
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY students_update ON students
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY students_delete ON students
  FOR DELETE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo());

-- ========== transactions ==========
CREATE POLICY transactions_select ON transactions
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND student_id = auth_student_id())
    OR (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  );

CREATE POLICY transactions_insert ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY transactions_update ON transactions
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY transactions_delete ON transactions
  FOR DELETE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo());

-- ========== books (koperasi/kegiatan catalog) ==========
-- Not scoped by class_grade: the catalog itself (name/price/stock) isn't
-- sensitive per-student data, and class_grade here can be 'Semua Kelas'.
CREATE POLICY books_select ON books
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY books_insert ON books
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo());

CREATE POLICY books_update ON books
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo())
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo());

CREATE POLICY books_delete ON books
  FOR DELETE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo());

-- ========== book_distributions ==========
-- No class_grade column of its own — scope via the linked student.
CREATE POLICY book_distributions_select ON book_distributions
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND student_id = auth_student_id())
    OR (auth_rank() >= 1 AND EXISTS (
      SELECT 1 FROM students s WHERE s.id = book_distributions.student_id AND auth_can_see_class(s.class_grade)
    ))
  );

CREATE POLICY book_distributions_insert ON book_distributions
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo());

CREATE POLICY book_distributions_update ON book_distributions
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo())
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo());

CREATE POLICY book_distributions_delete ON book_distributions
  FOR DELETE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo());

-- ========== book_payments ==========
CREATE POLICY book_payments_select ON book_payments
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND student_id = auth_student_id())
    OR (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  );

CREATE POLICY book_payments_insert ON book_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY book_payments_update ON book_payments
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY book_payments_delete ON book_payments
  FOR DELETE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo());

-- ========== spp_payments ==========
CREATE POLICY spp_payments_select ON spp_payments
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'Viewer' AND student_id = auth_student_id())
    OR (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  );

CREATE POLICY spp_payments_insert ON spp_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY spp_payments_update ON spp_payments
  FOR UPDATE TO authenticated
  USING (auth_rank() >= 1 AND auth_can_see_class(class_grade))
  WITH CHECK (auth_rank() >= 1 AND NOT auth_is_demo() AND auth_can_see_class(class_grade));

CREATE POLICY spp_payments_delete ON spp_payments
  FOR DELETE TO authenticated
  USING (auth_rank() >= 1 AND NOT auth_is_demo());

-- ========== audit_logs ==========
-- Immutable: INSERT only, no UPDATE/DELETE policy at all — the audit trail
-- cannot be altered or erased by any role, including Developer.
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (auth_rank() >= 2);

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);
