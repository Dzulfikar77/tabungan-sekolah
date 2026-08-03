-- 003_add_transaction_edit_columns.sql
-- Menambahkan kolom untuk fitur perbaikan (edit) transaksi dengan persetujuan Super Admin.
-- has_pending_edit: flag ada permintaan perbaikan yang menunggu persetujuan.
-- edit_request: detail permintaan (JSON) — nominal/keterangan baru, pengaju, waktu.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_pending_edit BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS edit_request JSONB;
