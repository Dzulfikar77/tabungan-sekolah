export interface BackupCounts {
  students: number;
  transactions: number;
  bookPayments: number;
  sppPayments: number;
  bookDistributions: number;
  academicYears: number;
}

export interface BackupPreview {
  valid: boolean;
  error?: string;
  counts: BackupCounts;
}

/**
 * Validasi isi file cadangan/snapshot sebelum restore.
 * Cek format top-level, tipe data kritis (saldo >= 0, nominal > 0),
 * dan referential integrity transaksi -> siswa.
 */
export function inspectBackupPayload(data: unknown): BackupPreview {
  const zero: BackupCounts = {
    students: 0,
    transactions: 0,
    bookPayments: 0,
    sppPayments: 0,
    bookDistributions: 0,
    academicYears: 0,
  };
  if (!data || typeof data !== 'object') {
    return { valid: false, counts: zero, error: 'Isi file cadangan tidak valid.' };
  }

  const d = data as Record<string, any>;
  if (
    typeof d.schoolSettings !== 'object' || d.schoolSettings === null || Array.isArray(d.schoolSettings) ||
    !Array.isArray(d.students) || !Array.isArray(d.transactions)
  ) {
    return { valid: false, counts: zero, error: 'Format file cadangan tidak valid: schoolSettings (objek), students & transactions (array) wajib ada.' };
  }

  const badBalance = d.students.find((s: any) => typeof s.balance !== 'number' || s.balance < 0);
  if (badBalance) {
    return { valid: false, counts: zero, error: `Data siswa tidak valid: saldo "${badBalance.name || badBalance.id}" harus angka >= 0.` };
  }
  const badAmount = d.transactions.find((t: any) => typeof t.amount !== 'number' || t.amount <= 0);
  if (badAmount) {
    return { valid: false, counts: zero, error: `Data transaksi tidak valid: nominal "${badAmount.transactionNumber || badAmount.id}" harus angka > 0.` };
  }

  const studentIds = new Set(d.students.map((s: any) => s.id));
  const orphan = d.transactions.find((t: any) => t.studentId && !studentIds.has(t.studentId));
  if (orphan) {
    return { valid: false, counts: zero, error: `Referensi rusak: transaksi ${orphan.transactionNumber || orphan.id} mengacu pada siswa yang tidak ada di data cadangan.` };
  }

  return {
    valid: true,
    counts: {
      students: d.students.length,
      transactions: d.transactions.length,
      bookPayments: Array.isArray(d.bookPayments) ? d.bookPayments.length : 0,
      sppPayments: Array.isArray(d.sppPayments) ? d.sppPayments.length : 0,
      bookDistributions: Array.isArray(d.bookDistributions) ? d.bookDistributions.length : 0,
      academicYears: Array.isArray(d.academicYears) ? d.academicYears.length : 0,
    },
  };
}