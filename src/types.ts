/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Developer' | 'Super Admin' | 'Admin' | 'Wali Kelas' | 'Admin Koperasi' | 'Viewer';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  studentId?: string; // If role is Viewer, linked student NIS/ID
  password?: string;
  demoMode?: boolean;
  accessLevel?: 'TK' | 'MI';
  // Kelas spesifik yang dipegang Wali Kelas (Guru Kelas) — dipakai buat kunci
  // akses input Kegiatan & laporan tunggakan ke kelasnya sendiri saja, beda
  // dari accessLevel yang cuma level TK/MI secara umum.
  assignedClass?: ClassGrade;
  mustChangePassword?: boolean; // Viewer provisioned with a derivable initial code
}

export type ClassGrade =
  | 'TK A.1'
  | 'TK A.2'
  | 'TK B.1'
  | 'TK B.2'
  | 'Kelas 1A'
  | 'Kelas 1 B'
  | 'Kelas 2A'
  | 'Kelas 2B'
  | 'Kelas 3A'
  | 'Kelas 3B'
  | 'Kelas 4A'
  | 'Kelas 4B'
  | 'Kelas 5A'
  | 'Kelas 5B'
  | 'Kelas 6A'
  | 'Kelas 6B';
export type StudentStatus = 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar';

export interface Student {
  id: string;
  nis: string;
  name: string;
  classGrade: ClassGrade;
  status: StudentStatus;
  academicYearId: string;
  balance: number;
  parentName?: string;
  phone?: string;
  isDeleted?: boolean;
  pendingDebt?: number; // Akumulasi tunggakan potongan bulanan
  createdAt: string;
}

export type TransactionType = 'Setoran' | 'Penarikan' | 'Potongan Bulanan';
export type TransactionStatus =
  | 'Disetujui'
  | 'Menunggu Persetujuan'
  | 'Menunggu Approval Admin'
  | 'Menunggu Approval Super Admin'
  | 'Ditolak';

// Permintaan perbaikan (edit) transaksi yang sudah disetujui — butuh persetujuan Super Admin
export interface TransactionEditRequest {
  requestedById: string;
  requestedByName: string;
  requestedByRole: UserRole;
  requestedAt: string;
  oldAmount: number;
  newAmount: number;
  oldReason: string;
  newReason: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string; // e.g. ST/2026/00001
  studentId: string;
  studentName: string;
  studentNis: string;
  classGrade: ClassGrade;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  reason: string;
  approvedByAdmin?: boolean;
  approvedByAdminName?: string;
  approvedBySuperAdmin?: boolean;
  approvedBySuperAdminName?: string;
  createdById: string;
  createdByName: string;
  createdByRole: UserRole;
  approvedById?: string;
  approvedByName?: string;
  approvedByRole?: UserRole;
  rejectionReason?: string;
  academicYearId: string;
  createdAt: string; // ISO String
  closesAccount?: boolean; // Tutup tabungan (lulus/pindah): saldo 0 + data siswa dihapus saat disetujui
  hasPendingEdit?: boolean; // Ada permintaan perbaikan menunggu persetujuan Super Admin
  editRequest?: TransactionEditRequest; // Detail permintaan perbaikan (nominal/keterangan baru)
}

export type KoperasiKegiatanType = 'Koperasi' | 'Kegiatan';

export interface KoperasiKegiatanItem {
  id: string;
  title: string;
  type: KoperasiKegiatanType; // 'Koperasi' | 'Kegiatan'
  category: string; // 'Buku', 'Seragam', 'Alat Tulis', 'Outing Class', 'Outbound', or custom
  classGrade: ClassGrade | 'Semua Kelas';
  price: number;
  stock?: number;
  description?: string;
}

// Backward compatibility alias
export type BookCategory = string;
export type Book = KoperasiKegiatanItem;

export interface KoperasiKegiatanDistribution {
  id: string;
  itemId: string; // bookId / itemId
  bookId?: string;
  studentId: string;
  received: boolean;
  receivedAt?: string;
}
export type BookDistribution = KoperasiKegiatanDistribution;

export type PaymentMethod = 'Tunai' | 'Potong Tabungan';

// Koperasi & Kegiatan juga bisa dibebankan tanpa dibayar di tempat ("Belum
// Bayar") — beda dari Setoran/Penarikan/SPP yang masih pakai PaymentMethod
// polos, makanya union terpisah biar gak ngubah fitur lain yang shared type.
export type BookPaymentMethod = PaymentMethod | 'Belum Bayar';

// 'Belum Lunas' = dibebankan tapi belum dibayar sama sekali (metode Belum
// Bayar). 'Lunas Sebagian' = Potong Tabungan tapi saldo gak cukup — bagian
// yang tertutup saldo sudah diproses (ikut alur approval 2-tier biasa),
// sisanya jadi tanggungan (outstandingAmount) yang melekat ke siswa sampai
// dilunasi atau siswa lulus. Saldo tabungan TIDAK PERNAH dipotong sampai minus.
export type BookPaymentStatus = TransactionStatus | 'Belum Lunas' | 'Lunas Sebagian';

export interface KoperasiKegiatanPayment {
  id: string;
  transactionNumber: string; // e.g. KK/2026/00001
  itemId: string;
  bookId?: string; // backward compat
  itemTitle: string;
  bookTitle?: string; // backward compat
  itemType: KoperasiKegiatanType; // 'Koperasi' | 'Kegiatan'
  category: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  classGrade: ClassGrade;
  amount: number; // total harga item
  amountPaid: number; // sudah terbayar/terpotong sejauh ini
  outstandingAmount: number; // amount - amountPaid; 0 kalau sudah lunas
  paymentMethod: BookPaymentMethod;
  status: BookPaymentStatus;
  approvedByAdmin?: boolean;
  approvedByAdminName?: string;
  approvedBySuperAdmin?: boolean;
  approvedBySuperAdminName?: string;
  savingsTransactionId?: string; // Linked savings deduction transaction ID
  settledAt?: string; // waktu outstandingAmount mencapai 0
  createdByName: string;
  createdAt: string;
  academicYearId: string;
}
export type BookPayment = KoperasiKegiatanPayment;

export interface SppPayment {
  id: string;
  transactionNumber: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  classGrade: ClassGrade;
  amount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  period: string; // e.g. "Juli 2026"
  createdByName: string;
  createdAt: string;
  academicYearId: string;
}

export interface AcademicYear {
  id: string;
  year: string; // e.g. "2025/2026"
  isCurrent: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  timestamp: string;
  valueBefore?: string;
  valueAfter?: string;
  details: string;
}

export interface SchoolSettings {
  name: string;
  address: string;
  phone: string;
  logoUrl?: string;
  monthlyDeductionEnabled: boolean;
  monthlyDeductionAmount: number;
  lastMonthlyDeductionRun?: string;
  sppTKAmount?: number;
  sppSDAmount?: number;
}

export interface MonthlyDeductionSummary {
  runDate: string;
  totalStudentsDeducted: number;
  totalAmountDeducted: number;
  deductedStudents: { id: string; name: string; nis: string; balanceBefore: number; balanceAfter: number }[];
  skippedStudents: { id: string; name: string; nis: string; balance: number; reason: string }[];
  pendingDebtStudents: { id: string; name: string; nis: string; debt: number; balance: number }[];
  // true kalau ditolak (lihat runMonthlyDeduction force param). 'disabled' = toggle
  // OFF (tidak bisa di-force, aktifkan togglenya dulu); 'already_ran' = sudah
  // jalan bulan ini (bisa di-force kalau memang mau jalan ulang).
  blocked?: boolean;
  blockedCode?: 'disabled' | 'already_ran';
  blockedReason?: string;
}
