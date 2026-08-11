-- 005_drop_legacy_users.sql
-- Drop custom users table and unused viewer columns from students

-- 1. Drop the custom users table (replaced by profiles + auth.users)
DROP TABLE IF EXISTS users CASCADE;

-- 2. Drop viewer_password and viewer_username from students
-- (zero reads/writes across entire src/, replaced by Viewer record in profiles)
ALTER TABLE students DROP COLUMN IF EXISTS viewer_password;
ALTER TABLE students DROP COLUMN IF EXISTS viewer_username;
