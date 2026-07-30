-- TEST: Coba SQL ini dulu di Supabase SQL Editor
-- Hanya 1 tabel sederhana, tanpa FK, tanpa index
CREATE TABLE test_connection (
  id SERIAL PRIMARY KEY,
  name TEXT
);
INSERT INTO test_connection (name) VALUES ('supabase works');
SELECT * FROM test_connection;
DROP TABLE test_connection;
