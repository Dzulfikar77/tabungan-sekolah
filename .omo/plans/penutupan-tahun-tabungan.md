# Penutupan Tahun Tabungan (Naik / Tinggal Kelas + Payout + Utang)

## Tujuan

Alur akhir tahun ajaran: semua siswa Aktif mendapat pengembalian tabungan (payout) + pindah tahun ajaran. Per siswa bisa **Naik Kelas** atau **Tidak Naik** (tinggal kelas). Aturan 7: utang (`pendingDebt`) dibersihkan dari saldo duluan, saldo tidak pernah minus (DB CHECK `balance >= 0` juga jaga), sisa utang menempel di record. Siswa lulus (TK B, Kelas 6) TIDAK masuk batch ini — tetap pakai "Tutup Tabungan" existing (tidak berubah).

## Acceptance Criteria

- [ ] Non-trivial logika settlement diekstrak ke util murni + ada test lari (`npx tsx`).
- [ ] Batch: 1 persetujuan (peng-input langsung eksekusi, pola existing untuk Super Admin/Admin), menghasilkan N transaksi `Penarikan` (status Disetujui, reason "Penarikan Tabungan Akhir Tahun {year}").
- [ ] `pendingDebt` sisa menempel di record; `balance`=0; record/NIS/viewer UTUH untuk naik & tinggal.
- [ ] Idempotent guard: siswa yang sudah `academicYearId === target` di-skip tanpa transaksi dobel.
- [ ] Role guard + demoMode guard (pola existing `return { success:false, error }`).
- [ ] `bulkPromoteStudents` existing TIDAK berubah (UI "Pindah Kelas Massal" tetap jalan).
- [ ] DB: TIDAK ada perubahan skema / migration / bump storage key.

## TODOs

- [x] 1. `src/utils/yearEnd.ts`: `settleYearEndDebt(balance, pendingDebt)` + `nextClassFrom(classGrade)` + `isGraduatingClass` + type `YearEndDecision`; `src/utils/yearEnd.test.ts` (assert style, jalan `npx tsx src/utils/yearEnd.test.ts`)
- [x] 2. `src/context/AppContext.tsx`: tambah `runYearEndClosure(decisions, targetAcademicYearId)` di AppContextType + implementasi (per siswa: settle → tx jika cash>0 → update balance/pendingDebt/classGrade/academicYearId → sync; guard; audit log)
- [x] 3. `src/components/StudentManagement.tsx`: modal "Penutupan Tahun" — pilih kelas & tahun tujuan, list siswa Aktif, per siswa toggle Naik/Tidak Naik + preview settlement, konfirmasi, ringkasan hasil

## Final Verification Wave

- [x] F1. `npx tsc --noEmit` exit 0 + `npx tsx` semua test lulus (viewerCredentials, schoolSettings, yearEnd)
- [x] F2. (UI smoke; data-path via unit test — env cloud memblokir flow penuh) Browser QA (Playwright): login `masdev`, Manajemen Siswa, proses kelas TK A.1 → siswa pindah TK B.1, saldo 0, transaksi Penarikan "Akhir Tahun" terbentuk, dashboard/SPP/lapor tidak crash
- [x] F3. Konsistensi: git diff terbatas di 3 file + 2 file baru; tidak ada referensi korup di area lain