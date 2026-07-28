/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatNumberInput, parseFormattedNumber, formatDate } from '../utils/format';
import { generateTransactionReceiptPDF } from '../utils/pdfGenerator';
import { Transaction, ClassGrade } from '../types';
import { ALL_CLASSES } from '../utils/initialData';
import {
  Banknote,
  CheckCircle2,
  Printer,
  AlertTriangle,
  Search,
  UserCheck,
  History,
  Filter,
} from 'lucide-react';

export const DepositForm: React.FC = () => {
  const {
    students,
    addDeposit,
    transactions,
    currentAcademicYear,
    schoolSettings,
  } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [formattedAmountInput, setFormattedAmountInput] = useState('5.000');
  const [reason, setReason] = useState('Setoran Tabungan Rutin');
  const [warningMessage, setWarningMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSuccessTransaction, setLastSuccessTransaction] = useState<Transaction | null>(null);

  const NOMINAL_PRESETS = [2000, 5000, 10000, 15000, 20000, 25000];

  const activeStudents = students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  );

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
    const num = parseFormattedNumber(formatted);

    setFormattedAmountInput(formatted);

    if (num > 500000) {
      setWarningMessage(`Peringatan: Nominal setoran (${formatRupiah(num)}) lebih dari Rp 500.000. Mohon pastikan jumlah uang fisik sudah benar.`);
    } else {
      setWarningMessage('');
    }

    if (num > 99999000) {
      setErrorMessage('Nominal melebihi batas maksimal transaksi (Rp 99.999.000).');
    } else {
      setErrorMessage('');
    }
  };

  const handlePresetClick = (amount: number) => {
    const formatted = formatNumberInput(amount.toString());
    setFormattedAmountInput(formatted);
    setWarningMessage('');
    setErrorMessage('');
  };

  const handleSubmitDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedStudentId) {
      setErrorMessage('Silakan pilih siswa terlebih dahulu!');
      return;
    }

    const numAmount = parseFormattedNumber(formattedAmountInput);
    if (numAmount <= 0) {
      setErrorMessage('Nominal setoran harus lebih besar dari Rp 0.');
      return;
    }

    if (numAmount > 99999000) {
      setErrorMessage('Nominal melebihi batas maksimal transaksi (Rp 99.999.000).');
      return;
    }

    const res = addDeposit(selectedStudentId, numAmount, reason || 'Setoran Tabungan');

    if (!res.success) {
      setErrorMessage(res.error || 'Gagal menyimpan setoran.');
    } else if (res.transaction) {
      setLastSuccessTransaction(res.transaction);
      setFormattedAmountInput('5.000');
      setReason('Setoran Tabungan Rutin');
      setWarningMessage('');
    }
  };

  const depositTransactions = transactions.filter(
    (t) => t.type === 'Setoran' && t.academicYearId === currentAcademicYear.id
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Input Setoran */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Input Setoran Tabungan Siswa
              </h2>
              <p className="text-xs text-slate-500">
                Pilih kelas & nama siswa, lalu tentukan nominal setoran tabungan
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitDeposit} className="space-y-4 text-xs">
            {/* Step 1: Select Class First */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                1. Pilih Kelas *
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStudentId('');
                }}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer"
              >
                <option value="ALL">-- Semua Kelas ({activeStudents.length} Siswa) --</option>
                {ALL_CLASSES.map((cls) => {
                  const count = activeStudents.filter((s) => s.classGrade === cls).length;
                  return (
                    <option key={cls} value={cls}>
                      {cls} ({count} Siswa)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Step 2: Select Student with Search */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-600" />
                2. Cari & Pilih Nama Siswa *
              </label>

              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ketik Nama Siswa atau NIS untuk mencari..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    Tidak ada siswa ditemukan dalam kelas / kata kunci ini
                  </option>
                ) : (
                  filteredStudents.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      className="p-2 hover:bg-emerald-50 rounded-lg text-slate-800 font-medium"
                    >
                      {s.name} ({s.nis}) — {s.classGrade} | Saldo: {formatRupiah(s.balance)}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Selected Student Card */}
            {selectedStudent && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    {selectedStudent.name}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    NIS: {selectedStudent.nis} | Kelas: <strong>{selectedStudent.classGrade}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-800 font-medium">Saldo Saat Ini</div>
                  <div className="text-base font-extrabold text-emerald-900">
                    {formatRupiah(selectedStudent.balance)}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Nominal Input & Presets */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                3. Nominal Setoran *
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
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                        }`}
                      >
                        {presetFormatted}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 font-bold text-slate-500">Rp</span>
                <input
                  type="text"
                  required
                  placeholder="5.000"
                  value={formattedAmountInput}
                  onChange={handleAmountChange}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Format otomatis pemisah ribuan. Default nominal setoran adalah Rp 5.000
              </p>
            </div>

            {/* Warning Message > 500k */}
            {warningMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{warningMessage}</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Keterangan / Catatan
              </label>
              <input
                type="text"
                placeholder="Contoh: Setoran Tabungan Rutin"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Simpan Setoran Sekarang
            </button>
          </form>
        </div>

        {/* Success Transaction & Receipt Receipt Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Bukti Transaksi Terakhir</span>
            </div>

            {lastSuccessTransaction ? (
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-emerald-200/60 pb-2">
                  <span className="font-bold text-emerald-900">No Transaksi</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {lastSuccessTransaction.transactionNumber}
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Siswa:</span>
                    <span className="font-bold text-slate-900">{lastSuccessTransaction.studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">NIS / Kelas:</span>
                    <span>{lastSuccessTransaction.studentNis} ({lastSuccessTransaction.classGrade})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nominal Setoran:</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      {formatRupiah(lastSuccessTransaction.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Petugas Input:</span>
                    <span>{lastSuccessTransaction.createdByName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waktu:</span>
                    <span className="text-[10px]">{formatDate(lastSuccessTransaction.createdAt)}</span>
                  </div>
                </div>

                <button
                  onClick={() => generateTransactionReceiptPDF(lastSuccessTransaction, schoolSettings)}
                  className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Cetak Kuitansi (PDF)
                </button>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                Belum ada transaksi setoran yang baru saja diproses dalam sesi ini.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Setoran yang disimpan akan langsung memperbarui saldo siswa secara realtime dan dicatat pada Audit Log sistem.
            </p>
          </div>
        </div>
      </div>

      {/* History Table of Deposits */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" />
          Riwayat Setoran Tabungan ({depositTransactions.length} Transaksi)
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
                <th className="py-2.5 px-3">Keterangan</th>
                <th className="py-2.5 px-3">Petugas</th>
                <th className="py-2.5 px-3">Tanggal & Waktu</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {depositTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Belum ada riwayat setoran.
                  </td>
                </tr>
              ) : (
                depositTransactions.slice(0, 10).map((t, i) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{i + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{t.transactionNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {t.studentName} <span className="text-slate-400 font-normal">({t.studentNis})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">{t.classGrade}</td>
                    <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                      {formatRupiah(t.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{t.reason}</td>
                    <td className="py-2.5 px-3 text-slate-600">{t.createdByName}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{formatDate(t.createdAt)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => generateTransactionReceiptPDF(t, schoolSettings)}
                        title="Cetak Kuitansi PDF"
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
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
