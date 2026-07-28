/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Developer' | 'Super Admin' | 'Admin' | 'Viewer';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  studentId?: string; // If role is Viewer, linked student NIS/ID
}

export type ClassGrade =
  | 'TK A'
  | 'TK B'
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
  createdAt: string;
}

export type TransactionType = 'Setoran' | 'Penarikan' | 'Potongan Bulanan';
export type TransactionStatus = 'Disetujui' | 'Menunggu Persetujuan' | 'Ditolak';

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
  createdById: string;
  createdByName: string;
  createdByRole: UserRole;
  approvedById?: string;
  approvedByName?: string;
  approvedByRole?: UserRole;
  rejectionReason?: string;
  academicYearId: string;
  createdAt: string; // ISO String
}

export type BookCategory = 'LKS' | 'Buku Penunjang';

export interface Book {
  id: string;
  title: string;
  category: BookCategory;
  classGrade: ClassGrade;
  price: number;
  stock?: number;
}

export interface BookDistribution {
  id: string;
  bookId: string;
  studentId: string;
  received: boolean;
  receivedAt?: string;
}

export type PaymentMethod = 'Tunai' | 'Potong Tabungan';

export interface BookPayment {
  id: string;
  transactionNumber: string; // e.g. BK/2026/00001
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  studentNis: string;
  classGrade: ClassGrade;
  amount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus; // Tunai is Disetujui instantly, Potong Tabungan follows approval
  savingsTransactionId?: string; // Linked savings deduction transaction ID
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
  monthlyDeductionMinBalance: number;
  lastMonthlyDeductionRun?: string;
}

export interface MonthlyDeductionSummary {
  runDate: string;
  totalStudentsDeducted: number;
  totalAmountDeducted: number;
  deductedStudents: { id: string; name: string; nis: string; balanceBefore: number; balanceAfter: number }[];
  skippedStudents: { id: string; name: string; nis: string; balance: number; reason: string }[];
}
