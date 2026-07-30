# supabase-integration - Work Plan

## TL;DR (For humans)

**What you'll get:** Aplikasi Tabungan Digital Sekolah yang sepenuhnya terintegrasi dengan Supabase — database cloud, autentikasi aman, keamanan data per-role, semua logic bisnis berjalan di server, DAN portal viewer untuk orang tua/murid.

**Why this approach:** Migrasi full sekaligus karena semua 10 tabel sudah terdefinisi di `types.ts`, logic bisnis sudah lengkap di `AppContext.tsx`, dan tidak ada backend yang perlu di-coordinasi. Fitur viewer dibangun SETELAH migrasi supaya tidak perlu refactor dua kali.

**What it will NOT do:** Tidak mengubah UI/组件 admin (hanya data layer), tidak menambah fitur baru SELAIN viewer, tidak mengubah format ID yang sudah ada (tetap `st-xxx`, `tr-xxx`), tidak setup Realtime subscriptions.

**Effort:** XL
**Risk:** Medium - Scope besar (1228 baris logic + viewer feature), tapi pattern sudah jelas dan semua type sudah terdefinisi.

**Decisions to sanity-check:**
1. Auth pakai Supabase Auth (email+password) — perlu register semua user existing
2. Nomor transaksi pakai DB function + counter table (atomic sequence)
3. Complex operations (monthly deduction, approval) pakai Edge Functions atau DB functions
4. Deploy ke Netlify dengan environment variables
5. Viewer auth pakai custom auth (bukan Supabase Auth) — terlalu banyak user parent

Your next move: approve, atau run a high-accuracy review. Full execution detail follows below.

---

> TL;DR (machine): XL effort, Medium risk — migrasi full 10 tabel dari localStorage ke Supabase dengan auth, RLS, dan 20+ fungsi bisnis. ~28 implementation tasks + 4 final verification.

## Scope

### Must have
- Supabase project setup + client initialization (`src/lib/supabase.ts`)
- 10 database tables dengan schema lengkap sesuai `src/types.ts`
- Row Level Security (RLS) untuk 5 role × 10 tabel
- Supabase Auth mengganti mock hardcoded `initialUsers`
- Refactor AppContext: semua 20+ fungsi dari localStorage → Supabase client calls
- Seed data migration (users, students, settings, dll)
- DB function untuk generate nomor transaksi (atomic sequence)
- Backup/restore adapted ke Supabase
- Netlify deployment configuration
- `.env.example` updated dengan variable Supabase
- **Viewer Feature**: Login parent, change password, view tunggakan buku/SPP, SPP history

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Tidak mengubah UI components untuk admin (hanya data layer di AppContext)
- Tidak mengubah `pdfGenerator.ts` atau `excelHandler.ts` (hanya baca state)
- Tidak menambah fitur baru SELAIN viewer
- Tidak mengubah format ID yang sudah ada (tetap `st-xxx`, `tr-xxx`)
- Tidak setup Realtime subscriptions
- Tidak mengubah `vite.config.ts` kecuali untuk proxy/alias
- Tidak menghapus fallback ke localStorage (untuk backward compatibility)
- Tidak gunakan Supabase Auth untuk viewer (terlalu banyak user)

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + Vitest
- Evidence: `.omo/evidence/supabase-integration/task-N-supabase-integration.{ext}`

## Execution strategy

### Parallel execution waves

**Wave 1: Foundation (3 tasks)**
- Supabase client + env setup
- Database schema (10 tables SQL migration)
- Seed data script

**Wave 2: Security + Auth (3 tasks)**
- RLS policies (5 roles × 10 tables)
- Supabase Auth migration
- DB functions (transaction numbers, etc.)

**Wave 3: Core Logic Refactor (5 tasks)**
- Students CRUD → Supabase
- Transactions (deposit/withdrawal/approval) → Supabase
- Books/Items CRUD → Supabase
- SPP Payments → Supabase
- Monthly deduction → Supabase

**Wave 4: Supporting Logic (3 tasks)**
- Academic Years + School Settings → Supabase
- Audit Logs → Supabase
- Backup/Restore → Supabase

**Wave 5: Integration + Deploy (3 tasks)**
- Update AppContext to use all Supabase functions
- Netlify deployment config
- Migration script for existing localStorage data

**Wave 6: Viewer Foundation (2 tasks)**
- Viewer database schema update (add fields to students)
- Viewer auth flow (login, change password)

**Wave 7: Viewer Features (4 tasks)**
- Viewer login page
- Viewer dashboard enhancement (tunggakan, SPP)
- Viewer RLS policies
- Seed data for viewer passwords

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
|------|-----------|--------|---------------------|
| 1. Supabase client setup | - | 2,3,4,5,6,7,8,9,10,11,12,13 | - |
| 2. DB schema | 1 | 4,5,6,7,8,9,10,11,12,13 | 3 |
| 3. Seed data script | 1 | 13 | 2 |
| 4. RLS policies | 2 | 5,6,7,8,9,10,11,12 | - |
| 5. Auth migration | 1,2,4 | 6,7,8,9,10,11,12,13 | - |
| 6. Students refactor | 2,4,5 | 13 | 7,8,9,10,11,12 |
| 7. Transactions refactor | 2,4,5 | 13 | 6,8,9,10,11,12 |
| 8. Books refactor | 2,4,5 | 13 | 6,7,9,10,11,12 |
| 9. SPP refactor | 2,4,5 | 13 | 6,7,8,10,11,12 |
| 10. Monthly deduction | 2,4,5 | 13 | 6,7,8,9,11,12 |
| 11. Academic years + settings | 2,4,5 | 13 | 6,7,8,9,10,12 |
| 12. Audit logs | 2,4,5 | 13 | 6,7,8,9,10,11 |
| 13. Backup/Restore | 6,7,8,9,10,11,12 | 14 | - |
| 14. Netlify deploy config | 1,13 | - | - |

## Todos

- [ ] 1. Setup Supabase Client + Environment
  What to do / Must NOT do:
  - Install `@supabase/supabase-js`
  - Create `src/lib/supabase.ts` dengan `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
  - Update `.env.example` dengan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
  - Update `src/types.ts` tambah `Database` type jika perlu
  - JANGAN hapus dependency yang ada
  - JANGAN ubah logic bisnis yang ada
  Parallelization: Wave 1 | Blocked by: - | Blocks: 2,3,4,5,6,7,8,9,10,11,12,13
  References:
  - `package.json:13-27` (dependencies section)
  - `.env.example:1-9` (current env vars)
  - `src/types.ts:1-196` (all type definitions)
  - `src/context/AppContext.tsx:88-90` (LOCAL_STORAGE_KEY, AppContext)
  Acceptance criteria (agent-executable):
  - `npm install` succeeds
  - `npx tsc --noEmit` passes (no type errors from new imports)
  - `src/lib/supabase.ts` exports a valid Supabase client
  QA scenarios:
  - Happy: Import supabase client in App.tsx, verify it initializes without error
  - Failure: Missing env vars → clear error message in console
  Evidence: `.omo/evidence/supabase-integration/task-1-supabase-integration.md`
  Commit: Y | feat(supabase): add Supabase client initialization and env config

- [ ] 2. Database Schema - 10 Tables SQL Migration
  What to do / Must NOT do:
  - Create `supabase/migrations/001_initial_schema.sql` dengan 10 tabel:
    1. `users` - id(uuid pk), username(unique), name, role, password_hash, student_id, assigned_class, demo_mode, access_level, created_at
    2. `students` - id(text pk), nis(unique per status), name, class_grade, status, academic_year_id, balance, parent_name, phone, is_deleted, pending_debt, created_at
    3. `transactions` - id(text pk), transaction_number, student_id(FK), student_name, student_nis, class_grade, type, amount, status, reason, approved_*, created_*, rejection_reason, academic_year_id(FK), created_at
    4. `books` (items) - id(text pk), title, type, category, class_grade, price, stock, description
    5. `book_distributions` - id(text pk), item_id(FK), student_id(FK), received, received_at
    6. `book_payments` - id(text pk), transaction_number, item_id(FK), item_title, item_type, category, student_id(FK), student_name, student_nis, class_grade, amount, payment_method, status, approved_*, savings_transaction_id(FK), created_by_name, created_at, academic_year_id(FK)
    7. `spp_payments` - id(text pk), transaction_number, student_id(FK), student_name, student_nis, class_grade, amount, payment_method, status, period, created_by_name, created_at, academic_year_id(FK)
    8. `academic_years` - id(text pk), year, is_current, created_at
    9. `audit_logs` - id(text pk), user_id(FK), user_name, user_role, action, timestamp, value_before, value_after, details
    10. `school_settings` - id(text pk default 'singleton'), name, address, phone, logo_url, monthly_deduction_enabled, monthly_deduction_amount, last_monthly_deduction_run, spp_tk_amount, spp_sd_amount
  - Add indexes on foreign keys, status columns, and frequently queried fields
  - Add unique constraints: `users.username`, `students.nis + is_deleted` (partial)
  - Add check constraints: `students.balance >= 0`, `transactions.amount > 0`
  - Use `text` type for IDs (bukan UUID) untuk backward compatibility dengan format `st-xxx`
  - JANGAN ubah type definitions yang sudah ada
  - JANGAN drop tabel yang belum ada
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 4,5,6,7,8,9,10,11,12
  References:
  - `src/types.ts:6-18` (UserRole, User interface)
  - `src/types.ts:37-50` (Student interface)
  - `src/types.ts:60-84` (Transaction interface)
  - `src/types.ts:88-97` (Book/KoperasiKegiatanItem interface)
  - `src/types.ts:103-111` (BookDistribution interface)
  - `src/types.ts:115-140` (BookPayment interface)
  - `src/types.ts:142-156` (SppPayment interface)
  - `src/types.ts:158-163` (AcademicYear interface)
  - `src/types.ts:165-175` (AuditLogItem interface)
  - `src/types.ts:177-187` (SchoolSettings interface)
  Acceptance criteria (agent-executable):
  - SQL file exists at `supabase/migrations/001_initial_schema.sql`
  - `psql -f supabase/migrations/001_initial_schema.sql` executes without error (atau bisa validate syntax)
  - Semua 10 tabel terbuat dengan kolom yang benar
  - Foreign keys, indexes, constraints terbuat
  QA scenarios:
  - Happy: Run migration on fresh Supabase project, verify all tables exist with `\dt` command
  - Failure: Duplicate column name → SQL syntax error, fix and re-run
  Evidence: `.omo/evidence/supabase-integration/task-2-supabase-integration.md`
  Commit: Y | feat(db): create initial schema migration with 10 tables

- [ ] 3. Seed Data Script
  What to do / Must NOT do:
  - Create `supabase/seed.sql` atau `scripts/seed.ts` untuk insert data awal
  - Seed data dari `src/utils/initialData.ts`:
    - `initialUsers` (10 users) - hash passwords dengan bcrypt
    - `initialSchoolSettings` (1 record)
    - `initialAcademicYears` (2 records)
    - `initialStudents` (98 records) - jangan insert `initialStudents` langsung, gunakan generate function
    - `initialBooks`, `initialBookDistributions`, `initialBookPayments`, `initialTransactions`, `initialSppPayments`, `initialAuditLogs`
  - Gunakan `ON CONFLICT DO NOTHING` untuk idempotency
  - JANGAN ubah data original di `initialData.ts`
  - JANGAN hardcode passwords di SQL (hash dulu)
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 13
  References:
  - `src/utils/initialData.ts:1-283` (all initial data)
  - `src/utils/initialData.ts:8-17` (initialSchoolSettings)
  - `src/utils/initialData.ts:19-22` (initialAcademicYears)
  - `src/utils/initialData.ts:41-50` (initialUsers with passwords)
  - `src/utils/initialData.ts:73-96` (initialStudents generator)
  - `src/utils/initialData.ts:98-140` (initialBooks)
  - `src/utils/initialData.ts:141-164` (initialBookDistributions)
  - `src/utils/initialData.ts:165-196` (initialBookPayments)
  - `src/utils/initialData.ts:197-240` (initialTransactions)
  - `src/utils/initialData.ts:241-264` (initialSppPayments)
  - `src/utils/initialData.ts:265-283` (initialAuditLogs)
  Acceptance criteria (agent-executable):
  - Seed script exists and can be run
  - All 10 tables have data after seeding
  - Passwords are hashed (not plaintext)
  - `ON CONFLICT` prevents duplicate inserts
  QA scenarios:
  - Happy: Run seed script, verify row counts match expected (users=10, students=98, etc.)
  - Failure: Missing column → insert error, add column to seed script
  Evidence: `.omo/evidence/supabase-integration/task-3-supabase-integration.md`
  Commit: Y | feat(seed): create seed data script for all 10 tables

- [ ] 4. Row Level Security Policies
  What to do / Must NOT do:
  - Enable RLS on all 10 tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
  - Create policies untuk 5 roles:
    - **Viewer**: SELECT only pada students, transactions, books, spp_payments, academic_years
    - **Wali Kelas**: SELECT all + UPDATE transactions (approve tier 1) untuk assigned_class
    - **Admin**: CRUD pada students, transactions, books, book_distributions, book_payments, spp_payments, audit_logs + UPDATE school_settings
    - **Super Admin**: Semua Admin permissions + FINAL approval pada transactions
    - **Developer**: Full access + DROP/RESTORE tables
  - Gunakan `auth.uid()` untuk identify user dari Supabase Auth
  - Store role di `users` table, reference dari auth.users via trigger atau metadata
  - JANGAN buka akses terlalu luas (default deny all)
  - JANGAN lupa policies untuk audit_logs (append-only untuk semua, read untuk Admin+)
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 5,6,7,8,9,10,11,12
  References:
  - `src/types.ts:6` (UserRole type: 'Developer' | 'Super Admin' | 'Admin' | 'Wali Kelas' | 'Viewer')
  - `src/context/AppContext.tsx:169-178` (login function - auth check)
  - `src/context/AppContext.tsx:184-198` (addAuditLog - currentUser check)
  - `src/context/AppContext.tsx:243-289` (addStudent - demoMode check)
  - `src/context/AppContext.tsx:576-693` (approveWithdrawal - role-based approval)
  - `src/utils/initialData.ts:41-50` (initialUsers - role definitions)
  - `src/utils/format.ts:23-28` (filterByAccessLevel - TK/MI access)
  Acceptance criteria (agent-executable):
  - `SELECT * FROM pg_policies WHERE schemaname = 'public'` returns policies for all 10 tables
  - Each table has policies for all 5 roles
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` executed for all tables
  QA scenarios:
  - Happy: Create test users for each role, verify they can only access allowed data
  - Failure: Missing policy → user gets empty result instead of error, add policy
  Evidence: `.omo/evidence/supabase-integration/task-4-supabase-integration.md`
  Commit: Y | feat(security): add RLS policies for 5 roles across 10 tables

- [ ] 5. Auth Migration - Supabase Auth
  What to do / Must NOT do:
  - Replace mock `initialUsers` auth dengan Supabase Auth
  - Create `src/lib/auth.ts` dengan functions:
    - `signIn(email, password)` → `supabase.auth.signInWithPassword()`
    - `signOut()` → `supabase.auth.signOut()`
    - `getCurrentUser()` → `supabase.auth.getUser()` + fetch profile from `users` table
    - `onAuthStateChange(callback)` → `supabase.auth.onAuthStateChange()`
  - Update `AppContext.tsx` login/logout functions
  - Store user role di Supabase Auth user metadata atau di `users` table dengan FK
  - Keep demo mode functionality: `demoMode` flag di users table
  - JANGAN hapus `initialUsers` array (masih dipakai untuk reference)
  - JANGAN ubah login UI (LoginPage.tsx, LoginModal.tsx)
  Parallelization: Wave 2 | Blocked by: 1,2,4 | Blocks: 6,7,8,9,10,11,12,13
  References:
  - `src/context/AppContext.tsx:169-178` (login function)
  - `src/context/AppContext.tsx:180-182` (logout function)
  - `src/context/AppContext.tsx:160-167` (switchRole function)
  - `src/components/LoginPage.tsx:17-24` (handleLogin - calls login())
  - `src/components/LoginModal.tsx:34-47` (handleCustomLogin - calls setCurrentUser())
  - `src/utils/initialData.ts:41-50` (initialUsers - reference for demo accounts)
  - `src/types.ts:8-18` (User interface - password field)
  Acceptance criteria (agent-executable):
  - `src/lib/auth.ts` exports signIn, signOut, getCurrentUser, onAuthStateChange
  - Login function calls `supabase.auth.signInWithPassword()` instead of `initialUsers.find()`
  - Logout function calls `supabase.auth.signOut()` instead of `setCurrentUser(null)`
  - `npx tsc --noEmit` passes
  QA scenarios:
  - Happy: Login with test user → Supabase session created, currentUser set
  - Failure: Wrong password → Supabase returns error, display to user
  Evidence: `.omo/evidence/supabase-integration/task-5-supabase-integration.md`
  Commit: Y | feat(auth): migrate from mock auth to Supabase Auth

- [ ] 6. Students CRUD Refactor
  What to do / Must NOT do:
  - Refactor `addStudent`, `updateStudent`, `softDeleteStudent`, `importStudentsBulk` di AppContext
  - Replace `setStudents()` dengan `supabase.from('students').insert/update/delete`
  - Maintain same return types (`{ success: boolean, error?: string }`)
  - Keep demoMode check: if `currentUser.demoMode` return error
  - Keep NIS uniqueness validation: query DB sebelum insert
  - Keep soft delete pattern: `isDeleted: true` bukan hard delete
  - Keep balance initialization from initialBalance
  - Auto-generate initial transaction jika initialBalance > 0 (maintain existing logic)
  - JANGAN ubah component interfaces
  - JANGAN hapus optimistic UI updates (keep local state update untuk responsiveness)
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:243-289` (addStudent function)
  - `src/context/AppContext.tsx:291-298` (updateStudent function)
  - `src/context/AppContext.tsx:300-307` (softDeleteStudent function)
  - `src/context/AppContext.tsx:309-379` (importStudentsBulk function)
  - `src/types.ts:37-50` (Student interface)
  - `src/types.ts:35` (StudentStatus type)
  Acceptance criteria (agent-executable):
  - `addStudent()` calls `supabase.from('students').insert()` instead of `setStudents()`
  - `updateStudent()` calls `supabase.from('students').update()` with `.eq('id', id)`
  - `softDeleteStudent()` calls `supabase.from('students').update({ isDeleted: true })`
  - `importStudentsBulk()` uses batch insert with `supabase.from('students').insert(array)`
  - All functions maintain same return signature
  QA scenarios:
  - Happy: Add student → row in Supabase students table, UI updates
  - Failure: Duplicate NIS → Supabase unique constraint error → return error message
  Evidence: `.omo/evidence/supabase-integration/task-6-supabase-integration.md`
  Commit: Y | refactor(students): migrate CRUD to Supabase client

- [ ] 7. Transactions Refactor (Deposit, Withdrawal, Approval)
  What to do / Must NOT do:
  - Refactor `addDeposit`, `requestWithdrawal`, `approveWithdrawal`, `rejectWithdrawal`
  - **addDeposit**: Insert transaction + update student balance dalam 1 operasi (gunakan DB function atau Edge Function untuk atomicity)
  - **requestWithdrawal**: Insert transaction dengan status berdasarkan role
  - **approveWithdrawal**: 2-tier approval - update status + deduct balance (Super Admin only)
  - **rejectWithdrawal**: Update status + update linked book_payments
  - Maintain same return types
  - Keep demoMode check
  - Keep auto-deduct tunggakan logic di addDeposit
  - JANGAN ubah status workflow (5 statuses)
  - JANGAN ubah cross-entity update ke book_payments
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:381-496` (addDeposit function - includes auto-deduct tunggakan)
  - `src/context/AppContext.tsx:498-574` (requestWithdrawal function - role-based status)
  - `src/context/AppContext.tsx:576-693` (approveWithdrawal function - 2-tier approval)
  - `src/context/AppContext.tsx:695-737` (rejectWithdrawal function)
  - `src/types.ts:52-58` (TransactionStatus type - 5 statuses)
  - `src/types.ts:60-84` (Transaction interface)
  Acceptance criteria (agent-executable):
  - `addDeposit()` calls `supabase.rpc('add_deposit', { ... })` atau Edge Function
  - `requestWithdrawal()` calls `supabase.from('transactions').insert()` dengan correct initial status
  - `approveWithdrawal()` calls `supabase.rpc('approve_withdrawal', { ... })` dengan balance check
  - `rejectWithdrawal()` updates transaction status AND linked book_payments
  - Balance updates are atomic (no race conditions)
  QA scenarios:
  - Happy: Deposit → transaction inserted, student balance updated, tunggakan auto-deducted if applicable
  - Failure: Insufficient balance → return error, no changes
  Evidence: `.omo/evidence/supabase-integration/task-7-supabase-integration.md`
  Commit: Y | refactor(transactions): migrate deposit/withdrawal/approval to Supabase

- [ ] 8. Books/Items CRUD Refactor
  What to do / Must NOT do:
  - Refactor `addBook`, `updateBook`, `deleteBook`, `toggleBookDistribution`, `addBookPayment`
  - Replace `setBooks()` dengan `supabase.from('books').insert/update/delete`
  - Replace `setBookDistributions()` dengan Supabase calls
  - Replace `setBookPayments()` dengan Supabase calls
  - Keep backward compatibility fields (bookId ↔ itemId, bookTitle ↔ itemTitle)
  - Keep payment method logic (Tunai vs Potong Tabungan)
  - JANGAN ubah KoperasiKegiatanType logic
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:913-921` (addBook function)
  - `src/context/AppContext.tsx:923-927` (updateBook function)
  - `src/context/AppContext.tsx:929-934` (deleteBook function)
  - `src/context/AppContext.tsx:936-954` (toggleBookDistribution function)
  - `src/context/AppContext.tsx:956-1064` (addBookPayment function - complex: Tunai vs Potong Tabungan)
  - `src/types.ts:86-140` (Book, BookDistribution, BookPayment types)
  Acceptance criteria (agent-executable):
  - All book functions use Supabase client calls
  - `addBookPayment()` with 'Potong Tabungan' calls `requestWithdrawal()` internally
  - `toggleBookDistribution()` creates/updates distribution record
  QA scenarios:
  - Happy: Add book → row in books table, UI updates
  - Happy: Book payment via Potong Tabungan → withdrawal transaction created, book_payment linked
  Evidence: `.omo/evidence/supabase-integration/task-8-supabase-integration.md`
  Commit: Y | refactor(books): migrate koperasi/kegiatan CRUD to Supabase

- [ ] 9. SPP Payments Refactor
  What to do / Must NOT do:
  - Refactor `addSppPayment` di AppContext
  - Replace `setSppPayments()` dengan `supabase.from('spp_payments').insert()`
  - Keep SPP amount logic (TK vs MI, from schoolSettings)
  - Keep payment method logic (Tunai vs Potong Tabungan)
  - Keep balance deduction for Potong Tabungan
  - JANGAN ubah period format (e.g. "Juli 2026")
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:1066-1116` (addSppPayment function)
  - `src/types.ts:142-156` (SppPayment interface)
  - `src/context/AppContext.tsx:1075` (sppAmount calculation - TK vs MI)
  Acceptance criteria (agent-executable):
  - `addSppPayment()` calls `supabase.from('spp_payments').insert()`
  - Balance deduction for Potong Tabungan is atomic
  QA scenarios:
  - Happy: SPP payment → spp_payment row inserted, student balance updated (if Potong Tabungan)
  - Failure: Insufficient balance → return error, no changes
  Evidence: `.omo/evidence/supabase-integration/task-9-supabase-integration.md`
  Commit: Y | refactor(spp): migrate SPP payments to Supabase

- [ ] 10. Monthly Deduction Refactor
  What to do / Must NOT do:
  - Refactor `runMonthlyDeduction` dan `toggleMonthlyDeduction`
  - Use DB function `run_monthly_deduction()` untuk atomicity (bulk update students + bulk insert transactions)
  - Return type `MonthlyDeductionSummary` harus sama
  - Keep logic: auto-deduct tunggakan, accumulate new debt
  - Keep date check (tanggal 28)
  - JANGAN ubah deduction amount (from schoolSettings.monthlyDeductionAmount)
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:739-741` (toggleMonthlyDeduction function)
  - `src/context/AppContext.tsx:743-911` (runMonthlyDeduction function - complex bulk operation)
  - `src/types.ts:189-196` (MonthlyDeductionSummary interface)
  Acceptance criteria (agent-executable):
  - `runMonthlyDeduction()` calls `supabase.rpc('run_monthly_deduction')` atau Edge Function
  - Returns same MonthlyDeductionSummary structure
  - All student balance updates and transaction inserts are atomic
  QA scenarios:
  - Happy: Run deduction → multiple students updated, transactions created, summary returned
  - Happy: Student with debt → debt accumulated, balance zeroed
  Evidence: `.omo/evidence/supabase-integration/task-10-supabase-integration.md`
  Commit: Y | refactor(deduction): migrate monthly deduction to Supabase

- [ ] 11. Academic Years + School Settings Refactor
  What to do / Must NOT do:
  - Refactor `addAcademicYear`, `setCurrentAcademicYearId`, `updateSchoolSettings`, `bulkPromoteStudents`
  - Replace `setAcademicYears()` dengan Supabase calls
  - Replace `setSchoolSettings()` dengan Supabase calls
  - Keep singleton pattern untuk school_settings (1 row)
  - Keep isCurrent flag logic untuk academic years
  - Keep bulkPromoteStudents logic (classGrade update + status change)
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:207-220` (addAcademicYear function)
  - `src/context/AppContext.tsx:222-224` (setCurrentAcademicYearId function)
  - `src/context/AppContext.tsx:200-205` (updateSchoolSettings function)
  - `src/context/AppContext.tsx:226-241` (bulkPromoteStudents function)
  - `src/types.ts:158-163` (AcademicYear interface)
  - `src/types.ts:177-187` (SchoolSettings interface)
  Acceptance criteria (agent-executable):
  - All academic year and settings functions use Supabase calls
  - `addAcademicYear()` sets previous `isCurrent` to false
  - `updateSchoolSettings()` updates singleton row
  QA scenarios:
  - Happy: Add academic year → new row, previous isCurrent=false
  - Happy: Update school settings → singleton row updated
  Evidence: `.omo/evidence/supabase-integration/task-11-supabase-integration.md`
  Commit: Y | refactor(settings): migrate academic years and school settings to Supabase

- [ ] 12. Audit Logs Refactor
  What to do / Must NOT do:
  - Refactor `addAuditLog` di AppContext
  - Replace `setAuditLogs()` dengan `supabase.from('audit_logs').insert()`
  - Keep append-only pattern (no update/delete)
  - Keep currentUser reference (userId, userName, userRole)
  - JANGAN ubah audit log format
  Parallelization: Wave 3 | Blocked by: 2,4,5 | Blocks: 13
  References:
  - `src/context/AppContext.tsx:184-198` (addAuditLog function)
  - `src/types.ts:165-175` (AuditLogItem interface)
  - `src/components/AuditLogView.tsx` (consumer of audit logs)
  Acceptance criteria (agent-executable):
  - `addAuditLog()` calls `supabase.from('audit_logs').insert()`
  - All other functions that call `addAuditLog()` still work correctly
  QA scenarios:
  - Happy: Any mutation → audit_log row inserted with correct userId, action, timestamp
  - Happy: AuditLogView displays logs from Supabase
  Evidence: `.omo/evidence/supabase-integration/task-12-supabase-integration.md`
  Commit: Y | refactor(audit): migrate audit logs to Supabase

- [ ] 13. Backup/Restore Adaptation
  What to do / Must NOT do:
  - Refactor `exportBackupData` dan `restoreBackupData`
  - **exportBackupData**: Query all 10 tables dari Supabase, return JSON (maintain same format)
  - **restoreBackupData**: Developer-only, truncate semua tabel + bulk insert dari JSON
  - Use transactions untuk restore (all-or-nothing)
  - Keep demoMode check
  - Keep Developer role check
  - JANGAN ubah backup JSON format
  Parallelization: Wave 4 | Blocked by: 6,7,8,9,10,11,12 | Blocks: 14
  References:
  - `src/context/AppContext.tsx:1118-1135` (exportBackupData function)
  - `src/context/AppContext.tsx:1137-1172` (restoreBackupData function)
  - `src/context/AppContext.tsx:1141-1143` (Developer role check)
  Acceptance criteria (agent-executable):
  - `exportBackupData()` queries all tables, returns same JSON structure
  - `restoreBackupData()` uses transaction to truncate + insert all tables
  - Only Developer role can restore
  QA scenarios:
  - Happy: Export → JSON with all data, can be re-imported
  - Happy: Restore → all tables replaced, audit log created
  - Failure: Non-Developer tries restore → error
  Evidence: `.omo/evidence/supabase-integration/task-13-supabase-integration.md`
  Commit: Y | refactor(backup): adapt backup/restore to Supabase

- [ ] 14. Netlify Deployment Config
  What to do / Must NOT do:
  - Create `netlify.toml` dengan build command `npm run build` dan publish directory `dist`
  - Configure environment variables di Netlify dashboard
  - Setup redirects for SPA (`/* → /index.html 200`)
  - Verify `VITE_` prefix variables are exposed correctly
  - JANGAN ubah vite.config.ts kecuali perlu
  - JANGAN hapus existing scripts di package.json
  Parallelization: Wave 5 | Blocked by: 1,13 | Blocks: -
  References:
  - `vite.config.ts:1-22` (current Vite config)
  - `package.json:5-11` (scripts section)
  Acceptance criteria (agent-executable):
  - `netlify.toml` exists with correct build config
  - `npm run build` produces dist/ directory
  - SPA routing works (direct URL access → index.html)
  QA scenarios:
  - Happy: Deploy to Netlify → app loads, login works
  - Failure: Missing env vars → clear error on login page
  Evidence: `.omo/evidence/supabase-integration/task-14-supabase-integration.md`
  Commit: Y | chore(deploy): add Netlify deployment configuration

- [ ] 15. DB Functions for Business Logic
  What to do / Must NOT do:
  - Create DB functions di `supabase/migrations/002_functions.sql`:
    1. `generate_transaction_number(prefix, year, count)` → returns formatted string
    2. `add_deposit(student_id, amount, reason, user_id)` → atomic: insert tx + update balance + auto-deduct tunggakan
    3. `request_withdrawal(student_id, amount, reason, user_id, user_role)` → atomic: insert tx with correct status
    4. `approve_withdrawal(transaction_id, user_id, user_role)` → atomic: update tx + deduct balance + update book_payments
    5. `run_monthly_deduction()` → atomic: bulk update students + bulk insert transactions
  - Use `SECURITY DEFINER` untuk functions yang perlu bypass RLS
  - Use transactions untuk atomicity
  - JANGAN ubah function signatures yang sudah di-decide
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 7,10
  References:
  - `src/context/AppContext.tsx:381-496` (addDeposit logic)
  - `src/context/AppContext.tsx:498-574` (requestWithdrawal logic)
  - `src/context/AppContext.tsx:576-693` (approveWithdrawal logic)
  - `src/context/AppContext.tsx:743-911` (runMonthlyDeduction logic)
  - `src/utils/format.ts:78-82` (generateTransactionNumber)
  Acceptance criteria (agent-executable):
  - 5 DB functions exist in database
  - Each function can be called via `supabase.rpc()`
  - Functions are atomic (all operations succeed or all fail)
  QA scenarios:
  - Happy: Call `supabase.rpc('add_deposit', ...)` → transaction created, balance updated
  - Happy: Call `supabase.rpc('run_monthly_deduction')` → bulk updates, summary returned
  Evidence: `.omo/evidence/supabase-integration/task-15-supabase-integration.md`
  Commit: Y | feat(functions): add DB functions for atomic business logic

- [ ] 16. Viewer Database Schema Update
  What to do / Must NOT do:
  - Create `supabase/migrations/003_viewer_fields.sql` dengan tambahan field di `students` table:
    - `viewer_password_hash TEXT` — hash password random untuk login parent
    - `viewer_email TEXT` — email parent (opsional, untuk reset password)
    - `viewer_last_login TIMESTAMPTZ` — terakhir kali parent login
    - `viewer_password_changed_at TIMESTAMPTZ` — kapan password terakhir diganti
  - Create index untuk login cepat: `idx_students_viewer_login` ON (name, viewer_password_hash) WHERE is_deleted = false
  - Update `src/types.ts` tambah field baru di Student interface
  - JANGAN hapus field yang sudah ada
  - JANGAN ubah format ID
  Parallelization: Wave 6 | Blocked by: 2 | Blocks: 17,18,19,20,21
  References:
  - `src/types.ts:37-50` (Student interface - tambah field viewer)
  - `src/components/ViewerPage.tsx:24-277` (existing viewer - perlu extend)
  - `src/context/AppContext.tsx:169-178` (login function - pattern untuk viewer auth)
  Acceptance criteria (agent-executable):
  - SQL migration file exists at `supabase/migrations/003_viewer_fields.sql`
  - `students` table has new columns: viewer_password_hash, viewer_email, viewer_last_login, viewer_password_changed_at
  - Index `idx_students_viewer_login` exists
  - `src/types.ts` updated with new fields
  QA scenarios:
  - Happy: Run migration → new columns exist in students table
  - Happy: Query `SELECT viewer_password_hash FROM students WHERE name = 'test'` returns result
  Evidence: `.omo/evidence/supabase-integration/task-16-supabase-integration.md`
  Commit: Y | feat(viewer): add viewer fields to students table

- [ ] 17. Viewer Auth Flow
  What to do / Must NOT do:
  - Create `src/lib/viewerAuth.ts` dengan functions:
    - `viewerLogin(studentName, password)` → query students table, verify password hash
    - `viewerChangePassword(studentId, oldPassword, newPassword)` → verify old, update hash
    - `generateRandomPassword()` → generate 8-char random password
  - Use `bcrypt` untuk hash password (sama seperti admin users)
  - Update `students` table: set `viewer_password_hash` saat seed data
  - Create Supabase Auth user untuk viewer (atau gunakan custom auth tanpa Supabase Auth)
  - **Decision**: Gunakan custom auth untuk viewer (tidak perlu Supabase Auth account per parent)
  - JANGAN gunakan Supabase Auth untuk viewer (terlalu banyak user)
  - JANGAN ubah login flow untuk admin users
  Parallelization: Wave 6 | Blocked by: 16 | Blocks: 18,19,20,21
  References:
  - `src/context/AppContext.tsx:169-178` (login function - pattern reference)
  - `src/utils/initialData.ts:41-50` (initialUsers - password pattern)
  - `src/types.ts:8-18` (User interface - password field)
  Acceptance criteria (agent-executable):
  - `src/lib/viewerAuth.ts` exports viewerLogin, viewerChangePassword, generateRandomPassword
  - `viewerLogin()` queries students table and verifies password hash
  - `viewerChangePassword()` updates viewer_password_hash and viewer_password_changed_at
  - Passwords are hashed with bcrypt (not plaintext)
  QA scenarios:
  - Happy: Login with correct name + password → returns student data
  - Failure: Wrong password → returns error
  - Happy: Change password → old password no longer works, new password works
  Evidence: `.omo/evidence/supabase-integration/task-17-supabase-integration.md`
  Commit: Y | feat(viewer-auth): implement viewer login and password change

- [ ] 18. Viewer Login Page
  What to do / Must NOT do:
  - Create `src/components/ViewerLoginPage.tsx` dengan:
    - Form input: Nama Siswa + Password
    - Login button
    - Error message display
    - Link ke "Hubungi Sekolah" jika lupa password
  - Update `src/App.tsx` tambah routing untuk viewer login
  - Update `src/App.tsx` tambah state `viewerUser` (separate dari `currentUser`)
  - JANGAN ubah login page untuk admin (LoginPage.tsx)
  - JANGAN ubah navbar untuk viewer (bisa di-hide)
  Parallelization: Wave 7 | Blocked by: 17 | Blocks: 19,20,21
  References:
  - `src/components/LoginPage.tsx:1-97` (existing login page - pattern reference)
  - `src/App.tsx:1-70` (routing structure)
  - `src/context/AppContext.tsx:92-156` (state management pattern)
  Acceptance criteria (agent-executable):
  - `ViewerLoginPage.tsx` exists with form for student name + password
  - Login calls `viewerLogin()` from `src/lib/viewerAuth.ts`
  - On success, stores student data and redirects to ViewerPage
  - On failure, shows error message
  QA scenarios:
  - Happy: Login with valid credentials → redirect to ViewerPage
  - Failure: Invalid credentials → error message displayed
  Evidence: `.omo/evidence/supabase-integration/task-18-supabase-integration.md`
  Commit: Y | feat(viewer-login): create viewer login page

- [ ] 19. Viewer Dashboard Enhancement
  What to do / Must NOT do:
  - Update `src/components/ViewerPage.tsx` tambah fitur:
    1. **Tunggakan Buku**: Hitung total buku belum dibayar, tampilkan daftar
    2. **SPP History** (untuk TK): Tampilkan riwayat pembayaran SPP
    3. **Tunggakan SPP**: Hitung total SPP belum dibayar, tampilkan status
    4. **Change Password**: Form untuk ganti password
  - Remove student selector dropdown (viewer hanya lihat data anak sendiri)
  - Add logout button
  - Keep existing features: balance, transaction history, book distributions
  - JANGAN ubah format data yang sudah ada
  - JANGAN tambah fitur baru selain yang diminta
  Parallelization: Wave 7 | Blocked by: 18 | Blocks: 20,21
  References:
  - `src/components/ViewerPage.tsx:1-277` (existing viewer page)
  - `src/types.ts:142-156` (SppPayment interface)
  - `src/types.ts:115-140` (BookPayment interface)
  - `src/context/AppContext.tsx:1066-1116` (addSppPayment - reference for SPP logic)
  Acceptance criteria (agent-executable):
  - ViewerPage shows tunggakan buku (total + list)
  - ViewerPage shows SPP history for TK students
  - ViewerPage shows tunggakan SPP
  - Change password form works
  - Student selector removed (viewer sees only their child)
  - Logout button works
  QA scenarios:
  - Happy: View tunggakan buku → correct total displayed
  - Happy: View SPP history → list of payments shown
  - Happy: Change password → old password no longer works
  Evidence: `.omo/evidence/supabase-integration/task-19-supabase-integration.md`
  Commit: Y | feat(viewer-dashboard): enhance viewer page with tunggakan and SPP

- [ ] 20. Viewer RLS Policies
  What to do / Must NOT do:
  - Create RLS policies untuk viewer access:
    - Viewer hanya bisa SELECT data anak sendiri (berdasarkan student_id)
    - Viewer tidak bisa INSERT/UPDATE/DELETE data apapun
    - Viewer tidak bisa lihat data siswa lain
  - Use `auth.uid()` atau custom claim untuk identify viewer
  - Test dengan multiple viewer accounts
  - JANGAN buka akses terlalu luas
  - JANGAN lupa index untuk performance
  Parallelization: Wave 7 | Blocked by: 16 | Blocks: 21
  References:
  - `src/types.ts:6` (UserRole type)
  - `src/components/ViewerPage.tsx:24-34` (viewer data access pattern)
  - `supabase/migrations/001_initial_schema.sql` (existing schema)
  Acceptance criteria (agent-executable):
  - RLS policies exist for viewer role
  - Viewer can only SELECT own student data
  - Viewer cannot access other students' data
  - Performance acceptable with indexes
  QA scenarios:
  - Happy: Login as viewer → see only own child's data
  - Failure: Try to access other student's data → empty result or error
  Evidence: `.omo/evidence/supabase-integration/task-20-supabase-integration.md`
  Commit: Y | feat(viewer-rls): add RLS policies for viewer access

- [ ] 21. Seed Data for Viewer Passwords
  What to do / Must NOT do:
  - Update seed script untuk generate random passwords untuk semua siswa aktif
  - Hash passwords dengan bcrypt sebelum insert
  - Create `supabase/seed_viewer_passwords.sql` atau update existing seed
  - Generate password list untuk admin (bisa di-print untuk distribusi ke orang tua)
  - JANGAN hardcode passwords di source code
  - JANGAN ubah password existing users
  Parallelization: Wave 7 | Blocked by: 16,17 | Blocks: -
  References:
  - `supabase/seed.sql` (existing seed script)
  - `src/utils/initialData.ts:73-96` (initialStudents - reference for student data)
  - `src/lib/viewerAuth.ts` (generateRandomPassword function)
  Acceptance criteria (agent-executable):
  - All active students have viewer_password_hash set
  - Passwords are hashed (not plaintext)
  - Password list generated for admin distribution
  - Login works with generated passwords
  QA scenarios:
  - Happy: Login with generated password → success
  - Happy: Admin can view password list for distribution
  Evidence: `.omo/evidence/supabase-integration/task-21-supabase-integration.md`
  Commit: Y | feat(viewer-seed): generate and seed viewer passwords
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit - Verify all 15 tasks completed, all references match actual code changes
- [ ] F2. Code quality review - TypeScript compilation passes, no `any` types introduced, consistent error handling
- [ ] F3. Real manual QA - Login, add student, deposit, withdrawal, approval, monthly deduction, backup/restore all work
- [ ] F4. Scope fidelity - No UI changes, no new features, no format ID changes, all 10 tables migrated
- [ ] F5. Viewer portal QA - Parent login works, change password works, all viewer data displays correctly

## Commit strategy

| Wave | Commit Type | Scope | Message |
|------|------------|-------|---------|
| 1 | feat | supabase | `feat(supabase): add client initialization and env config` |
| 1 | feat | db | `feat(db): create initial schema migration with 10 tables` |
| 1 | feat | seed | `feat(seed): create seed data script for all 10 tables` |
| 2 | feat | security | `feat(security): add RLS policies for 5 roles across 10 tables` |
| 2 | feat | functions | `feat(functions): add DB functions for atomic business logic` |
| 2 | feat | auth | `feat(auth): migrate from mock auth to Supabase Auth` |
| 3 | refactor | students | `refactor(students): migrate CRUD to Supabase client` |
| 3 | refactor | transactions | `refactor(transactions): migrate deposit/withdrawal/approval to Supabase` |
| 3 | refactor | books | `refactor(books): migrate koperasi/kegiatan CRUD to Supabase` |
| 3 | refactor | spp | `refactor(spp): migrate SPP payments to Supabase` |
| 3 | refactor | deduction | `refactor(deduction): migrate monthly deduction to Supabase` |
| 3 | refactor | settings | `refactor(settings): migrate academic years and school settings to Supabase` |
| 3 | refactor | audit | `refactor(audit): migrate audit logs to Supabase` |
| 4 | refactor | backup | `refactor(backup): adapt backup/restore to Supabase` |
| 5 | chore | deploy | `chore(deploy): add Netlify deployment configuration` |
| 6 | feat | viewer | `feat(viewer): add viewer fields to students table` |
| 6 | feat | viewer-auth | `feat(viewer-auth): implement viewer login and password change` |
| 7 | feat | viewer-login | `feat(viewer-login): create viewer login page` |
| 7 | feat | viewer-dashboard | `feat(viewer-dashboard): enhance viewer page with tunggakan and SPP` |
| 7 | feat | viewer-rls | `feat(viewer-rls): add RLS policies for viewer access` |
| 7 | feat | viewer-seed | `feat(viewer-seed): generate and seed viewer passwords` |

## Success criteria

1. Semua 10 tabel terbuat di Supabase dengan benar
2. RLS policies aktif untuk 5 role
3. Login menggunakan Supabase Auth (bukan mock)
4. Semua CRUD operations berjalan via Supabase (bukan localStorage)
5. Business logic (deposit, withdrawal, approval, monthly deduction) berjalan atomic
6. Backup/restore berjalan via Supabase
7. Aplikasi deployed ke Netlify dan bisa diakses
8. Tidak ada perubahan UI admin (hanya data layer)
9. Format ID tetap sama (st-xxx, tr-xxx)
10. `npx tsc --noEmit` passes tanpa error
11. **Viewer**: Parent bisa login dengan nama siswa + password
12. **Viewer**: Parent bisa ganti password
13. **Viewer**: Tampilkan tunggakan buku dengan benar
14. **Viewer**: Tampilkan SPP history untuk TK
15. **Viewer**: Tampilkan tunggakan SPP
16. **Viewer**: Parent hanya bisa lihat data anak sendiri (RLS)
