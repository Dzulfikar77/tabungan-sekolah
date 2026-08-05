/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDate, filterByAccessLevel } from '../utils/format';
import { MonthlyDeductionSummary, ClassGrade } from '../types';
import { ALL_CLASSES } from '../utils/initialData';
import {
  Wallet,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Play,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    currentUser,
    students,
    transactions,
    schoolSettings,
    currentAcademicYear,
    toggleMonthlyDeduction,
    runMonthlyDeduction,
    approveWithdrawal,
    rejectWithdrawal,
    sppPayments,
  } = useApp();

  const [deductionSummary, setDeductionSummary] = useState<MonthlyDeductionSummary | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Active students in current academic year
  const activeStudents = filterByAccessLevel(students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  ), currentUser);

  const totalSavings = activeStudents.reduce((sum, s) => sum + s.balance, 0);

  const TK_CLASSES: ClassGrade[] = ['TK A', 'TK B'];
  const tkSavings = activeStudents
    .filter((s) => TK_CLASSES.includes(s.classGrade))
    .reduce((sum, s) => sum + s.balance, 0);
  const tkCount = activeStudents.filter((s) => TK_CLASSES.includes(s.classGrade)).length;
  const miSavings = activeStudents
    .filter((s) => !TK_CLASSES.includes(s.classGrade))
    .reduce((sum, s) => sum + s.balance, 0);
  const miCount = activeStudents.filter((s) => !TK_CLASSES.includes(s.classGrade)).length;

  // Filter transactions in current academic year
  const yearTransactions = transactions.filter(
    (t) => t.academicYearId === currentAcademicYear.id
  );

  const totalDeposits = yearTransactions
    .filter((t) => t.type === 'Setoran' && t.status === 'Disetujui')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalWithdrawals = yearTransactions
    .filter((t) => (t.type === 'Penarikan' || t.type === 'Potongan Bulanan') && t.status === 'Disetujui')
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingApprovals = yearTransactions.filter(
    (t) => t.status === 'Menunggu Persetujuan'
  );

  // Class Balance Breakdown
  const classes = ALL_CLASSES;
  const classBalances = classes.map((cls) => {
    const list = activeStudents.filter((s) => s.classGrade === cls);
    const sum = list.reduce((acc, s) => acc + s.balance, 0);
    return { classGrade: cls, count: list.length, balance: sum };
  });

  const handleRunDeductionNow = async () => {
    const amount = schoolSettings.monthlyDeductionAmount || 2000;
    if (confirm(`Apakah Anda yakin ingin menjalankan Potongan Bulanan Otomatis (Rp ${amount.toLocaleString('id-ID')}) sekarang untuk semua siswa aktif? Siswa dengan saldo kurang akan dicatat sebagai tunggakan.`)) {
      const summary = await runMonthlyDeduction();
      setDeductionSummary(summary);
      setSummaryModalOpen(true);
    }
  };

  const handleApprove = async (txId: string) => {
    const res = await approveWithdrawal(txId);
    if (!res.success) {
      alert(res.error);
    }
  };

  const handleConfirmReject = async () => {
    if (rejectingTxId) {
      await rejectWithdrawal(rejectingTxId, rejectReason || 'Ditolak dari Dashboard');
      setRejectingTxId(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2">
            Tahun Ajaran {currentAcademicYear.year}
          </span>
          <h2 className="text-xl font-bold">
            Selamat Datang, {currentUser.name}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Hak Akses: <strong className="text-emerald-400">{currentUser.role}</strong> | Sistem Manajemen Keuangan & Tabungan Siswa
          </p>
        </div>

        {/* Quick Info Badge */}
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
          <div className="text-xs">
            <div className="text-slate-300">Akurasi & Pertanggungjawaban</div>
            <div className="font-bold text-white">100% Audit Trail Realtime</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tabungan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Total Saldo Tabungan</p>
            <h3 className="text-xl font-extrabold text-slate-900">{formatRupiah(totalSavings)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">{activeStudents.length} Siswa Aktif</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Tabungan TK */}
        <div className="bg-white p-5 rounded-2xl border border-pink-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-pink-500 mb-1">Tabungan TK</p>
            <h3 className="text-xl font-extrabold text-pink-900">{formatRupiah(tkSavings)}</h3>
            <p className="text-[11px] text-pink-400 mt-1">{tkCount} Siswa TK</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Tabungan MI */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-blue-500 mb-1">Tabungan MI</p>
            <h3 className="text-xl font-extrabold text-blue-900">{formatRupiah(miSavings)}</h3>
            <p className="text-[11px] text-blue-400 mt-1">{miCount} Siswa MI</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Siswa */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Siswa Terdaftar</p>
            <h3 className="text-xl font-extrabold text-slate-900">{activeStudents.length} Siswa</h3>
            <p className="text-[11px] text-slate-400 mt-1">Aktif di Tahun Ajaran ini</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Setoran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Total Setoran Disetujui</p>
            <h3 className="text-xl font-extrabold text-emerald-600">{formatRupiah(totalDeposits)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Akumulasi tahun ini</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Total Penarikan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Total Penarikan Disetujui</p>
            <h3 className="text-xl font-extrabold text-rose-600">{formatRupiah(totalWithdrawals)}</h3>
            <p className="text-[11px] text-slate-400 mt-1">Selesai disetujui</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid: Pending Approvals & Monthly Deduction Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-sm">
                Pengajuan Penarikan Menunggu Persetujuan
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {pendingApprovals.length} Pengajuan
            </span>
          </div>

          {/* Critical Rule Banner */}
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Aturan Keamanan Saldo:</strong> Selama status pengajuan masih
              <span className="font-semibold text-amber-800"> "Menunggu Persetujuan"</span>, saldo tabungan siswa <strong>TIDAK BERUBAH SAMA SEKALI</strong>. Saldo baru akan berkurang otomatis setelah disetujui oleh Super Admin / Developer.
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Tidak ada pengajuan penarikan yang menggantung. Semua transaksi telah diproses.
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {pendingApprovals.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {tx.studentName} <span className="text-slate-500 font-normal">({tx.studentNis} / Kelas {tx.classGrade})</span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      No: <span className="font-semibold text-slate-700">{tx.transactionNumber}</span> | Alasan: "{tx.reason}"
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Diajukan oleh: {tx.createdByName} ({tx.createdByRole}) • {formatDate(tx.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-rose-600">
                        -{formatRupiah(tx.amount)}
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {tx.status}
                      </span>
                    </div>

                    {(currentUser.role === 'Super Admin' || currentUser.role === 'Developer') && (
                      <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                        <button
                          onClick={() => handleApprove(tx.id)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Setujui
                        </button>
                        <button
                          onClick={() => setRejectingTxId(tx.id)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Deduction Control Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Potongan Bulanan Otomatis
              </h3>
              <button
                onClick={() => toggleMonthlyDeduction(!schoolSettings.monthlyDeductionEnabled)}
                className="cursor-pointer transition-transform hover:scale-105"
                title="Toggle Otomatis Rutin Awal Bulan"
              >
                {schoolSettings.monthlyDeductionEnabled ? (
                  <ToggleRight className="w-9 h-9 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-9 h-9 text-slate-300" />
                )}
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs mb-4">
              <div className="flex justify-between text-slate-600">
                <span>Status Fitur:</span>
                <span
                  className={`font-bold ${
                    schoolSettings.monthlyDeductionEnabled ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {schoolSettings.monthlyDeductionEnabled ? 'AKTIF (Setiap Tgl 28)' : 'NON-AKTIF'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Nominal Potongan:</span>
                <span className="font-bold text-slate-800">
                  {formatRupiah(schoolSettings.monthlyDeductionAmount || 2000)} / siswa
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
              <strong>Aturan Eksekusi:</strong> Semua siswa aktif dipotong Rp {formatRupiah(schoolSettings.monthlyDeductionAmount || 2000)} setiap tanggal 28. Jika saldo tidak mencukupi, akan tercatat sebagai tunggakan dan dipotong otomatis saat saldo terisi.
            </p>
          </div>

          <button
            onClick={handleRunDeductionNow}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Play className="w-4 h-4 text-emerald-400" />
            Jalankan Potongan Sekarang
          </button>
        </div>
      </div>

      {/* Class Balances Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <Building className="w-4 h-4 text-blue-600" />
          Rincian Saldo Tabungan Per Kelas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {classBalances.map((cb) => (
            <div
              key={cb.classGrade}
              className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center"
            >
              <div className="text-xs font-bold text-slate-500 mb-1">Kelas {cb.classGrade}</div>
              <div className="text-sm font-extrabold text-slate-900">
                {formatRupiah(cb.balance)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">{cb.count} Siswa</div>
            </div>
          ))}
        </div>
      </div>

      {/* SPP Unpaid List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <span className="text-rose-500">●</span>
          Siswa Belum Bayar SPP
          <span className="text-[10px] text-slate-400 font-normal ml-auto">
            Periode: {
              (() => {
                const now = new Date();
                const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                return `${months[now.getMonth()]} ${now.getFullYear()}`;
              })()
            }
          </span>
        </h3>

        {(() => {
          const now = new Date();
          const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          const currentPeriod = `${months[now.getMonth()]} ${now.getFullYear()}`;
          const paidStudentIds = new Set(
            sppPayments.filter((sp) => sp.period === currentPeriod).map((sp) => sp.studentId)
          );
          const unpaidStudents = activeStudents.filter((s) => {
            if (paidStudentIds.has(s.id)) return false;
            const isMI = ['Kelas 1A','Kelas 1 B','Kelas 2A','Kelas 2B','Kelas 3A','Kelas 3B','Kelas 4A','Kelas 4B','Kelas 5A','Kelas 5B','Kelas 6A','Kelas 6B'].includes(s.classGrade);
            if (isMI && (!schoolSettings.sppSDAmount || schoolSettings.sppSDAmount === 0)) return false;
            return true;
          });

          const tkStudents = unpaidStudents.filter((s) => s.classGrade === 'TK A' || s.classGrade === 'TK B');
          const miStudents = unpaidStudents.filter((s) =>
            ['Kelas 1A','Kelas 1 B','Kelas 2A','Kelas 2B','Kelas 3A','Kelas 3B','Kelas 4A','Kelas 4B','Kelas 5A','Kelas 5B','Kelas 6A','Kelas 6B'].includes(s.classGrade)
          );

          const groupByClass = (studentsList: typeof activeStudents) => {
            const groups: Record<string, typeof activeStudents> = {};
            studentsList.forEach((s) => {
              if (!groups[s.classGrade]) groups[s.classGrade] = [];
              groups[s.classGrade].push(s);
            });
            return groups;
          };

          const tkGroups = groupByClass(tkStudents);
          const miGroups = groupByClass(miStudents);

          if (unpaidStudents.length === 0) {
            return <div className="text-center py-6 text-xs text-emerald-600 font-semibold bg-emerald-50 rounded-xl">Semua siswa sudah membayar SPP periode ini! </div>;
          }

          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* TK Section */}
              <div>
                <h4 className="font-bold text-pink-700 text-xs mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-500 inline-block"></span>
                  TK ({tkStudents.length} belum bayar)
                </h4>
                {Object.keys(tkGroups).length === 0 ? (
                  <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 text-center">Semua siswa TK sudah lunas</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(tkGroups).map(([cls, students]) => (
                      <div key={cls} className="bg-pink-50 rounded-xl border border-pink-200 p-3">
                        <div className="text-[11px] font-bold text-pink-800 mb-1.5">Kelas {cls}</div>
                        <div className="space-y-1">
                          {students.map((s) => (
                            <div key={s.id} className="flex justify-between text-xs text-pink-900 bg-white/70 rounded-lg px-2.5 py-1.5">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-pink-600">{s.nis}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MI Section */}
              <div>
                <h4 className="font-bold text-blue-700 text-xs mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                  MI ({miStudents.length} belum bayar)
                </h4>
                {Object.keys(miGroups).length === 0 ? (
                  <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 text-center">Semua siswa MI sudah lunas</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(miGroups).map(([cls, students]) => (
                      <div key={cls} className="bg-blue-50 rounded-xl border border-blue-200 p-3">
                        <div className="text-[11px] font-bold text-blue-800 mb-1.5">Kelas {cls}</div>
                        <div className="space-y-1">
                          {students.map((s) => (
                            <div key={s.id} className="flex justify-between text-xs text-blue-900 bg-white/70 rounded-lg px-2.5 py-1.5">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-blue-600">{s.nis}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Rejection Modal */}
      {rejectingTxId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Alasan Penolakan Penarikan</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Masukkan alasan penolakan untuk dicatat pada log audit..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingTxId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Deduction Summary Modal */}
      {summaryModalOpen && deductionSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Hasil Eksekusi Potongan Bulanan</h3>
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-emerald-800 font-medium">Siswa Dipotong</div>
                <div className="text-lg font-bold text-emerald-900">
                  {deductionSummary.totalStudentsDeducted} Siswa
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  Total Dana: {formatRupiah(deductionSummary.totalAmountDeducted)}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="text-amber-800 font-medium">Tunggakan</div>
                <div className="text-lg font-bold text-amber-900">
                  {deductionSummary.pendingDebtStudents?.length || 0} Siswa
                </div>
                <div className="text-[11px] text-amber-700 mt-1">Saldo kurang, masuk tunggakan</div>
              </div>
            </div>

            {(deductionSummary.pendingDebtStudents?.length > 0 || deductionSummary.skippedStudents.length > 0) && (
              <div>
                {deductionSummary.pendingDebtStudents?.length > 0 && (
                  <>
                    <h4 className="font-bold text-slate-800 text-xs mb-2">Tunggakan yang Tertunda:</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-xs mb-3">
                      {deductionSummary.pendingDebtStudents.map((s) => (
                        <div
                          key={s.id}
                          className="p-2 bg-amber-50 rounded-lg flex justify-between text-amber-800"
                        >
                          <span>
                            {s.name} ({s.nis})
                          </span>
                          <span className="font-semibold">
                            Utang: {formatRupiah(s.debt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {deductionSummary.skippedStudents.length > 0 && (
                  <>
                    <h4 className="font-bold text-slate-800 text-xs mb-2">Siswa Dilewati (Saldo 0):</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                      {deductionSummary.skippedStudents.map((s) => (
                        <div
                          key={s.id}
                          className="p-2 bg-slate-50 rounded-lg flex justify-between text-slate-600"
                        >
                          <span>
                            {s.name} ({s.nis})
                          </span>
                          <span className="font-semibold text-slate-800">
                            {formatRupiah(s.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => setSummaryModalOpen(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl cursor-pointer"
            >
              Tutup Ringkasan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
