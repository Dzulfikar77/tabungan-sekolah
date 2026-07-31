/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { Student, ClassGrade, StudentStatus, Transaction } from '../types';
import { ALL_CLASSES } from './initialData';
import { formatRupiah, formatDate } from './format';

// 1. Export Excel Template for Bulk Student Import
export function downloadStudentImportTemplate() {
  const templateData = [
    {
      NIS: '2025010',
      'Nama Lengkap': 'Ahmad Zaky',
      Kelas: 'TK A',
      Status: 'Aktif',
      'Nama Orang Tua': 'Budi Santoso',
      'No. Telepon': '08123456789',
      'Saldo Awal': 25000,
    },
    {
      NIS: '2025011',
      'Nama Lengkap': 'Citra Kirana',
      Kelas: 'TK B',
      Status: 'Aktif',
      'Nama Orang Tua': 'Hendra Kirana',
      'No. Telepon': '08139988776',
      'Saldo Awal': 30000,
    },
    {
      NIS: '2025012',
      'Nama Lengkap': 'Dewi Lestari',
      Kelas: 'Kelas 1A',
      Status: 'Aktif',
      'Nama Orang Tua': 'Sutrisno Wibowo',
      'No. Telepon': '081200011122',
      'Saldo Awal': 50000,
    },
    {
      NIS: '2025013',
      'Nama Lengkap': 'Eka Rahmawati',
      Kelas: 'Kelas 1 B',
      Status: 'Aktif',
      'Nama Orang Tua': 'Agus Setiawan',
      'No. Telepon': '081299988877',
      'Saldo Awal': 50000,
    },
    {
      NIS: '2025014',
      'Nama Lengkap': 'Fathan Mubarak',
      Kelas: 'Kelas 6A',
      Status: 'Aktif',
      'Nama Orang Tua': 'Widodo Nugroho',
      'No. Telepon': '081288877766',
      'Saldo Awal': 120000,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 8 },
    { wch: 20 }, { wch: 16 }, { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');

  const classRef = ALL_CLASSES.map((cls) => ({ Kelas: cls }));
  const refSheet = XLSX.utils.json_to_sheet(classRef);
  refSheet['!cols'] = [{ wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, refSheet, 'Daftar Kelas Valid');

  const statusRef = (['Aktif', 'Lulus', 'Pindah', 'Keluar'] as const).map((s) => ({ Status: s }));
  const statusSheet = XLSX.utils.json_to_sheet(statusRef);
  statusSheet['!cols'] = [{ wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, statusSheet, 'Daftar Status Valid');

  XLSX.writeFile(workbook, 'Template_Import_Siswa.xlsx');
}

// 2. Parse Excel File for Students
export function parseStudentsExcel(
  file: File,
  currentAcademicYearId: string
): Promise<{ validStudents: Partial<Student>[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const validStudents: Partial<Student>[] = [];
        const errors: string[] = [];

        const validClasses: ClassGrade[] = ALL_CLASSES;
        const validStatuses: StudentStatus[] = ['Aktif', 'Lulus', 'Pindah', 'Keluar'];

        json.forEach((row, idx) => {
          const rowNum = idx + 2;
          const nis = row['NIS'] ? String(row['NIS']).trim() : '';
          const name = row['Nama Lengkap'] ? String(row['Nama Lengkap']).trim() : '';
          const classGradeRaw = row['Kelas'] ? String(row['Kelas']).trim() : '';
          const statusRaw = row['Status'] ? String(row['Status']).trim() : '';
          const parentName = row['Nama Orang Tua'] ? String(row['Nama Orang Tua']).trim() : '';
          const phone = row['No. Telepon'] ? String(row['No. Telepon']).trim() : '';
          const initialBalance = row['Saldo Awal'] ? Number(row['Saldo Awal']) : 0;

          if (!nis) {
            errors.push(`Baris ${rowNum}: NIS wajib diisi.`);
            return;
          }
          if (!name) {
            errors.push(`Baris ${rowNum}: Nama Lengkap wajib diisi.`);
            return;
          }
          if (!classGradeRaw) {
            errors.push(`Baris ${rowNum}: Kelas wajib diisi. Lihat sheet "Daftar Kelas Valid".`);
            return;
          }
          if (!validClasses.includes(classGradeRaw as ClassGrade)) {
            errors.push(`Baris ${rowNum}: Kelas "${classGradeRaw}" tidak valid. Lihat sheet "Daftar Kelas Valid".`);
            return;
          }

          const status = validStatuses.includes(statusRaw as StudentStatus)
            ? (statusRaw as StudentStatus)
            : 'Aktif';

          validStudents.push({
            nis,
            name,
            classGrade: classGradeRaw as ClassGrade,
            status,
            parentName,
            phone,
            balance: isNaN(initialBalance) ? 0 : initialBalance,
            academicYearId: currentAcademicYearId,
          });
        });

        resolve({ validStudents, errors });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// 3. Export Financial Report to Excel
export function exportReportToExcel(title: string, transactions: Transaction[]) {
  const data = transactions.map((t, idx) => ({
    No: idx + 1,
    'No Transaksi': t.transactionNumber,
    NIS: t.studentNis,
    'Nama Siswa': t.studentName,
    Kelas: t.classGrade,
    'Jenis Transaksi': t.type,
    'Nominal (Rp)': t.amount,
    Status: t.status,
    Keterangan: t.reason,
    Petugas: t.createdByName,
    'Tanggal Transaksi': formatDate(t.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Keuangan');

  XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
