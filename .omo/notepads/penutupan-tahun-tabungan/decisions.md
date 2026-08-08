# Decisions

- Payout semua siswa tiap akhir tahun; mulai 0 di tahun baru (Q1=B).
- Satu record kontinu: record, NIS, user viewer, histori — utuh (Q3=A).
- Aturan 7: utang bersih dari saldo dulu (cash = max(0, balance - debt)), sisa debt menempel, saldo tidak minus.
- 1 persetujuan per batch (input langsung eksekusi, role Super Admin/Admin).
- Lulus (TK B / Kelas 6) tidak masuk batch — pakai "Tutup Tabungan" existing.
- Idempotent: siswa dgn academicYearId === target di-skip.
- `bulkPromoteStudents` dan `closesAccount` lama tidak diubah.

- KOREKSI (setelah klarifikasi user): tunggakan TIDAK dipotong dari tabungan saat penutupan tahun. Payout = saldo PENUH. pendingDebt TIDAK diubah (menempel utuh untuk naik & tinggal). Jalur penyelesaian tunggakan DI-BUKA — keputusan mekanisme TBD.
- `settleYearEndDebt` dihapus dari yearEnd.ts (tidak dipakai lagi); test disesuaikan.
- Tunggakan TAMPAK sebagai status: Dashboard (card total + tabel siswa berutang) + halaman Siswa (kolom Tunggakan) + portal viewer (sudah ada).

- KEKORSI (setelah klarifikasi user): tunggakan TIDAK dipotong otomatis dari tabungan saat penutupan tahun. Payout = saldo PENUH (kas ke wali = balance), balance=0. pendingDebt tidak disentuh — menempel utk naik & tinggal. Jalur penyelesaian tunggakan dibuka (mekanisme TBD).
- `settleYearEndDebt` dihapus dari yearEnd.ts + test disesuaikan.
- Tunggakan tampil sebagai status: Dashboard (card Total Tunggakan + tabel siswa berutang), halaman Siswa (kolom Tunggakan), portal viewer (sudah ada sebelumnya).
