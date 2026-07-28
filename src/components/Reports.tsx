/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDate } from '../utils/format';
import { generateReportPDF } from '../utils/pdfGenerator';
import { exportReportToExcel } from '../utils/excelHandler';
import { ClassGrade } from '../types';
import { ALL_CLASSES } from '../utils/initialData';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { transactions, students, currentAcademicYear, schoolSettings } = useApp();

  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan'>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [studentFilter, setStudentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('Disetujui');

  const classes = ALL_CLASSES;

  const activeStudents = students.filter((s) => !s.isDeleted);

  // Filter transactions
  const now = new Date();
  const filteredTransactions = transactions.filter((t) => {
    if (t.academicYearId !== currentAcademicYear.id) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (classFilter !== 'ALL' && t.classGrade !== classFilter) return false;
    if (studentFilter !== 'ALL' && t.studentId !== studentFilter) return false;

    const txDate = new Date(t.createdAt);

    if (periodFilter === 'Harian') {
      return txDate.toDateString() === now.toDateString();
    }
    if (periodFilter === 'Mingguan') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return txDate >= oneWeekAgo;
    }
    if (periodFilter === 'Bulanan') {
      return (
        txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      );
    }
    if (periodFilter === 'Tahunan') {
      return txDate.getFullYear() === now.getFullYear();
    }

    return true;
  });

  const totalDeposits = filteredTransactions
    .filter((t) => t.type === 'Setoran' && t.status === 'Disetujui')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = filteredTransactions
    .filter((t) => (t.type === 'Penarikan' || t.type === 'Potongan Bulanan') && t.status === 'Disetujui')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalDeposits - totalWithdrawals;

  const handleExportPDF = () => {
    generateReportPDF(
      `Laporan Keuangan Tabungan (${periodFilter})`,
      filteredTransactions,
      schoolSettings,
      totalDeposits,
      totalWithdrawals,
      currentAcademicYear.year
    );
  };

  const handleExportExcel = () => {
    exportReportToExcel(`Laporan_Tabungan_${periodFilter}`, filteredTransactions);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Laporan Keuangan Realtime
          </h2>
          <p className="text-xs text-slate-500">
            Tahun Ajaran {currentAcademicYear.year} • Filter & Cetak Laporan Resmi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-emerald-400" /> Cetak PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" /> Ekspor Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Setoran</p>
            <h3 className="text-lg font-extrabold text-emerald-600">{formatRupiah(totalDeposits)}</h3>
          </div>
          <ArrowUpRight className="w-6 h-6 text-emerald-500" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Penarikan</p>
            <h3 className="text-lg font-extrabold text-rose-600">{formatRupiah(totalWithdrawals)}</h3>
          </div>
          <ArrowDownRight className="w-6 h-6 text-rose-500" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Arus Kas Bersih (Net)</p>
            <h3 className={`text-lg font-extrabold ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {formatRupiah(netBalance)}
            </h3>
          </div>
          <PieChart className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Filter className="w-4 h-4 text-emerald-600" /> Filter:
        </div>

        {/* Periode */}
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as any)}
          className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium focus:outline-none cursor-pointer"
        >
          <option value="ALL">Semua Waktu</option>
          <option value="Harian">Harian (Hari Ini)</option>
          <option value="Mingguan">Mingguan (7 Hari Terakhir)</option>
          <option value="Bulanan">Bulanan (Bulan Ini)</option>
          <option value="Tahunan">Tahunan (Tahun Ini)</option>
        </select>

        {/* Kelas */}
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium focus:outline-none cursor-pointer"
        >
          <option value="ALL">Semua Kelas</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              Kelas {c}
            </option>
          ))}
        </select>

        {/* Siswa */}
        <select
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium focus:outline-none cursor-pointer max-w-xs"
        >
          <option value="ALL">Semua Siswa</option>
          {activeStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.nis})
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium focus:outline-none cursor-pointer"
        >
          <option value="Disetujui">Hanya Status Disetujui</option>
          <option value="Menunggu Persetujuan">Pending Approval</option>
          <option value="Ditolak">Ditolak</option>
          <option value="ALL">Semua Status</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3">
          Rincian Transaksi ({filteredTransactions.length} Data Found)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">No. Transaksi</th>
                <th className="py-2.5 px-3">Nama Siswa</th>
                <th className="py-2.5 px-3">Kelas</th>
                <th className="py-2.5 px-3">Jenis</th>
                <th className="py-2.5 px-3">Nominal</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Petugas</th>
                <th className="py-2.5 px-3">Tanggal & Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Tidak ada transaksi sesuai filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{t.transactionNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{t.studentName}</td>
                    <td className="py-2.5 px-3 text-slate-600">Kelas {t.classGrade}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{t.type}</td>
                    <td
                      className={`py-2.5 px-3 font-extrabold ${
                        t.type === 'Setoran' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {t.type === 'Setoran' ? '+' : '-'}{formatRupiah(t.amount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'Menunggu Persetujuan'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{t.createdByName}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{formatDate(t.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
