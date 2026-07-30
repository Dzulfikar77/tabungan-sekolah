/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Book, Transaction, AcademicYear, AuditLogItem, SchoolSettings, User, BookPayment, BookDistribution, SppPayment, ClassGrade } from '../types';

export const initialSchoolSettings: SchoolSettings = {
  name: 'SD & TK Nusantara Utama',
  address: 'Jl. Pemuda No. 45, Kebayoran Baru, Jakarta Selatan',
  phone: '(021) 789-0123',
  monthlyDeductionEnabled: true,
  monthlyDeductionAmount: 2000,
  sppTKAmount: 50000,
  sppSDAmount: 0,
  lastMonthlyDeductionRun: '2026-07-01T00:00:00.000Z',
};

export const initialAcademicYears: AcademicYear[] = [
  { id: 'ay-1', year: '2024/2025', isCurrent: false, createdAt: '2024-07-01T08:00:00.000Z' },
  { id: 'ay-2', year: '2025/2026', isCurrent: true, createdAt: '2025-07-01T08:00:00.000Z' },
];

export const ALL_CLASSES: ClassGrade[] = [
  'TK A',
  'TK B',
  'Kelas 1A',
  'Kelas 1 B',
  'Kelas 2A',
  'Kelas 2B',
  'Kelas 3A',
  'Kelas 3B',
  'Kelas 4A',
  'Kelas 4B',
  'Kelas 5A',
  'Kelas 5B',
  'Kelas 6A',
  'Kelas 6B',
];

export const initialUsers: User[] = [
  { id: 'u-dev', username: 'masdev', name: 'Mas Dev (Developer)', role: 'Developer', password: '@mimu123' },
  { id: 'u-demo', username: 'demo', name: 'Akun Demo (Read-Only)', role: 'Developer', password: '12345', demoMode: true },
  { id: 'u-demo-tk', username: 'demo-tk', name: 'Demo TK (Read-Only)', role: 'Developer', password: 'demotk123', demoMode: true, accessLevel: 'TK' },
  { id: 'u-demo-mi', username: 'demo-mi', name: 'Demo MI (Read-Only)', role: 'Developer', password: 'demomi123', demoMode: true, accessLevel: 'MI' },
  { id: 'u-super', username: 'kepsek', name: 'Dra. Endang Rahayu (Kepala Sekolah)', role: 'Super Admin' },
  { id: 'u-admin', username: 'bendahara', name: 'Budi Santoso, S.Pd (Bendahara)', role: 'Admin' },
  { id: 'u-wali1', username: 'walikelas1a', name: 'Siti Rahma, S.Pd (Wali Kelas 1A)', role: 'Wali Kelas', assignedClass: 'Kelas 1A' },
  { id: 'u-wali2', username: 'walikelas2a', name: 'Hendra Kusuma, S.Pd (Wali Kelas 2A)', role: 'Wali Kelas', assignedClass: 'Kelas 2A' },
  { id: 'u-viewer', username: 'orangtua', name: 'Orang Tua / Siswa (Ahmad Fauzi)', role: 'Viewer', studentId: 'st-7' },
];

const sampleStudentNames = [
  ['Aditya Pratama', 'Alya Nazifa', 'Aris Setiawan', 'Anindya Putri', 'Azka Alfarizi', 'Aura Kasih', 'Ahmad Fauzi'],
  ['Bagus Wardhana', 'Bening Sekar', 'Bintang Ramadhan', 'Bilal Firmansyah', 'Bella Saphira', 'Bryan Santoso', 'Bunga Citra'],
  ['Cakra Buana', 'Chintya Dewi', 'Candra Wijaya', 'Clara Shinta', 'Crisna Mukti', 'Cello Aliansyah', 'Cantika Putri'],
  ['Dafa Ibnu', 'Dian Sastrowardoyo', 'Dimas Anggara', 'Dinda Kirana', 'Doni Kusuma', 'Desi Ratnasari', 'Dewi Lestari'],
  ['Eko Prasetyo', 'Elvira Devinamira', 'Erlangga Putra', 'Eka Rahmawati', 'Evan Dimas', 'Ester Larasati', 'Endang Suherman'],
  ['Fahri Husaini', 'Fatimah Az-Zahra', 'Fathan Mubarak', 'Fiona Anjani', 'Faris Maulana', 'Fitri Carlina', 'Ferdinan Hidayat'],
  ['Gilang Dirga', 'Gisella Anastasia', 'Galang Rambu', 'Grace Natalie', 'Guruh Soekarno', 'Gita Gutawa', 'Ganesha Putra'],
  ['Haikal Kamil', 'Hana Saraswati', 'Hafiz Indonesia', 'Hesti Purwadinata', 'Hery Setiawan', 'Helena Yulia', 'Hendra Hendrawan'],
  ['Irfan Bachdim', 'Inul Daratista', 'Iqbaal Ramadhan', 'Indah Permatasari', 'Ibrahim Rasyid', 'Ika Nurjanah', 'Iwan Fals'],
  ['Jefri Nichol', 'Jessica Mila', 'Joko Susilo', 'Juwita Bahar', 'Jonathan Christie', 'Jasmine Larasati', 'Jordan Perkasa'],
  ['Kenzie Alvaro', 'Keysha Aurelia', 'Kevin Sanjaya', 'Kania Dewi', 'Kiki Rizky', 'Kartika Putri', 'Krisna Murti'],
  ['Luthfi Hasan', 'Luna Maya', 'Luki Wijaya', 'Laila Sari', 'Leo Consul', 'Listia Rahma', 'Lukman Sardi'],
  ['Muhammad Rizky', 'Maudy Ayunda', 'Marcell Darwin', 'Mulan Jameela', 'Mario Teguh', 'Maya Estianty', 'Mahendra Putra'],
  ['Naufal Samudra', 'Nabila Syakieb', 'Narendra Arya', 'Nia Ramadhani', 'Nicholas Saputra', 'Nadin Amizah', 'Novan Santoso'],
];

const parentFirstNames = ['Rahmat', 'Bambang', 'Hendra', 'Iwan', 'Kurniawan', 'Sutrisno', 'Agus', 'Widodo', 'Haryanto', 'Dedi', 'Budi', 'Joko', 'Tri', 'Ahmad'];
const parentLastNames = ['Hidayat', 'Soeprapto', 'Pratama', 'Lestari', 'Santoso', 'Wijaya', 'Kurniawan', 'Nugroho', 'Wibowo', 'Saputra', 'Setiawan', 'Utomo', 'Subagyo', 'Effendi'];

let studentCounter = 1;
export const initialStudents: Student[] = ALL_CLASSES.flatMap((classGrade, classIdx) => {
  const namesForClass = sampleStudentNames[classIdx % sampleStudentNames.length];
  return namesForClass.map((name, idx) => {
    const idNum = studentCounter++;
    const nis = `2025${String(idNum).padStart(3, '0')}`;
    const pName = `${parentFirstNames[(classIdx + idx) % parentFirstNames.length]} ${parentLastNames[(classIdx * 2 + idx) % parentLastNames.length]}`;
    const balanceAmounts = [185000, 320000, 4500, 550000, 75000, 120000, 250000];
    const bal = balanceAmounts[idx % balanceAmounts.length];

    return {
      id: `st-${idNum}`,
      nis,
      name,
      classGrade,
      status: 'Aktif' as const,
      academicYearId: 'ay-2',
      balance: bal,
      parentName: pName,
      phone: `0812${String(1000000 + idNum * 12345).slice(0, 8)}`,
      viewerPassword: idNum === 7 ? 'ahmad123' : undefined,
      viewerUsername: idNum === 7 ? 'ahmadfauzi' : undefined,
      createdAt: '2025-07-10T09:00:00.000Z',
    };
  });
});

export const initialBooks: Book[] = [
  { id: 'bk-1', title: 'LKS Bahasa Indonesia Kelas 1A', type: 'Koperasi', category: 'Buku', classGrade: 'Kelas 1A', price: 35000, stock: 100 },
  { id: 'bk-2', title: 'Seragam Olahraga Sekolah Lengkap', type: 'Koperasi', category: 'Seragam', classGrade: 'Semua Kelas', price: 120000, stock: 50 },
  { id: 'bk-3', title: 'Paket Alat Tulis & Buku Tulis (10 Pcs)', type: 'Koperasi', category: 'Alat Tulis', classGrade: 'Semua Kelas', price: 45000, stock: 80 },
  { id: 'bk-4', title: 'Buku Mewarnai & Mengenal Huruf', type: 'Koperasi', category: 'Buku', classGrade: 'TK A', price: 25000, stock: 60 },
  { id: 'kg-1', title: 'Outing Class Edukasi Taman Marga Satwa', type: 'Kegiatan', category: 'Outing Class', classGrade: 'Semua Kelas', price: 150000 },
  { id: 'kg-2', title: 'Outbound Leadership & Character Building', type: 'Kegiatan', category: 'Outbound', classGrade: 'Kelas 5A', price: 200000 },
  { id: 'kg-3', title: 'Pentas Seni & Gelar Karya P3', type: 'Kegiatan', category: 'Pentas Seni', classGrade: 'Semua Kelas', price: 75000 },
];

export const initialBookDistributions: BookDistribution[] = [
  { id: 'bd-1', itemId: 'bk-4', bookId: 'bk-4', studentId: 'st-7', received: true, receivedAt: '2026-07-15T10:00:00.000Z' },
  { id: 'bd-2', itemId: 'kg-1', bookId: 'kg-1', studentId: 'st-7', received: true, receivedAt: '2026-07-20T09:15:00.000Z' },
];

export const initialBookPayments: BookPayment[] = [
  {
    id: 'bp-1',
    transactionNumber: 'KK/2026/00001',
    itemId: 'bk-4',
    bookId: 'bk-4',
    itemTitle: 'Buku Mewarnai & Mengenal Huruf',
    bookTitle: 'Buku Mewarnai & Mengenal Huruf',
    itemType: 'Koperasi',
    category: 'Buku',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    amount: 25000,
    paymentMethod: 'Tunai',
    status: 'Disetujui',
    createdByName: 'Siti Rahma, S.Pd (Wali Kelas 1A)',
    createdAt: '2026-07-15T10:05:00.000Z',
    academicYearId: 'ay-2',
  },
  {
    id: 'bp-2',
    transactionNumber: 'KK/2026/00002',
    itemId: 'kg-1',
    bookId: 'kg-1',
    itemTitle: 'Outing Class Edukasi Taman Marga Satwa',
    bookTitle: 'Outing Class Edukasi Taman Marga Satwa',
    itemType: 'Kegiatan',
    category: 'Outing Class',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    amount: 150000,
    paymentMethod: 'Potong Tabungan',
    status: 'Menunggu Approval Super Admin',
    approvedByAdmin: true,
    approvedByAdminName: 'Siti Rahma, S.Pd (Wali Kelas 1A)',
    approvedBySuperAdmin: false,
    createdByName: 'Siti Rahma, S.Pd (Wali Kelas 1A)',
    createdAt: '2026-07-20T09:15:00.000Z',
    academicYearId: 'ay-2',
  },
];

export const initialTransactions: Transaction[] = [
  {
    id: 'tr-1',
    transactionNumber: 'ST/2026/00001',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    type: 'Setoran',
    amount: 100000,
    status: 'Disetujui',
    reason: 'Setoran Awal Tahun Ajaran',
    createdById: 'u-admin',
    createdByName: 'Budi Santoso, S.Pd',
    createdByRole: 'Admin',
    academicYearId: 'ay-2',
    createdAt: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 'tr-2',
    transactionNumber: 'ST/2026/00002',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    type: 'Setoran',
    amount: 86000,
    status: 'Disetujui',
    reason: 'Setoran Mingguan',
    createdById: 'u-admin',
    createdByName: 'Budi Santoso, S.Pd',
    createdByRole: 'Admin',
    academicYearId: 'ay-2',
    createdAt: '2026-07-17T11:20:00.000Z',
  },
  {
    id: 'tr-3',
    transactionNumber: 'ST/2026/00003',
    studentId: 'st-22',
    studentName: 'Siti Nurhaliza',
    studentNis: '2025022',
    classGrade: 'Kelas 1 B',
    type: 'Setoran',
    amount: 321000,
    status: 'Disetujui',
    reason: 'Setoran Orang Tua',
    createdById: 'u-admin',
    createdByName: 'Budi Santoso, S.Pd',
    createdByRole: 'Admin',
    academicYearId: 'ay-2',
    createdAt: '2026-07-18T08:45:00.000Z',
  },
  {
    id: 'tr-4',
    transactionNumber: 'ST/2026/00004',
    studentId: 'st-43',
    studentName: 'Dewi Lestari',
    studentNis: '2025043',
    classGrade: 'Kelas 3B',
    type: 'Penarikan',
    amount: 50000,
    status: 'Menunggu Persetujuan',
    reason: 'Pembelian Seragam Olahraga Tambahan',
    createdById: 'u-admin',
    createdByName: 'Budi Santoso, S.Pd',
    createdByRole: 'Admin',
    academicYearId: 'ay-2',
    createdAt: '2026-07-25T14:10:00.000Z',
  },
  {
    id: 'tr-5',
    transactionNumber: 'ST/2026/00005',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    type: 'Potongan Bulanan',
    amount: 1000,
    status: 'Disetujui',
    reason: 'Potongan Administrasi Bulanan Juli 2026',
    createdById: 'system',
    createdByName: 'Sistem Otomatis',
    createdByRole: 'Super Admin',
    academicYearId: 'ay-2',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

export const initialAuditLogs: AuditLogItem[] = [
  {
    id: 'log-1',
    userId: 'u-admin',
    userName: 'Budi Santoso, S.Pd',
    userRole: 'Admin',
    action: 'Setoran Tabungan',
    timestamp: '2026-07-10T10:00:00.000Z',
    valueBefore: 'Saldo: Rp 85.000',
    valueAfter: 'Saldo: Rp 185.000',
    details: 'Input setoran Rp 100.000 untuk siswa Ahmad Fauzi (NIS: 2025015)',
  },
  {
    id: 'log-2',
    userId: 'u-admin',
    userName: 'Budi Santoso, S.Pd',
    userRole: 'Admin',
    action: 'Pengajuan Penarikan',
    timestamp: '2026-07-25T14:10:00.000Z',
    valueBefore: 'Status: Draft',
    valueAfter: 'Status: Menunggu Persetujuan',
    details: 'Mengajukan potongan Rp 50.000 untuk Dewi Lestari (NIS: 2025043). Saldo belum berubah.',
  },
  {
    id: 'log-3',
    userId: 'u-super',
    userName: 'Dra. Endang Rahayu',
    userRole: 'Super Admin',
    action: 'Toggle Potongan Bulanan',
    timestamp: '2026-07-01T08:00:00.000Z',
    valueBefore: 'Potongan Bulanan: AKTIF',
    valueAfter: 'Potongan Bulanan: AKTIF',
    details: 'Mengecek status potongan bulanan otomatis.',
  },
];

export const initialSppPayments: SppPayment[] = [
  {
    id: 'spp-1',
    transactionNumber: 'SPP/2026/00001',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    amount: 50000,
    paymentMethod: 'Tunai',
    status: 'Disetujui',
    period: 'Juli 2026',
    createdByName: 'Budi Santoso, S.Pd',
    createdAt: '2026-07-10T10:00:00.000Z',
    academicYearId: 'ay-2',
  },
  {
    id: 'spp-2',
    transactionNumber: 'SPP/2026/00002',
    studentId: 'st-7',
    studentName: 'Ahmad Fauzi',
    studentNis: '2025007',
    classGrade: 'TK A',
    amount: 50000,
    paymentMethod: 'Potong Tabungan',
    status: 'Disetujui',
    period: 'Agustus 2026',
    createdByName: 'Budi Santoso, S.Pd',
    createdAt: '2026-07-15T10:00:00.000Z',
    academicYearId: 'ay-2',
  },
];
