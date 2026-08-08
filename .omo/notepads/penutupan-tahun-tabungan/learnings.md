# Learnings

- `mergeById(db, local)` cloud menang (AppContext.tsx:138) — mutasi lokal harus tersync ke Supabase, kalau gagal fetch berikutnya balik ke nilai cloud lama.
- `students.balance` punya `CHECK (balance >= 0)` di DB — garansi saldo tidak minus.
- `pending_debt` sudah ada di skema + tipe `Student`. Tidak butuh kolom baru.
- Storage key v4; jangan bump untuk fitur ini (tanpa perubahan bentuk data).
- Pattern test murni: file `*.test.ts` pakai `assert(...)` manual, jalan `npx tsx`.
- Transaksi Disetujui langsung: pola `requestCloseSavings` — Super Admin/Developer set `status: 'Disetujui'` + approvedBy* = currentUser.

## QA findings (pre-existing, bukan dari fitur ini)
- Seed quirk: `initialStudents.academicYearId = 'ay-2'` tapi `initialAcademicYears` cuma `ay-1` (2026/2027) → mode lokal dashboard "0 siswa aktif".
- `src/lib/supabase.ts:4` THROW kalau env VITE_SUPABASE_URL/KEY kosong → app tidak bisa boot offline, padahal README klaim fallback localStorage. Cek untuk perbaikan terpisah.
- `mergeById` (cloud-wins) + persist effect: fixture localStorage ditimpa oleh fetch cloud → data uji via localStorage tidak bertahan di env dengan Supabase terisi.
