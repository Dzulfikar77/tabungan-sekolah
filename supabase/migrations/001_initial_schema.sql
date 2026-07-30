-- 001_initial_schema.sql
-- 10 tables for Tabungan Digital Sekolah
-- Parent tables first, FK constraints added via ALTER TABLE at the end

-- 1. students (no FK dependencies)
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  nis TEXT NOT NULL,
  name TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Lulus', 'Pindah', 'Keluar')),
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

-- 2. academic_years (no FK dependencies)
CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  year TEXT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. school_settings (no FK dependencies)
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

-- 4. books / items (no FK dependencies)
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

-- 5. users (FK to students added via ALTER TABLE)
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

-- 6. audit_logs (no FK dependencies)
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

-- 7. transactions (FK to students, academic_years)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_nis TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Setoran', 'Penarikan', 'Potongan Bulanan')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'Disetujui' CHECK (status IN ('Disetujui', 'Menunggu Persetujuan', 'Menunggu Approval Admin', 'Menunggu Approval Super Admin', 'Ditolak')),
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

-- 8. book_distributions (FK to books, students)
CREATE TABLE IF NOT EXISTS book_distributions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  book_id TEXT,
  student_id TEXT NOT NULL,
  received BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ
);

-- 9. book_payments (FK to books, students, transactions, academic_years)
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
  status TEXT NOT NULL DEFAULT 'Disetujui' CHECK (status IN ('Disetujui', 'Menunggu Persetujuan', 'Menunggu Approval Admin', 'Menunggu Approval Super Admin', 'Ditolak')),
  approved_by_admin BOOLEAN DEFAULT FALSE,
  approved_by_admin_name TEXT,
  approved_by_super_admin BOOLEAN DEFAULT FALSE,
  approved_by_super_admin_name TEXT,
  savings_transaction_id TEXT,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  academic_year_id TEXT
);

-- 10. spp_payments (FK to students, academic_years)
CREATE TABLE IF NOT EXISTS spp_payments (
  id TEXT PRIMARY KEY,
  transaction_number TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_nis TEXT NOT NULL,
  class_grade TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Tunai', 'Potong Tabungan')),
  status TEXT NOT NULL DEFAULT 'Disetujui' CHECK (status IN ('Disetujui', 'Menunggu Persetujuan', 'Menunggu Approval Admin', 'Menunggu Approval Super Admin', 'Ditolak')),
  period TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  academic_year_id TEXT
);

-- ========== ADD INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_students_nis ON students(nis) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_grade) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_transactions_student ON transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_academic_year ON transactions(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_books_class ON books(class_grade);
CREATE INDEX IF NOT EXISTS idx_book_dist_student ON book_distributions(student_id);
CREATE INDEX IF NOT EXISTS idx_book_dist_item ON book_distributions(item_id);
CREATE INDEX IF NOT EXISTS idx_book_payments_student ON book_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_book_payments_status ON book_payments(status);
CREATE INDEX IF NOT EXISTS idx_book_payments_academic_year ON book_payments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_spp_student ON spp_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_spp_status ON spp_payments(status);
CREATE INDEX IF NOT EXISTS idx_spp_period ON spp_payments(period);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ========== ADD FOREIGN KEYS ==========
ALTER TABLE users ADD CONSTRAINT fk_users_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

ALTER TABLE transactions ADD CONSTRAINT fk_transactions_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_academic_year
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;

ALTER TABLE book_distributions ADD CONSTRAINT fk_book_dist_item
  FOREIGN KEY (item_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE book_distributions ADD CONSTRAINT fk_book_dist_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_item
  FOREIGN KEY (item_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_savings_tx
  FOREIGN KEY (savings_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE book_payments ADD CONSTRAINT fk_book_pay_academic_year
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;

ALTER TABLE spp_payments ADD CONSTRAINT fk_spp_student
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE spp_payments ADD CONSTRAINT fk_spp_academic_year
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;

-- ========== ENABLE RLS ==========
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
