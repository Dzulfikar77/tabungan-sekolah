# DRAFT: student-viewer-credentials

## Meta
- slug: student-viewer-credentials
- intent: clear
- review_required: false
- classification: Standard (1-5 files: types.ts, AppContext.tsx, StudentManagement.tsx, ViewerLoginPage.tsx, excelHandler.ts + util)
- status: awaiting-approval (forks answered, brief presented)
- created: 2026-08-02

## Request (verbatim intent)
- Username siswa = nama siswa
- Password = tahun ajaran berjalan (contoh 2026/2027 → "20262027") + 3 digit sequence mulai 001
- Siswa pertama ke-record → password 20262027001; recording mulai dari kelas TK A
- Tahun ajaran baru: siswa yang SUDAH punya password pakai password LAMA
- Siswa BARU di-upload → sesuaikan tahun ajaran baru (contoh 2027/2028 → "20272028" + 001 mulai TK A)
- Tabungan ditutup → otomatis terhapus tabungannya

## Key findings (evidence)
1. **DUAL credential system — DISCONNECT:**
   - `ViewerLoginPage` (src/components/ViewerLoginPage.tsx:26-31) auth against `users` array (role==='Viewer'). Only ONE seeded viewer: `u-viewer` (ortu1/ortu2345, studentId st-7).
   - `Student.viewerUsername`/`viewerPassword` (src/types.ts:49-50) + DB cols `viewer_username`/`viewer_password` (supabase/migrations/001_initial_schema.sql:18-19) EXIST but UNUSED for login. Only `ViewerPage.handleChangePassword` (ViewerPage.tsx:92,105) reads `student.viewerPassword` — itself disconnected from login path.
2. **addStudent (AppContext.tsx:372) + importStudentsBulk (AppContext.tsx:443) do NOT generate viewer creds.** New students get no viewerUsername/viewerPassword.
3. **executeCloseAccount (AppContext.tsx:955-975) ALREADY hard-deletes student + bookDistributions + bookPayments + sppPayments + DB rows.** "Tutup tabungan → auto hapus" ALREADY SATISFIED for the student record. If auth moves to students array, viewer creds auto-vanish on close (no extra work). closeStudentSavings/requestCloseSavings (AppContext.tsx:64 vs 977) naming mismatch exists but out of scope.
4. **AcademicYear (src/types.ts:161):** format "2025/2026" (ay-2 isCurrent). addAcademicYear (AppContext.tsx:321) creates new year + flips isCurrent. Password prefix derivation: year.split('/') → "2025"+"2026" = "20252026". For 2026/2027 → "20262027". Matches user example.
5. **Seed data (initialData.ts:74-98):** ~98 students across all 14 classes (7 names/class), all academicYearId 'ay-2', only st-7 has viewer creds (ahmadfauzi/ahmad123). NIS pattern `2025{seq:3}`.
6. **ALL_CLASSES order (initialData.ts:24-39):** TK A, TK B, Kelas 1A, 1 B, 2A...6B. Natural ordering "mulai dari TK A".
7. **No persistent sequence counter exists.** Deriving next-seq from existing students risks collision/rewind when accounts closed (hard-deleted). Need persisted counter per academic year (e.g. field on AcademicYear, or scan existing passwords for year-prefix + max+1 accepting rewind risk).
8. **Username collision:** real names duplicate ("Ahmad Fauzi"). Need deterministic rule.
9. **db.ts:** camelCase↔snake_case auto (viewerUsername↔viewer_username). No new mapping needed.
10. **No tests exist anywhere** (codegraph blast-radius: "no covering tests found" on every symbol). Test strategy: agent-executed QA only (assert-based self-check or small test file).

## Components (topology lock)
- C1 Credential generation util — function: given name + academicYear + existing-creds → { viewerUsername, viewerPassword }. Password = yearPrefix + 3-digit seq. Username = normalized name + collision suffix.
- C2 Sequence counter — persistent per academic year (monotonic, survives close/delete so no rewind).
- C3 Wire generation into addStudent + importStudentsBulk (AppContext.tsx) — assign creds on create; new-year rule: existing students keep old pw, new students get current-year pw.
- C4 Auth path — ViewerLoginPage authenticate against students (viewerUsername/viewerPassword) instead of users array; construct Viewer User at login with studentId.
- C5 Backfill existing students (if owner chooses) — one-shot credential assignment for seeded students.
- C6 Close-account credential cleanup — VERIFY executeCloseAccount suffices (it does, under C4). No code change expected; confirmation only.

## Forks (answered)
- F1 AUTH APPROACH → **Option B: auto-create User (role Viewer) per siswa.** Login path via `users` array UNCHANGED. addStudent/import create linked Viewer User.
- F2 SEQUENCE SCOPE → **Global per tahun ajaran.** Single counter 001..N per year.
- F3 BACKFILL → **Backfill all existing students** with scheme creds. User clarified: password auto-generated sticks to student until they change it OR lulus. Password changeable; username immutable. New students follow new academic year + 3-digit seq.

## Decisions adopted (defaults + from answers)
- Username normalization: lowercase + strip spaces. "Ahmad Fauzi" → "ahmadfauzi".
- Collision: append -2, -3, ... until unique among `users` (role Viewer).
- Username IMMUTABLE: updateStudent name-edit does NOT touch the linked User's username. No sync on name edit.
- Password format: `{startYear}{endYear}{seq:03d}` from AcademicYear.year "2026/2027" → "20262027"+"001" = "20262027001".
- nextSeq derivation (no persisted counter, no migration): max trailing-3-digit among Viewer-role users whose password starts with current-year prefix, +1 (default 1 if none). Collision-free; freed numbers may be reused (acceptable, user did not forbid).
- Password source of truth = User.password. ViewerPage.handleChangePassword updated to change User.password via NEW self-service context method (current changeUserPassword is Developer-gated).
- student.viewerPassword field becomes vestigial under Option B; leave field in place (no removal) to avoid schema churn, stop writing to it.
- Credential lifecycle — delete linked Viewer User on: (a) executeCloseAccount [close savings], (b) softDeleteStudent, (c) bulkPromoteStudents to 'Lulus'. [OPEN — confirm in approval brief]
- Backfill overwrites st-7 manual creds (ahmadfauzi/ahmad123, ortu1/ortu2345) to scheme creds for consistency.
- Test strategy: agent-executed QA only — one assert-based self-check file for the pure credential-generation util (no framework). TDD optional.
- Scope OUT: close-savings hard-delete of student record already works (executeCloseAccount). Only addition = also delete linked Viewer User.
- Scope OUT: not changing admin login, not adding rate-limiting, not hashing passwords (app stores plaintext already — out of scope unless requested).

## Next workflow action
Present approval brief (below). On explicit ok → scaffold plan (no shell → write .omo/plans/<slug>.md directly with template) → Metis gap analysis → append todos → present handoff. review_required=false so offer optional high-accuracy review at handoff.

## Approval brief (for user)
See chat message.
