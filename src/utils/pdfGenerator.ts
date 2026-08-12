/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, Transaction, SchoolSettings, BookPayment } from '../types';
import { formatRupiah, formatDate } from './format';

function getCityFromAddress(address: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : address.trim();
}

function cleanDisplayName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

// Helper to draw clean school header on PDF
function drawHeader(doc: jsPDF, school: SchoolSettings, title: string) {
  if (school.logoUrl) {
    const fmt = school.logoUrl.startsWith('data:image/png') ? 'PNG'
      : school.logoUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    try {
      doc.addImage(school.logoUrl, fmt, 14, 7, 20, 20);
    } catch {
      // logo gagal, abaikan
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(school.name.toUpperCase(), 105, 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(`${getCityFromAddress(school.address)} | Telp: ${school.phone}`, 105, 21, { align: 'center' });

  doc.setDrawColor(203, 213, 225); // Slate-300
  doc.setLineWidth(0.8);
  doc.line(14, 25, 196, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(title, 105, 33, { align: 'center' });
}

// 1. Generate Student Savings Certificate / Account Card (Cetak Bukti / Kartu Tabungan)
export function generateStudentCertificatePDF(
  student: Student,
  transactions: Transaction[],
  bookPayments: BookPayment[],
  school: SchoolSettings
) {
  const doc = new jsPDF();

  drawHeader(doc, school, 'KARTU BUKTI TABUNGAN SISWA');

  // Student Info Box
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);

  doc.text('INFORMASI SISWA', 14, 43);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  const studentInfo = [
    ['NIS', `: ${student.nis}`, 'Kelas', `: Kelas ${student.classGrade}`],
    ['Nama Siswa', `: ${student.name}`, 'Status', `: ${student.status}`],
    ['Orang Tua/Wali', `: ${student.parentName || '-'}`, 'Saldo Akhir', `: ${formatRupiah(student.balance)}`],
  ];

  autoTable(doc, {
    startY: 46,
    body: studentInfo,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', cellWidth: 25 },
      3: { cellWidth: 65, fontStyle: 'bold', textColor: [16, 185, 129] },
    },
  });

  // Table of Savings Transactions
  const finalY1 = (doc as any).lastAutoTable.finalY || 65;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text('RIWAYAT TRANSAKSI TABUNGAN', 14, finalY1 + 8);

  const tableData = transactions.map((t, index) => [
    (index + 1).toString(),
    t.transactionNumber,
    formatDate(t.createdAt),
    t.type,
    t.reason,
    t.status === 'Disetujui' ? formatRupiah(t.amount) : `${formatRupiah(t.amount)} (${t.status})`,
  ]);

  autoTable(doc, {
    startY: finalY1 + 11,
    head: [['No', 'No. Transaksi', 'Tanggal & Waktu', 'Jenis', 'Keterangan', 'Nominal']],
    body: tableData.length > 0 ? tableData : [['-', '-', 'Belum ada riwayat transaksi', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
  });

  // Footer Signature Block
  const finalY2 = (doc as any).lastAutoTable.finalY || 150;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const todayStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());

  doc.text(`Dicetak pada: ${todayStr}`, 14, Math.min(finalY2 + 20, 270));
  doc.text('Petugas / Bendahara Sekolah,', 140, Math.min(finalY2 + 20, 270));
  doc.text('( ______________________ )', 140, Math.min(finalY2 + 40, 280));

  doc.save(`Tabungan_${student.nis}_${student.name.replace(/\s+/g, '_')}.pdf`);
}

// 2. Generate Transaction Receipt PDF (Kuitansi Setoran / Penarikan)
export function generateTransactionReceiptPDF(transaction: Transaction, school: SchoolSettings) {
  const doc = new jsPDF({
    format: [210, 148], // A5 Landscape
    orientation: 'landscape',
  });

  drawHeader(doc, school, `BUKTI TRANSAKSI ${transaction.type.toUpperCase()}`);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`No. Transaksi: ${transaction.transactionNumber}`, 14, 42);

  const receiptBody = [
    ['Telah terima dari/untuk', `: ${transaction.studentName} (NIS: ${transaction.studentNis} / Kelas ${transaction.classGrade})`],
    ['Jenis Transaksi', `: ${transaction.type}`],
    ['Nominal', `: ${formatRupiah(transaction.amount)}`],
    ['Status Transaksi', `: ${transaction.status}`],
    ['Keterangan', `: ${transaction.reason}`],
    ['Petugas Input', `: ${cleanDisplayName(transaction.createdByName)}`],
    ['Tanggal & Waktu', `: ${formatDate(transaction.createdAt)}`],
  ];

  autoTable(doc, {
    startY: 46,
    body: receiptBody,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 130 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 100;
  const todayStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${getCityFromAddress(school.address)}, ${todayStr}`, 140, finalY + 10);
  doc.text('Petugas Keuangan,', 140, finalY + 16);
  doc.text(`( ${cleanDisplayName(transaction.createdByName)} )`, 140, finalY + 32);

  doc.save(`Kuitansi_${transaction.transactionNumber.replace(/\//g, '-')}.pdf`);
}

// 2b. Generate Viewer Credential Slip (Slip Akun Login Orang Tua)
export interface ViewerCredentialSlipData {
  studentName: string;
  nis: string;
  classGrade: string;
  username: string;
  initialCode: string;
}

function drawCredentialSlip(doc: jsPDF, data: ViewerCredentialSlipData, school: SchoolSettings) {
  drawHeader(doc, school, 'SLIP AKUN LOGIN ORANG TUA');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  const infoBody = [
    ['Nama Siswa', `: ${data.studentName}`],
    ['NIS', `: ${data.nis}`],
    ['Kelas', `: ${data.classGrade}`],
  ];

  autoTable(doc, {
    startY: 42,
    body: infoBody,
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30 },
      1: { cellWidth: 150 },
    },
  });

  const afterInfoY = (doc as any).lastAutoTable.finalY || 60;

  // Boxed credentials — dibuat besar & jelas biar mudah dibaca/diketik ulang ortu.
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, afterInfoY + 4, 182, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('USERNAME', 22, afterInfoY + 12);
  doc.text('KODE AWAL (PASSWORD)', 110, afterInfoY + 12);

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(data.username, 22, afterInfoY + 22);
  doc.text(data.initialCode, 110, afterInfoY + 22);

  const instructY = afterInfoY + 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Cara Login:', 14, instructY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const steps = [
    '1. Buka portal orang tua, pilih menu login orang tua/siswa.',
    '2. Ketik nama anak (min. 3 huruf) — pilih nama yang muncul di saran.',
    '3. Masukkan Kode Awal di atas sebagai password.',
    '4. Sistem akan minta ganti password baru — buat password sendiri yang mudah diingat.',
    '5. Lupa password nanti? Klik "Lupa Password?" di halaman login, atau minta bantuan ke sekolah.',
  ];
  steps.forEach((line, i) => doc.text(line, 14, instructY + 6 + i * 5.5));

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Simpan slip ini baik-baik sampai selesai ganti password.', 14, instructY + 6 + steps.length * 5.5 + 6);
}

export function generateViewerCredentialSlip(data: ViewerCredentialSlipData, school: SchoolSettings) {
  const doc = new jsPDF({ format: [210, 148], orientation: 'landscape' });
  drawCredentialSlip(doc, data, school);
  doc.save(`Slip_Akun_Ortu_${data.nis}_${data.studentName.replace(/\s+/g, '_')}.pdf`);
}

export function generateViewerCredentialSlipBatch(dataList: ViewerCredentialSlipData[], school: SchoolSettings) {
  const doc = new jsPDF({ format: [210, 148], orientation: 'landscape' });
  dataList.forEach((data, idx) => {
    if (idx > 0) doc.addPage([210, 148], 'landscape');
    drawCredentialSlip(doc, data, school);
  });
  doc.save(`Slip_Akun_Ortu_Massal_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// 3. Generate General Financial Report PDF
export function generateReportPDF(
  title: string,
  transactions: Transaction[],
  school: SchoolSettings,
  totalDeposit: number,
  totalWithdrawal: number,
  academicYearStr: string
) {
  const doc = new jsPDF();

  drawHeader(doc, school, title.toUpperCase());

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tahun Ajaran: ${academicYearStr}`, 14, 42);
  doc.text(`Total Setoran: ${formatRupiah(totalDeposit)}`, 14, 47);
  doc.text(`Total Penarikan: ${formatRupiah(totalWithdrawal)}`, 100, 47);

  const rows = transactions.map((t, idx) => [
    (idx + 1).toString(),
    t.transactionNumber,
    t.studentName,
    `Kelas ${t.classGrade}`,
    t.type,
    formatRupiah(t.amount),
    t.status,
    formatDate(t.createdAt),
  ]);

  autoTable(doc, {
    startY: 52,
    head: [['No', 'No. Transaksi', 'Nama Siswa', 'Kelas', 'Jenis', 'Nominal', 'Status', 'Tanggal']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 180;
  const todayStr = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date());

  doc.setFontSize(9);
  doc.text(`Tanggal Cetak: ${todayStr}`, 14, Math.min(finalY + 15, 270));
  doc.text('Kepala Sekolah / Bendahara,', 140, Math.min(finalY + 15, 270));
  doc.text('( ______________________ )', 140, Math.min(finalY + 35, 280));

  doc.save(`Laporan_Keuangan_${new Date().toISOString().slice(0, 10)}.pdf`);
}
