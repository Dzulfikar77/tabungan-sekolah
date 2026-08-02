# student-viewer-credentials - Work Plan

## TL;DR (For humans)

**Apa yang dihasilkan:** Setiap siswa (baru/import/backfill) otomatis dapat User Viewer dengan username=nama-ter-normalisasi dan password=`{tahunAwal}{tahunAkhir}{seq:3}` (contoh `20262027001`). Login portal orang tua tetap pakai path `users` yang ada. Password melekat sampai diganti viewer atau siswa lulus/dihapus; saat itu User Viewer dihapus total dari state+DB.

**Kenapa pendekatan ini:** Field `Student.viewerUsername/viewerPassword` + kolom DB sudah ada tapi terputus dari login (login cek `users`). Auto-create User per siswa memakai path auth yang sudah berfungsi tanpa mengubah `ViewerLoginPage`, sumber tunggal `User.password`, dan bersih otomatis saat siswa dihapus.

**Tidak melakukan:** tidak ubah login admin, tidak hash password (app plaintext, di luar scope), tidak tambah kolom/migrasi DB, tidak ubah hard-delete siswa di `executeCloseAccount` (sudah berfungsi), tidak tampilkan kredensial di tabel siswa (tidak diminta), tidak ubah skema close-savings 2-tier.

**Effort:** 5 file produk + 1 file test. ~7 todo implementasi.

**Risk:** Seq derivasi dari password eksisting (bukan counter persisten) — angka bebas bisa terpakai ulang setelah akun ditutup; diterima (user tidak melarang). Nama duplikat ditangani suffix `-2/-3`. Seed `ay-2`="2025/2026" → backfill menghasilkan prefix `20252026`; bila user ingin `20262027` untuk siswa saat ini, ia harus membuat tahun ajaran 2026/2027 dan menjadikannya current sebelum backfill/add ( perilaku kode benar, ini keputusan data).

**Decisions (locked):**
- F1: Auto-create User (role Viewer) per siswa. Login path `users` array tak berubah.
- F2: Counter global per tahun ajaran. `nextSeq = max(3-digit akhir password Viewer ber-prefix tahun ini)+1`, default 1.
- F3: Backfill semua siswa eksisting tanpa User Viewer ter-link.
- Username immutable; password bisa diganti viewer.
- Hapus User Viewer ter-link di: tutup tabungan, soft-delete, naik ke "Lulus".

## Scope

**IN:**
- Util generate username + password viewer (pure, testable).
- Auto-create User Viewer di `addStudent` + `importStudentsBulk`.
- Helper `deleteLinkedViewerUser` + pasang di `executeCloseAccount`, `softDeleteStudent`, `bulkPromoteStudents` (Lulus only).
- `changeViewerPassword` context method (self-service, role Viewer).
- Fix `ViewerPage.handleChangePassword` pakai `currentUser.password` + `changeViewerPassword`.
- Backfill: context method `backfillViewerCredentials` + tombol di `StudentManagement`.
- 1 file test assert-based untuk util.

**OUT:**
- Hashing password, rate-limit, MFA.
- Kolom DB baru / migrasi (skema sudah mendukung).
- Menampilkan username/password di tabel StudentManagement.
- Mengubah `ViewerLoginPage` (sudah benar untuk Option B).
- Mengubah close-savings 2-tier approval.
- Migrasi data seed `ay-2` ke tahun lain.

## Verification strategy

- **Util test:** `src/utils/viewerCredentials.test.ts` — assert-based, jalankan `npx tsx src/utils/viewerCredentials.test.ts`. Cakup: normalisasi nama, collision suffix, password format, seq max+1, seq default 1, prefix salah-tahun, seq >999 grow.
- **Agent QA per todo:** happy + failure path, perintah/tool exact, evidence path. Tanpa framework.
- **Final verification wave:** F1 plan-compliance, F2 code-quality (lsp/tsc), F3 manual QA flow, F4 scope-fidelity.

## Execution strategy

Wave 1 (foundation): util + test.
Wave 2 (context): helper, create-on-add/import, delete-linked + 3 hook pasang, changeViewerPassword, backfill.
Wave 3 (UI): ViewerPage fix, StudentManagement tombol backfill.
Wave 4: final verification.

## Todos

### Wave 1 — Foundation

- [ ] 1. Buat util generate kredensial viewer + test
  - **References:**
    - Buat baru: `src/utils/viewerCredentials.ts`
    - Impor: `AcademicYear`, `User` dari `src/types.ts` (baris 161, 8)
    - Konvensi normalisasi lihat seed `src/utils/initialData.ts:94` (`ahmadfauzi` = lowercase + strip spasi)
    - Format password dari `AcademicYear.year` "2026/2027" → "20262027" (lihat `src/types.ts:163`)
  - **Implementasi:**
    - `generateViewerUsername(studentName: string, existingUsernames: string[]): string`
      - `base = studentName.trim().toLowerCase().replace(/\s+/g, '')`
      - `username = base`; `suffix = 2`; `taken = new Set(existingUsernames.map(u=>u.toLowerCase()))`
      - `while (taken.has(username.toLowerCase())) { username = \`${base}-${suffix}\`; suffix++; }`
      - return username
    - `generateViewerPassword(academicYear: AcademicYear, existingViewerPasswords: string[]): string`
      - `parts = academicYear.year.split('/')`; `start = parts[0] || String(new Date().getFullYear())`; `end = parts[1] || String(new Date().getFullYear()+1)`
      - `prefix = \`${start}${end}\``
      - `maxSeq = 0`; regex `new RegExp(\`^${prefix}(\\d{3})$\`)`
      - loop `existingViewerPasswords`: match → `seq = parseInt(m[1],10)`; `if (seq > maxSeq) maxSeq = seq`
      - `nextSeq = maxSeq + 1`; return `\`${prefix}${String(nextSeq).padStart(3,'0')}\``
      - Catatan: padStart(3) → seq 1000+ tumbuh jadi 4 digit, tetap unik.
  - **Test:** buat `src/utils/viewerCredentials.test.ts` dengan `console.assert`. Jalankan `npx tsx src/utils/viewerCredentials.test.ts`. Kasus:
    1. `generateViewerUsername('Ahmad Fauzi', [])` === `'ahmadfauzi'`
    2. `generateViewerUsername('Ahmad Fauzi', ['ahmadfauzi'])` === `'ahmadfauzi-2'`
    3. `generateViewerUsername('Ahmad Fauzi', ['ahmadfauzi','ahmadfauzi-2'])` === `'ahmadfauzi-3'`
    4. `generateViewerPassword({year:'2026/2027'} as any, [])` === `'20262027001'`
    5. `generateViewerPassword({year:'2026/2027'} as any, ['20262027005','20262027012'])` === `'20262027013'`
    6. `generateViewerPassword({year:'2027/2028'} as any, ['20262027001'])` === `'20272028001'` (prefix beda tahun tak campur)
    7. `generateViewerPassword({year:'2026/2027'} as any, ['202620271000'])` === `'202620271001'` (seq>999 grow)
    - Exit code: `process.exit(failed ? 1 : 0)` agar CI/script mendeteksi.
  - **Acceptance:** `npx tsx src/utils/viewerCredentials.test.ts` exit 0; ke-7 assert lulus.
  - **QA happy:** jalankan perintah test, output "all passed", exit 0. Evidence: stdout log.
  - **QA failure:** ubah satu ekspektasi test jadi salah sengaja → exit 1 + assert message. Lalu revert.
  - **Commit:** `feat(viewer-creds): add viewer credential generation util + tests`

### Wave 2 — Context wiring

- [ ] 2. Tambah helper + context methods di AppContext
  - **References:**
    - `src/context/AppContext.tsx` — `User` import (baris 8), `users` state (156-159), `addStudent` (372-421), `importStudentsBulk` (443-515), `softDeleteStudent` (433-441), `bulkPromoteStudents` (352-370), `executeCloseAccount` (955-975), `changeUserPassword` (272-279), `addAuditLog` (296-311), `deleteRow` import (35)
    - Impor baru: `generateViewerUsername, generateViewerPassword` dari `../utils/viewerCredentials`
    - Type `AppContextType` (37-97): tambah `changeViewerPassword`, `backfillViewerCredentials`
  - **Implementasi:**
    - Helper internal (di dalam `AppProvider`, sebelum `return`/useEffect, bukan di context type):
      ```typescript
      const findLinkedViewerUser = (studentId: string): User | undefined =>
        users.find((u) => u.role === 'Viewer' && u.studentId === studentId);

      const deleteLinkedViewerUser = (studentId: string, reason: string) => {
        const u = findLinkedViewerUser(studentId);
        if (!u) return;
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
        deleteRow('users', u.id);
        addAuditLog('Hapus User Viewer', `User: ${u.username}`, '-', `User viewer ${u.username} dihapus (${reason}).`);
      };
      ```
    - `changeViewerPassword(newPassword: string): { success: boolean; error?: string }`:
      - guard: `if (!currentUser || currentUser.role !== 'Viewer') return { success: false, error: 'Hanya Viewer yang dapat mengubah password sendiri.' };`
      - `if (newPassword.length < 4) return { success: false, error: 'Password baru minimal 4 karakter.' };`
      - `setUsers(prev => prev.map(u => u.id===currentUser.id ? {...u, password:newPassword} : u))`
      - `updateRow('users', currentUser.id, { password: newPassword });`
      - `addAuditLog('Ubah Password Viewer', currentUser.username, currentUser.username, \`Viewer ${currentUser.name} mengubah password sendiri.\`);`
      - return `{ success: true }`
    - `backfillViewerCredentials(): { created: number; skipped: number; errors: string[] }`:
      - guard `if (!currentUser || currentUser.demoMode) return { created:0, skipped:0, errors:['Mode Demo.'] };` (izin: Developer, Super Admin, Admin — blok Wali Kelas/Viewer)
      - `const target = students.filter(s => !s.isDeleted && s.status === 'Aktif' && !findLinkedViewerUser(s.id));`
      - Akumulator: `const usedUsernames: string[] = users.map(u=>u.username);` `const usedPasswords: string[] = users.filter(u=>u.role==='Viewer').map(u=>u.password||'');`
      - loop target: cari `ay = academicYears.find(y=>y.id===s.academicYearId) || currentAcademicYear`; `username = generateViewerUsername(s.name, usedUsernames)`; `password = generateViewerPassword(ay, usedPasswords)`; push ke usedUsernames+usedPasswords; buat User `{ id:\`u-\${Date.now()}-\${i}\`, username, name:s.name, role:'Viewer', studentId:s.id, password }`; push ke `addedUsers[]`.
      - `setUsers(prev => [...addedUsers, ...prev])`; `Promise.all(addedUsers.map(u => insertRow('users', u)))`.
      - auditLog `backfillViewerCredentials`.
      - return `{ created: addedUsers.length, skipped: target.length===addedUsers.length?0:0, errors:[] }`.
    - Ekspos `changeViewerPassword` + `backfillViewerCredentials` di `AppContextType` + value object.
  - **Acceptance:** `npm run lint` (tsc --noEmit) 0 error; helper/method ada; tidak ada perubahan perilaku eksisting selain penambahan.
  - **QA happy:** setelah todo 3+4 terpasang, jalankan app, backfill → users Viewer baru muncul. Evidence: dev server log + screenshot opsional.
  - **QA failure:** panggil `changeViewerPassword` saat `currentUser` null → return error, tidak throw. Evidence: console log.
  - **Commit:** `feat(viewer-creds): add viewer user helper, changeViewerPassword, backfill in AppContext`

- [ ] 3. Auto-create User Viewer di addStudent
  - **References:** `src/context/AppContext.tsx:372-421` (`addStudent`), import util dari todo 1, helper dari todo 2.
  - **Implementasi:** di `addStudent`, SETELAH `setStudents(...)` + `insertRow('students', newStudent)` (baris 392-393) dan SEBELUM blok initial-balance transaction (396):
    ```typescript
    const ay = academicYears.find((y) => y.id === currentAcademicYearId) || currentAcademicYear;
    const existingUsernames = users.map((u) => u.username);
    const existingPws = users.filter((u) => u.role === 'Viewer').map((u) => u.password || '');
    const vUsername = generateViewerUsername(studentData.name, existingUsernames);
    const vPassword = generateViewerPassword(ay, existingPws);
    const viewerUser: User = {
      id: `u-${Date.now()}`,
      username: vUsername,
      name: newStudent.name,
      role: 'Viewer',
      studentId: newStudent.id,
      password: vPassword,
    };
    setUsers((prev) => [viewerUser, ...prev]);
    insertRow('users', viewerUser);
    ```
    - Jangan tulis `newStudent.viewerUsername/viewerPassword` (field vestigial under Option B; biarkan undefined).
  - **Acceptance:** addStudent via UI → student baru + User Viewer baru muncul di `users`; login ViewerLoginPage dengan kredensial baru sukses.
  - **QA happy:** Login admin → Tambah Siswa "Budi Santoso" kelas TK A → cek `users` array ada `budisantoso` dengan password `2025{...}001`+seq. Login viewer portal → sukses. Evidence: console `users` dump.
  - **QA failure:** add student dengan nama duplikat "Aditya Pratama" (sudah ada) → username jadi `adityapratama-2`, tidak throw. Evidence: console dump.
  - **Commit:** `feat(viewer-creds): auto-create viewer user on addStudent`

- [ ] 4. Auto-create User Viewer di importStudentsBulk (batch)
  - **References:** `src/context/AppContext.tsx:443-515` (`importStudentsBulk`), `src/components/StudentManagement.tsx:143-155` (handler import).
  - **Implementasi:** di dalam `newStudentsList.forEach((st, idx) => {...})` (baris 452), SETELAH `addedArray.push(newStudent)` (479) dan SEBELUM blok initial-balance (482):
    ```typescript
    const ay = academicYears.find((y) => y.id === (st.academicYearId || currentAcademicYear.id)) || currentAcademicYear;
    // akumulator batch: pakai existing viewer usernames + yang sudah dibuat di batch ini
    const batchUsernames = addedUsers.map((u) => u.username);
    const batchPws = addedUsers.map((u) => u.password || '');
    const allUsernames = users.map((u) => u.username).concat(batchUsernames);
    const allPws = users.filter((u) => u.role === 'Viewer').map((u) => u.password || '').concat(batchPws);
    const vUsername = generateViewerUsername(st.name, allUsernames);
    const vPassword = generateViewerPassword(ay, allPws);
    const viewerUser: User = {
      id: `u-imp-${Date.now()}-${idx}`,
      username: vUsername,
      name: newStudent.name,
      role: 'Viewer',
      studentId: newStudent.id,
      password: vPassword,
    };
    addedUsers.push(viewerUser);
    ```
    - Deklarasi `const addedUsers: User[] = []` di awal fungsi (sebelum forEach).
    - Setelah loop, SETELAH `setStudents(...)` (505): `setUsers((prev) => [...addedUsers, ...prev]);` `Promise.all(addedUsers.map((u) => insertRow('users', u)));`
    - Catatan: `st.academicYearId` dipakai bila ada (template import set via `parseStudentsExcel` baris 145); fallback `currentAcademicYear.id`.
  - **Acceptance:** import Excel 5 siswa → 5 User Viewer dibuat, username unik, password seq naik 001..005, login tiap siswa sukses.
  - **QA happy:** download template → isi 3 baris baru → import → `users` array +3 Viewer, password berurutan. Evidence: console dump.
  - **QA failure:** import 2 siswa nama sama "Citra Kirana" → kedua username unik (`citrakirana`, `citrakirana-2`). Evidence: dump.
  - **Commit:** `feat(viewer-creds): auto-create viewer users on bulk import`

### Wave 2b — Cleanup hooks

- [ ] 5. Pasang deleteLinkedViewerUser di 3 path penghapusan siswa
  - **References:**
    - `executeCloseAccount` (`src/context/AppContext.tsx:955-975`)
    - `softDeleteStudent` (`src/context/AppContext.tsx:433-441`)
    - `bulkPromoteStudents` (`src/context/AppContext.tsx:352-370`)
    - helper `deleteLinkedViewerUser` dari todo 2
  - **Implementasi:**
    - `executeCloseAccount`: di awal fungsi (setelah `const finalAmount = student.balance;`, baris 956), panggil `deleteLinkedViewerUser(student.id, 'tutup tabungan')`. Student dihapus setelahnya oleh `setStudents(filter)` + `deleteRow('students',...)` yang sudah ada (957, 962).
    - `softDeleteStudent`: setelah `setStudents(...)` (438) + `updateRow(...)` (439), panggil `deleteLinkedViewerUser(id, 'soft delete siswa')`.
    - `bulkPromoteStudents`: di dalam `affected.forEach` (366), bila `toClass === 'Lulus'`, panggil `deleteLinkedViewerUser(s.id, 'naik ke Lulus')`. Untuk `toClass !== 'Lulus'` JANGAN hapus (siswa pindah kelas tetap aktif, kredensial dipertahankan).
  - **Acceptance:** di tiap path, User Viewer ter-link hilang dari `users` state + `deleteRow('users', uid)` terpanggil. Audit log tercatat.
  - **QA happy (close):** buat siswa + saldo → tutup tabungan (Super Admin) → `users` tidak lagi memuat User Viewer siswa itu; login viewer portal dengan kredensial lama → gagal. Evidence: console `users.length` sebelum/sesudah + login attempt.
  - **QA happy (soft-delete):** soft-delete siswa dari StudentManagement → User Viewer hilang; login viewer gagal. Evidence: dump.
  - **QA happy (lulus):** bulkPromote kelas ke "Lulus" → User Viewer tiap siswa terkait hilang; login gagal. Evidence: dump.
  - **QA failure:** pindah kelas (bukan Lulus) → User Viewer TETAP ada (tidak terhapus). Evidence: dump.
  - **Commit:** `feat(viewer-creds): delete linked viewer user on close/soft-delete/graduation`

### Wave 3 — UI

- [ ] 6. Fix ViewerPage change-password pakai User.password + changeViewerPassword
  - **References:**
    - `src/components/ViewerPage.tsx:31-42` (destructure useApp), `88-114` (`handleChangePassword`), `92` (baca `student.viewerPassword`), `105` (`updateStudent`)
    - `src/context/AppContext.tsx` — `changeViewerPassword` dari todo 2
  - **Implementasi:**
    - Di destructure (baris 31-42): tambah `changeViewerPassword`. (currentUser sudah ada baris 39.)
    - `handleChangePassword` (88-114):
      - Ganti `if (student.viewerPassword !== oldPassword)` (92) → `if (currentUser.password !== oldPassword)`
      - Ganti `updateStudent(student.id, { viewerPassword: newPassword });` (105) → `const res = changeViewerPassword(newPassword); if (!res.success) { setPwError(res.error || 'Gagal mengubah password.'); return; }`
      - Sisa (setPwSuccess, reset state, timeout) tetap.
  - **Acceptance:** viewer login → Ubah Password → password lama benar + baru ≥4 char → `User.password` terupdate di state+DB; login ulang dengan password baru sukses, lama gagal.
  - **QA happy:** ubah password `ahmad123`→`baru456` → logout → login `ahmadfauzi`/`baru456` sukses, `/ahmad123` gagal. Evidence: login attempts.
  - **QA failure:** input password lama salah → tampil "Password lama salah.", state tak berubah. Evidence: UI state.
  - **Commit:** `fix(viewer-creds): viewer change-password uses User.password via changeViewerPassword`

- [ ] 7. Tombol Backfill Kredensial di StudentManagement
  - **References:**
    - `src/components/StudentManagement.tsx:27-37` (destructure useApp), `186-219` (header buttons), `559-635` (import modal sebagai pola UI)
    - `src/context/AppContext.tsx` — `backfillViewerCredentials` dari todo 2
  - **Implementasi:**
    - Destructure tambah `backfillViewerCredentials`.
    - State: `const [backfillResult, setBackfillResult] = useState<{created:number; skipped:number; errors:string[]} | null>(null);`
    - Tombol header (seusai tombol Import, ~209): `<button onClick={() => { setBackfillResult(null); setIsBackfillModalOpen(true); }} className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 ..."><KeyRound className="w-4 h-4" /> Backfill Kredensial</button>` (import `KeyRound` dari lucide-react).
    - State modal: `const [isBackfillModalOpen, setIsBackfillModalOpen] = useState(false);`
    - Modal (pola seperti Import modal): judul "Backfill Kredensial Viewer Siswa Eksisting"; paragraf penjelasan "Buat User Viewer untuk siswa aktif yang belum punya akses portal. Username dari nama, password mengikuti tahun ajaran masing-masing siswa."; tombol "Proses Backfill" → `const res = backfillViewerCredentials(); setBackfillResult(res);`; tampilkan hasil `{created}` dibuat.
    - Guard izin: tombol hanya render bila `currentUser.role === 'Developer' || currentUser.role === 'Super Admin' || currentUser.role === 'Admin'`.
  - **Acceptance:** klik Backfill → semua siswa aktif tanpa User Viewer dapat kredensial; pesan jumlah; login salah satu sukses.
  - **QA happy:** reset localStorage → load seed → klik Backfill → `users` bertambah ~98 Viewer; login `adityapratama`/`20252026001` sukses. Evidence: console `users.filter(role==='Viewer').length`.
  - **QA failure:** klik Backfill kedua kalinya → `created: 0` (semua sudah punya). Evidence: result dump.
  - **Commit:** `feat(viewer-creds): add backfill viewer credentials button in StudentManagement`

## Final verification wave

- [ ] F1. Plan-compliance audit
  - Bandingkan setiap todo di plan ini dengan diff aktual. Setiap References/Acceptance terpenuhi. Evidence: `git diff --stat` + checklist.
- [ ] F2. Code quality (tsc + lint)
  - `npm run lint` (`tsc --noEmit`) exit 0. `npx tsx src/utils/viewerCredentials.test.ts` exit 0. Evidence: stdout.
- [ ] F3. Manual QA flow end-to-end
  - Flow: reset localStorage → login admin → Backfill → catat 1 kredensial → login viewer portal → ubah password → logout → login password baru → tambah siswa baru (admin) → login siswa baru → tutup tabungan siswa itu → login viewer siswa itu gagal → soft-delete siswa lain → login viewer-nya gagal → bulkPromote kelas ke Lulus → login viewer siswa lulus gagal. Evidence: console dumps + login attempt hasil per langkah.
- [ ] F4. Scope fidelity
  - Tidak ada: migrasi DB, kolom baru, hash password, perubahan ViewerLoginPage, perubahan close-savings 2-tier, tampilan kredensial di tabel siswa. Evidence: `git diff -- supabase/ src/components/ViewerLoginPage.tsx` kosong.

## Commit strategy

Satu branch `feat/student-viewer-credentials`. Commit per todo sesuai pesan masing-masing. Tidak squash otomatis; biarkan riwayat granular. PR ke main setelah final verification lulus.

## Success criteria

- Siswa baru (add/import) otomatis dapat User Viewer dengan username=nama-normalisasi + password=`{start}{end}{seq:3}` per tahun ajaran siswa.
- Siswa eksisting dapat di-backfill kredensial.
- Password viewer bisa diubah sendiri via portal; username immutable.
- Saat siswa tutup tabungan / soft-delete / naik Lulus → User Viewer terhapus dari state + DB (akses portal berakhir).
- Login viewer portal sukses pakai kredensial yang digenerate.
- `npm run lint` 0 error; util test exit 0.
- Tidak ada migrasi DB; tidak ada perubahan ViewerLoginPage.
