-- 002_rls_policies.sql
-- Permissive policies for development (TODO: tighten for production)

CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_books" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_book_distributions" ON book_distributions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_book_payments" ON book_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_spp_payments" ON spp_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_academic_years" ON academic_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_school_settings" ON school_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
