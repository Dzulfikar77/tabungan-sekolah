# Decisions

- Payout semua siswa tiap akhir tahun; mulai 0 di tahun baru (Q1=B).
- Satu record kontinu: record, NIS, user viewer, histori — utuh (Q3=A).
- Aturan 7: utang bersih dari saldo dulu (cash = max(0, balance - debt)), sisa debt menempel, saldo tidak minus.
- 1 persetujuan per batch (input langsung eksekusi, role Super Admin/Admin).
- Lulus (TK B / Kelas 6) tidak masuk batch — pakai "Tutup Tabungan" existing.
- Idempotent: siswa dgn academicYearId === target di-skip.
- `bulkPromoteStudents` dan `closesAccount` lama tidak diubah.
