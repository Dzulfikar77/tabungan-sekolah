/**
 * Supabase Setup Script
 * Creates tables and seeds data using Supabase Management API.
 * Requires service_role key (not anon key).
 *
 * Usage:
 *   VITE_SUPABASE_URL=https://flcswakrpxhsoxnvwdba.supabase.co \
 *   SUPABASE_SERVICE_KEY=<your-service-role-key> \
 *   npx tsx scripts/setup.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://flcswakrpxhsoxnvwdba.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_KEY is required. Get it from:');
  console.error('  Supabase Dashboard → Project Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: convert camelCase TypeScript keys to snake_case DB column names
function toDbRow(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

const SQL = `
-- Create tables if not exists
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  nis TEXT NOT NULL,
  name TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif',
  academic_year_id TEXT,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  parent_name TEXT,
  phone TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  pending_debt INTEGER DEFAULT 0,
  viewer_password TEXT,
  viewer_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  monthly_deduction_enabled BOOLEAN DEFAULT TRUE,
  monthly_deduction_amount INTEGER DEFAULT 2000,
  last_monthly_deduction_run TIMESTAMPTZ,
  spp_tk_amount INTEGER DEFAULT 50000,
  spp_sd_amount INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Koperasi', 'Kegiatan')),
  category TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER,
  description TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Developer', 'Super Admin', 'Admin', 'Wali Kelas', 'Viewer')),
  password TEXT,
  student_id TEXT,
  assigned_class TEXT,
  demo_mode BOOLEAN DEFAULT FALSE,
  access_level TEXT CHECK (access_level IN ('TK', 'MI')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  value_before TEXT,
  value_after TEXT,
  details TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_nis TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Setoran', 'Penarikan', 'Potongan Bulanan')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'Disetujui',
  reason TEXT,
  approved_by_admin BOOLEAN DEFAULT FALSE,
  approved_by_admin_name TEXT,
  approved_by_super_admin BOOLEAN DEFAULT FALSE,
  approved_by_super_admin_name TEXT,
  created_by_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  approved_by_id TEXT,
  approved_by_name TEXT,
  approved_by_role TEXT,
  rejection_reason TEXT,
  academic_year_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_distributions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  book_id TEXT,
  student_id TEXT NOT NULL,
  received BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS book_payments (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL,
  item_id TEXT NOT NULL,
  book_id TEXT,
  item_title TEXT NOT NULL,
  book_title TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('Koperasi', 'Kegiatan')),
  category TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_nis TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Tunai', 'Potong Tabungan')),
  status TEXT NOT NULL DEFAULT 'Disetujui',
  approved_by_admin BOOLEAN DEFAULT FALSE,
  approved_by_admin_name TEXT,
  approved_by_super_admin BOOLEAN DEFAULT FALSE,
  approved_by_super_admin_name TEXT,
  savings_transaction_id TEXT,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  academic_year_id TEXT
);

CREATE TABLE IF NOT EXISTS spp_payments (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_nis TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Tunai', 'Potong Tabungan')),
  status TEXT NOT NULL DEFAULT 'Disetujui',
  period TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  academic_year_id TEXT
);

-- Add FK constraints
ALTER TABLE users ADD CONSTRAINT fk_users_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE book_distributions ADD CONSTRAINT fk_book_dist_item FOREIGN KEY (item_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE book_distributions ADD CONSTRAINT fk_book_dist_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_item FOREIGN KEY (item_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_savings_tx FOREIGN KEY (savings_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE spp_payments ADD CONSTRAINT fk_spp_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE spp_payments ADD CONSTRAINT fk_spp_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE spp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies for development
ALTER POLICY "allow_all_users" ON users USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_students" ON students USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_transactions" ON transactions USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_books" ON books USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_book_distributions" ON book_distributions USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_book_payments" ON book_payments USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_spp_payments" ON spp_payments USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_academic_years" ON academic_years USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_school_settings" ON school_settings USING (true) WITH CHECK (true);
ALTER POLICY "allow_all_audit_logs" ON audit_logs USING (true) WITH CHECK (true);
`;

async function runSQL(sql: string) {
  // Use supabase REST API service_role endpoint for raw SQL
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function setup() {
  console.log('=== Supabase Setup ===\n');

  // Step 1: Create tables via Management API
  console.log('Creating tables...');
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ query: SQL }),
    });
    console.log(`  Response: ${res.status} ${res.statusText}`);
    const text = await res.text();
    if (text) console.log(`  ${text.slice(0, 200)}`);
  } catch (e: any) {
    console.error(`  Failed: ${e.message}`);
    console.log('\n  ⚠️ SQL via REST tidak didukung dengan service_role key.');
    console.log('  Silakan copy paste file berikut ke Supabase SQL Editor:');
    console.log('  → supabase/migrations/001_initial_schema.sql');
    console.log('  → supabase/migrations/002_rls_policies.sql\n');
  }

  // Step 2: Try to seed data via JS Client
  console.log('Seeding data...');
  try {
    const ini = await import('../src/utils/initialData');

    const tables = [
      { name: 'school_settings', data: [toDbRow(ini.initialSchoolSettings)] },
      { name: 'academic_years', data: ini.initialAcademicYears.map(toDbRow) },
      { name: 'students', data: ini.initialStudents.map(toDbRow) },
      { name: 'books', data: ini.initialBooks.map(toDbRow) },
      { name: 'book_distributions', data: ini.initialBookDistributions.map(toDbRow) },
      { name: 'book_payments', data: ini.initialBookPayments.map(toDbRow) },
      { name: 'transactions', data: ini.initialTransactions.map(toDbRow) },
      { name: 'spp_payments', data: ini.initialSppPayments.map(toDbRow) },
      { name: 'audit_logs', data: ini.initialAuditLogs.map(toDbRow) },
      { name: 'users', data: ini.initialUsers.map(toDbRow) },
    ];

    for (const table of tables) {
      if (table.data.length === 0) {
        console.log(`  ${table.name}: no data, skipping`);
        continue;
      }
      const { error } = await supabase
        .from(table.name)
        .upsert(table.data, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        console.log(`  ${table.name}: ERROR ${error.message} (table may not exist yet)`);
      } else {
        console.log(`  ${table.name}: seeded ${table.data.length} rows`);
      }
    }
    console.log('\n✅ Seed selesai!');
  } catch (e: any) {
    console.error(`Seed failed: ${e.message}`);
  }
}

setup().catch(console.error);
