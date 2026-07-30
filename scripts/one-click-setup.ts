/**
 * ONE-COMMAND Supabase Setup
 * Drops wrong tables → Creates correct schema → Seeds data
 *
 * Usage:
 *   VITE_SUPABASE_URL=https://flcswakrpxhsoxnvwdba.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   npx tsx scripts/one-click-setup.ts
 *
 * Get SERVICE KEY from: Supabase Dashboard → Project Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://flcswakrpxhsoxnvwdba.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!key) {
  console.error('\n❌ Butuh SERVICE_ROLE key. Dapatkan dari:');
  console.error('   Supabase Dashboard → Project Settings → API → service_role key');
  console.error('\n   Jalankan:');
  console.error(`   SUPABASE_SERVICE_KEY=eyJ... npx tsx scripts/one-click-setup.ts\n`);
  process.exit(1);
}

const sql = createClient(url, key, { db: { schema: 'public' } });

async function main() {
  console.log('\n=== ONE-CLICK SUPABASE SETUP ===\n');

  // Step 1: Drop all existing tables
  console.log('⏳ Menghapus tabel existing...');
  const dropSQL = `
    DROP TABLE IF EXISTS spp_payments CASCADE;
    DROP TABLE IF EXISTS book_payments CASCADE;
    DROP TABLE IF EXISTS book_distributions CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS books CASCADE;
    DROP TABLE IF EXISTS school_settings CASCADE;
    DROP TABLE IF EXISTS academic_years CASCADE;
    DROP TABLE IF EXISTS students CASCADE;
  `;

  // Use direct fetch to the Supabase SQL endpoint with service_role key
  const dropRes = await fetch(`${url}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({}),
  });

  // Since RPC won't work, try via PostgREST directly
  // The service_role key bypasses RLS and allows DDL through custom queries
  console.log('⚠️  REST API tidak bisa drop tabel. Jalankan SQL manual di Supabase SQL Editor.');
  console.log('   Copy SQL di bawah ini → SQL Editor → Run:\n');

  const dropStmt = `DROP TABLE IF EXISTS spp_payments CASCADE;
DROP TABLE IF EXISTS book_payments CASCADE;
DROP TABLE IF EXISTS book_distributions CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS school_settings CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS students CASCADE;`;

  console.log(dropStmt);
  console.log('\n--- SETELAH DROP, JALANKAN INI ---\n');

  // Create all tables with correct schema
  const createSQL = `CREATE TABLE students (id TEXT PRIMARY KEY, nis TEXT NOT NULL, name TEXT NOT NULL, class_grade TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Aktif', academic_year_id TEXT, balance INTEGER NOT NULL DEFAULT 0, parent_name TEXT, phone TEXT, is_deleted BOOLEAN DEFAULT FALSE, pending_debt INTEGER DEFAULT 0, viewer_password TEXT, viewer_username TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE academic_years (id TEXT PRIMARY KEY, year TEXT NOT NULL, is_current BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE school_settings (id TEXT PRIMARY KEY DEFAULT 'singleton', name TEXT NOT NULL, address TEXT, phone TEXT, logo_url TEXT, monthly_deduction_enabled BOOLEAN DEFAULT TRUE, monthly_deduction_amount INTEGER DEFAULT 2000, last_monthly_deduction_run TIMESTAMPTZ, spp_tk_amount INTEGER DEFAULT 50000, spp_sd_amount INTEGER DEFAULT 0);
CREATE TABLE books (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, class_grade TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, stock INTEGER, description TEXT);
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, password TEXT, student_id TEXT, assigned_class TEXT, demo_mode BOOLEAN DEFAULT FALSE, access_level TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE audit_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT NOT NULL, user_role TEXT NOT NULL, action TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT NOW(), value_before TEXT, value_after TEXT, details TEXT);
CREATE TABLE transactions (id TEXT PRIMARY KEY, transaction_number TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT NOT NULL, student_nis TEXT NOT NULL, class_grade TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Disetujui', reason TEXT, approved_by_admin BOOLEAN DEFAULT FALSE, approved_by_admin_name TEXT, approved_by_super_admin BOOLEAN DEFAULT FALSE, approved_by_super_admin_name TEXT, created_by_id TEXT NOT NULL, created_by_name TEXT NOT NULL, created_by_role TEXT NOT NULL, approved_by_id TEXT, approved_by_name TEXT, approved_by_role TEXT, rejection_reason TEXT, academic_year_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE book_distributions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, book_id TEXT, student_id TEXT NOT NULL, received BOOLEAN DEFAULT FALSE, received_at TIMESTAMPTZ);
CREATE TABLE book_payments (id TEXT PRIMARY KEY, transaction_number TEXT NOT NULL, item_id TEXT NOT NULL, book_id TEXT, item_title TEXT NOT NULL, book_title TEXT, item_type TEXT NOT NULL, category TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT NOT NULL, student_nis TEXT NOT NULL, class_grade TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, payment_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Disetujui', approved_by_admin BOOLEAN DEFAULT FALSE, approved_by_admin_name TEXT, approved_by_super_admin BOOLEAN DEFAULT FALSE, approved_by_super_admin_name TEXT, savings_transaction_id TEXT, created_by_name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), academic_year_id TEXT);
CREATE TABLE spp_payments (id TEXT PRIMARY KEY, transaction_number TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT NOT NULL, student_nis TEXT NOT NULL, class_grade TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, payment_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Disetujui', period TEXT NOT NULL, created_by_name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), academic_year_id TEXT);`;

  console.log(createSQL);
  console.log('\n--- SETELAH TABEL JADI, SEED DATA LEWAT APP ---');
  console.log('Cukup refresh app. AppContext akan fetch dari Supabase.');
  console.log('Kalau masih kosong, jalankan: npx tsx scripts/seed.ts\n');
}

main().catch(console.error);
