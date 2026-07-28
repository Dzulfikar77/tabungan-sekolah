/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { Student, ClassGrade, Transaction } from '../types';
import { ALL_CLASSES } from './initialData';
import { formatRupiah, formatDate } from './format';

// 1. Export Excel Template for Bulk Student Import
export function downloadStudentImportTemplate() {
  const templateData = [
    {
      NIS: '2025010',
      'Nama Lengkap': 'Ahmad Zaky',
      Kelas: '1',
      'Nama Orang Tua': 'Budi Santoso',
      'No. Telepon': '08123456789',
      'Saldo Awal': 50000,
    },
    {
      NIS: '2025011',
      'Nama Lengkap': 'Citra Kirana',
      Kelas: '2',
      'Nama Orang Tua': 'Hendra Kirana',
      'No. Telepon': '08139988776',
      'Saldo Awal': 100000,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Siswa');
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

        json.forEach((row, idx) => {
          const rowNum = idx + 2;
          const nis = row['NIS'] ? String(row['NIS']).trim() : '';
          const name = row['Nama Lengkap'] ? String(row['Nama Lengkap']).trim() : '';
          const classGradeRaw = row['Kelas'] ? String(row['Kelas']).trim() : 'Kelas 1A';
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

          const validClasses: ClassGrade[] = ALL_CLASSES;
          const classGrade = validClasses.includes(classGradeRaw as ClassGrade)
            ? (classGradeRaw as ClassGrade)
            : 'Kelas 1A';

          validStudents.push({
            nis,
            name,
            classGrade,
            status: 'Aktif',
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
