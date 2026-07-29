/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatNumberInput, parseFormattedNumber, formatDate, filterByAccessLevel } from '../utils/format';
import { generateTransactionReceiptPDF } from '../utils/pdfGenerator';
import { ALL_CLASSES } from '../utils/initialData';
import {
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Search,
  UserCheck,
  AlertCircle,
  Printer,
  History,
  Filter,
} from 'lucide-react';

export const WithdrawalForm: React.FC = () => {
  const {
    students,
    requestWithdrawal,
    approveWithdrawal,
    rejectWithdrawal,
    transactions,
    currentAcademicYear,
    currentUser,
    schoolSettings,
  } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [formattedAmountInput, setFormattedAmountInput] = useState('5.000');
  const [reason, setReason] = useState('Pengambilan Tabungan');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');

  const NOMINAL_PRESETS = [2000, 5000, 10000, 15000, 20000, 25000];

  const activeStudents = filterByAccessLevel(students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  ), currentUser);

  const filteredStudents = activeStudents.filter((s) => {
    const matchesClass = selectedClass === 'ALL' || s.classGrade === selectedClass;
    const matchesSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.nis.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const selectedStudent = activeStudents.find((s) => s.id === selectedStudentId);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatNumberInput(rawVal);
    setFormattedAmountInput(formatted);
  };

  const handlePresetClick = (amount: number) => {
    const formatted = formatNumberInput(amount.toString());
    setFormattedAmountInput(formatted);
    setErrorMessage('');
  };

  const handleWithdrawalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMsg('');

    if (!selectedStudentId) {
      setErrorMessage('Silakan pilih siswa terlebih dahulu.');
      return;
    }

    const numAmount = parseFormattedNumber(formattedAmountInput);
    if (numAmount <= 0) {
      setErrorMessage('Nominal potongan harus lebih besar dari Rp 0.');
      return;
    }

    if (selectedStudent && numAmount > selectedStudent.balance) {
      setErrorMessage(
        `Saldo tabungan siswa (${formatRupiah(selectedStudent.balance)}) tidak mencukupi untuk penarikan ${formatRupiah(numAmount)}.`
      );
      return;
    }

    const res = requestWithdrawal(selectedStudentId, numAmount, reason || 'Penarikan Tabungan');

    if (!res.success) {
      setErrorMessage(res.error || 'Gagal mengajukan potongan.');
    } else {
      setSuccessMsg(
        `Pengajuan penarikan ${formatRupiah(
          numAmount
        )} berhasil dikirim dengan status "Menunggu Persetujuan". Saldo siswa TETAP SAMA sampai disetujui Kepala Sekolah.`
      );
      setFormattedAmountInput('5.000');
      setReason('Pengambilan Tabungan');
    }
  };

  const handleApprove = (txId: string) => {
    const res = approveWithdrawal(txId);
    if (!res.success) {
      alert(res.error);
    }
  };

  const handleConfirmReject = () => {
    if (rejectingTxId) {
      rejectWithdrawal(rejectingTxId, rejectReasonText || 'Ditolak dari menu approval');
      setRejectingTxId(null);
      setRejectReasonText('');
    }
  };

  const withdrawalTransactions = transactions.filter(
    (t) => t.type === 'Penarikan' && t.academicYearId === currentAcademicYear.id
  );

  const pendingWithdrawals = withdrawalTransactions.filter(
    (t) => t.status === 'Menunggu Persetujuan'
  );

  return (
    <div className="space-y-6">
      {/* 2-Tier Approval Explanation Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-amber-900 text-sm mb-0.5">
            Mekanisme Approval Penarikan 2 Lapis (Dua Tingkat)
          </h4>
          <p className="leading-relaxed">
            1. <strong>Pengajuan:</strong> Admin atau Super Admin mengajukan potongan/penarikan saldo siswa. Status transaksi langsung menjadi <span className="font-bold text-amber-800">Menunggu Persetujuan</span> dan <span className="font-extrabold underline">SALDO SISWA SAMA SEKALI BELUM BERKURANG</span>.
            <br />
            2. <strong>Persetujuan (Approval):</strong> Hanya <strong>Super Admin (Kepala Sekolah)</strong> & <strong>Developer</strong> yang memiliki wewenang untuk menyetujui atau menolak. Setelah disetujui, saldo siswa baru akan terpotong secara otomatis.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Pengajuan Penarikan */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ArrowDownCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Form Pengajuan Penarikan / Potongan Tabungan
              </h2>
              <p className="text-xs text-slate-500">
                Memerlukan persetujuan Super Admin sebelum saldo terpotong
              </p>
            </div>
          </div>

          <form onSubmit={handleWithdrawalSubmit} className="space-y-4 text-xs">
            {/* Step 1: Select Class First */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-rose-600" />
                1. Pilih Kelas *
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto p-1">
                <button
                  type="button"
                  onClick={() => { setSelectedClass('ALL'); setSelectedStudentId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    selectedClass === 'ALL'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua ({activeStudents.length})
                </button>
                {ALL_CLASSES.map((cls) => {
                  const count = activeStudents.filter((s) => s.classGrade === cls).length;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => { setSelectedClass(cls); setSelectedStudentId(''); }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        selectedClass === cls
                          ? 'bg-rose-600 text-white shadow-xs'
                          : count > 0
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {cls} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Student with Search */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-rose-600" />
                2. Cari & Pilih Nama Siswa *
              </label>

              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ketik NIS atau Nama Siswa..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <select
                size={4}
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-1 focus:outline-none cursor-pointer text-xs"
              >
                {filteredStudents.length === 0 ? (
                  <option disabled className="p-2 text-slate-400">
                    Tidak ada siswa ditemukan
                  </option>
                ) : (
                  filteredStudents.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      className="p-2 hover:bg-rose-50 rounded-lg text-slate-800 font-medium"
                    >
                      {s.name} ({s.nis}) — {s.classGrade} | Saldo: {formatRupiah(s.balance)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedStudent && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-rose-900 text-sm flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-rose-600" />
                    {selectedStudent.name}
                  </div>
                  <div className="text-[11px] text-rose-700 mt-0.5">
                    NIS: {selectedStudent.nis} | Kelas: <strong>{selectedStudent.classGrade}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-rose-800 font-medium">Saldo Tersedia</div>
                  <div className="text-base font-extrabold text-rose-900">
                    {formatRupiah(selectedStudent.balance)}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Nominal Input & Presets */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                3. Nominal Penarikan *
              </label>

              {/* Preset Buttons */}
              <div className="mb-2">
                <span className="text-[11px] text-slate-500 mb-1 block">Pilih Nominal Cepat:</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {NOMINAL_PRESETS.map((preset) => {
                    const presetFormatted = formatNumberInput(preset.toString());
                    const isSelected = formattedAmountInput === presetFormatted;
                    return (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => handlePresetClick(preset)}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:border-rose-300'
                        }`}
                      >
                        {presetFormatted}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-2.5 font-bold text-slate-500">Rp</span>
                <input
                  type="text"
                  required
                  placeholder="5.000"
                  value={formattedAmountInput}
                  onChange={handleAmountChange}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Format otomatis pemisah ribuan. Default nominal penarikan adalah Rp 5.000
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alasan Penarikan *</label>
              <input
                type="text"
                required
                placeholder="Contoh: Pembelian LKS / Pengambilan Saldo oleh Orang Tua"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Kirim Pengajuan Penarikan
            </button>
          </form>
        </div>

        {/* Approval Queue Status Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Antrean Approval Pending
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {pendingWithdrawals.length}
              </span>
            </div>

            {pendingWithdrawals.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Semua pengajuan penarikan sudah diproses. Tidak ada antrean pending.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {pendingWithdrawals.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900">{tx.studentName}</div>
                        <div className="text-[11px] text-slate-500">
                          {tx.studentNis} ({tx.classGrade})
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-rose-600">{formatRupiah(tx.amount)}</div>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          Pending Approval
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                      "{tx.reason}"
                    </div>

                    <div className="text-[10px] text-slate-400 flex justify-between">
                      <span>Oleh: {tx.createdByName}</span>
                      <span>{formatDate(tx.createdAt)}</span>
                    </div>

                    {(currentUser.role === 'Super Admin' || currentUser.role === 'Developer') ? (
                      <div className="pt-1 flex gap-2">
                        <button
                          onClick={() => handleApprove(tx.id)}
                          className="w-1/2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                        </button>
                        <button
                          onClick={() => setRejectingTxId(tx.id)}
                          className="w-1/2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Tolak
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-700 font-medium italic text-center pt-1">
                        Menunggu persetujuan Super Admin / Kepala Sekolah
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Akses persetujuan hanya dimiliki oleh Kepala Sekolah & Developer.
          </div>
        </div>
      </div>

      {/* History Table of Withdrawals */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-rose-600" />
          Riwayat Penarikan Tabungan ({withdrawalTransactions.length} Transaksi)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">No. Transaksi</th>
                <th className="py-2.5 px-3">Siswa</th>
                <th className="py-2.5 px-3">Kelas</th>
                <th className="py-2.5 px-3">Nominal</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Pengaju</th>
                <th className="py-2.5 px-3">Disetujui Oleh</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3 text-center">Cetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {withdrawalTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-400">
                    Belum ada riwayat penarikan.
                  </td>
                </tr>
              ) : (
                withdrawalTransactions.map((t, i) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{i + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{t.transactionNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {t.studentName} <span className="text-slate-400 font-normal">({t.studentNis})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">{t.classGrade}</td>
                    <td className="py-2.5 px-3 font-extrabold text-rose-600">
                      -{formatRupiah(t.amount)}
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
                    <td className="py-2.5 px-3 text-slate-600">{t.approvedByName || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{formatDate(t.createdAt)}</td>
                    <td className="py-2.5 px-3 text-center">
                      {t.status === 'Disetujui' && (
                        <button
                          onClick={() => generateTransactionReceiptPDF(t, schoolSettings)}
                          title="Cetak Kuitansi"
                          className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectingTxId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Alasan Penolakan Penarikan</h3>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              placeholder="Masukkan alasan penolakan..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingTxId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
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
    </div>
  );
};
