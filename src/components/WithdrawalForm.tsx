/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClassGrade, Transaction } from '../types';
import { formatRupiah, formatNumberInput, parseFormattedNumber, formatDate, filterByAccessLevel } from '../utils/format';
import { generateTransactionReceiptPDF } from '../utils/pdfGenerator';
import { ALL_CLASSES } from '../utils/initialData';
import { TransactionEditModal } from './TransactionEditModal';
import { PendingEditApprovals } from './PendingEditApprovals';
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
  AlertTriangle,
  Wallet,
  Trash2,
  Pencil,
} from 'lucide-react';

export const WithdrawalForm: React.FC = () => {
  const {
    students,
    requestWithdrawal,
    approveWithdrawal,
    rejectWithdrawal,
    closeStudentSavings,
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

  const [withdrawalMode, setWithdrawalMode] = useState<'reguler' | 'tutup'>('reguler');
  const [closeSavingsIds, setCloseSavingsIds] = useState<Set<string>>(new Set());
  const [closeSavingsReason, setCloseSavingsReason] = useState('Lulus / Pindah Sekolah');
  const [closeSavingsResult, setCloseSavingsResult] = useState<{ pendingCount: number; closedCount: number; totalWithdrawn: number; errors: string[] } | null>(null);
  const [closeSavingsClass, setCloseSavingsClass] = useState<string>('ALL');
  const [closeSavingsSearch, setCloseSavingsSearch] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const GRADUATING_CLASSES: ClassGrade[] = ['TK B', 'Kelas 6A', 'Kelas 6B'];

  const NOMINAL_PRESETS = [2000, 5000, 10000, 15000, 20000, 25000];

  // Semua tahun ajaran: penarikan & tutup tabungan harus bisa proses siswa tahun lama (lulus/pindah).
  // ponytail: kalau nanti mau lihat hanya tahun aktif lagi, tambahkan `&& s.academicYearId === currentAcademicYear.id`.
  const activeStudents = filterByAccessLevel(students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif'
  ), currentUser);

  const filteredStudents = activeStudents.filter((s) => {
    const matchesClass = selectedClass === 'ALL' || s.classGrade === selectedClass;
    const matchesSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.nis.toLowerCase().includes(studentSearch.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const selectedStudent = activeStudents.find((s) => s.id === selectedStudentId);

  const visibleCloseStudents = activeStudents.filter((s) => {
    const matchesClass = closeSavingsClass === 'ALL' || s.classGrade === closeSavingsClass;
    const q = closeSavingsSearch.trim().toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q);
    return matchesClass && matchesSearch;
  });

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

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
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

    const res = await requestWithdrawal(selectedStudentId, numAmount, reason || 'Penarikan Tabungan');

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

  const handleApprove = async (txId: string) => {
    const res = await approveWithdrawal(txId);
    if (!res.success) {
      alert(res.error);
    }
  };

  const handleConfirmReject = async () => {
    if (rejectingTxId) {
      await rejectWithdrawal(rejectingTxId, rejectReasonText || 'Ditolak dari menu approval');
      setRejectingTxId(null);
      setRejectReasonText('');
    }
  };

  const switchToCloseTab = () => {
    const defaultIds = new Set<string>();
    activeStudents.forEach((s) => {
      if (GRADUATING_CLASSES.includes(s.classGrade)) {
        defaultIds.add(s.id);
      }
    });
    setCloseSavingsIds(defaultIds);
    setCloseSavingsReason('Lulus / Pindah Sekolah');
    setCloseSavingsResult(null);
    setCloseSavingsClass('ALL');
    setCloseSavingsSearch('');
    setWithdrawalMode('tutup');
  };

  const toggleCloseSavingsId = (id: string) => {
    setCloseSavingsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleClassInCloseSavings = (cls: ClassGrade) => {
    const classStudentIds = visibleCloseStudents.filter((s) => s.classGrade === cls).map((s) => s.id);
    const allSelected = classStudentIds.every((id) => closeSavingsIds.has(id));
    setCloseSavingsIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        classStudentIds.forEach((id) => next.delete(id));
      } else {
        classStudentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSubmitCloseSavings = async () => {
    if (closeSavingsIds.size === 0) return;
    const totalBalance = closeSavingsSelectedStudents.reduce((sum, s) => sum + s.balance, 0);
    if (!confirm(
      `Konfirmasi Tutup Tabungan:\n\n` +
      `Jumlah siswa: ${closeSavingsIds.size}\n` +
      `Total saldo ditarik: ${formatRupiah(totalBalance)}\n\n` +
      `Saldo ditarik seluruhnya dan data siswa dihapus permanen dari database setelah disetujui.\n` +
      `Tindakan ini TIDAK DAPAT DIBATALKAN.\n\n` +
      `Lanjutkan?`
    )) return;

    const res = await closeStudentSavings(Array.from(closeSavingsIds), closeSavingsReason);
    setCloseSavingsResult({ pendingCount: res.pendingCount, closedCount: res.closedCount, totalWithdrawn: res.totalWithdrawn, errors: res.errors });
    if (res.success) {
      setCloseSavingsIds(new Set());
    }
  };

  const withdrawalTransactions = transactions.filter(
    (t) => t.type === 'Penarikan' && t.academicYearId === currentAcademicYear.id
  );

  const pendingWithdrawals = withdrawalTransactions.filter(
    (t) => t.status === 'Menunggu Persetujuan'
  );

  const closeSavingsSelectedStudents = activeStudents.filter((s) => closeSavingsIds.has(s.id));
  const closeSavingsTotalBalance = closeSavingsSelectedStudents.reduce((sum, s) => sum + s.balance, 0);

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

      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setWithdrawalMode('reguler')}
            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              withdrawalMode === 'reguler'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            Model 1: Penarikan Reguler
          </button>
          <button
            onClick={switchToCloseTab}
            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              withdrawalMode === 'tutup'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Model 2: Tutup Tabungan
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2 px-2">
          Model 1: penarikan biasa (bayar buku/kegiatan/SPP) — data siswa tetap. Model 2: tutup tabungan (lulus/pindah sekolah) — saldo ditarik penuh &amp; data siswa dihapus setelah disetujui.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {withdrawalMode === 'reguler' ? (
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

              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <div className="p-3 text-slate-400 text-center">
                    Tidak ada siswa ditemukan
                  </div>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`w-full text-left px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                        selectedStudentId === s.id
                          ? 'bg-rose-50 border-l-4 border-rose-500'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className="text-slate-400 text-[11px]"> ({s.nis}) — {s.classGrade}</span>
                      </span>
                      <span className="text-[11px] text-rose-700 font-semibold shrink-0">
                        {formatRupiah(s.balance)}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Klik nama siswa di daftar untuk memilih.</p>
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
        ) : (
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Form Tutup Tabungan Siswa
              </h2>
              <p className="text-xs text-slate-500">
                Untuk lulus / pindah sekolah — saldo ditarik penuh &amp; data siswa dihapus setelah disetujui
              </p>
            </div>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>
              <strong>Perhatian:</strong> Pengajuan masuk ke antrean approval. Setelah <strong>disetujui Kepala Sekolah</strong>,
              saldo ditarik <strong>seluruhnya</strong> (menjadi Rp 0) dan data siswa beserta riwayat distribusi/pembayaran
              dihapus <strong>permanen</strong> dari database — tidak dapat dibatalkan.
            </span>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900">
            <strong>Kriteria:</strong> TK B &amp; Kelas 6A/6B adalah grade akhir tiap jenjang (kriteria lulus) — sudah
            terpilih default. Kelas di bawahnya dapat dipilih jika siswa <strong>pindah sekolah</strong>.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block font-semibold text-slate-700 mb-1 text-xs">Alasan Tutup Tabungan *</label>
              <input
                type="text"
                required
                value={closeSavingsReason}
                onChange={(e) => setCloseSavingsReason(e.target.value)}
                placeholder="Contoh: Lulus / Pindah Sekolah / Orang tua menarik saldo"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="shrink-0 self-end pb-0.5 text-right">
              <div className="text-[10px] text-slate-500 font-semibold">Total Saldo Ditarik</div>
              <div className="text-lg font-extrabold text-rose-700">{formatRupiah(closeSavingsTotalBalance)}</div>
            </div>
          </div>

          {closeSavingsResult && (
            <div className="p-3 rounded-xl border text-xs space-y-1 bg-emerald-50 border-emerald-200">
              <div className="font-bold text-emerald-700">
                {closeSavingsResult.pendingCount > 0
                  ? `${closeSavingsResult.pendingCount} pengajuan tutup tabungan dikirim — menunggu persetujuan Kepala Sekolah.`
                  : `${closeSavingsResult.closedCount} tabungan langsung ditutup — total ${formatRupiah(closeSavingsResult.totalWithdrawn)} ditarik, data siswa dihapus.`}
              </div>
              {closeSavingsResult.errors.length > 0 && (
                <div className="mt-1 text-rose-600 space-y-0.5">
                  {closeSavingsResult.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-1">
              <button
                type="button"
                onClick={() => setCloseSavingsClass('ALL')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  closeSavingsClass === 'ALL'
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
                    onClick={() => setCloseSavingsClass(cls)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      closeSavingsClass === cls
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
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Ketik NIS atau Nama Siswa..."
                value={closeSavingsSearch}
                onChange={(e) => setCloseSavingsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {visibleCloseStudents.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">Tidak ada siswa sesuai filter.</div>
            ) : (
              ALL_CLASSES.filter((cls) => visibleCloseStudents.some((s) => s.classGrade === cls)).map((cls) => {
                const classStudents = visibleCloseStudents.filter((s) => s.classGrade === cls);
                const selectedCount = classStudents.filter((s) => closeSavingsIds.has(s.id)).length;
                const allSelected = selectedCount === classStudents.length;
                const isGraduating = GRADUATING_CLASSES.includes(cls);

                return (
                  <div key={cls}>
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 sticky top-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleClassInCloseSavings(cls)}
                          className="w-3.5 h-3.5 accent-rose-600"
                        />
                        <span className="font-bold text-slate-800 text-xs">
                          {cls} ({selectedCount}/{classStudents.length})
                        </span>
                        {isGraduating && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            Grade Akhir
                          </span>
                        )}
                      </label>
                    </div>
                    {classStudents.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={closeSavingsIds.has(s.id)}
                            onChange={() => toggleCloseSavingsId(s.id)}
                            className="w-3.5 h-3.5 accent-rose-600 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-900 text-xs block truncate">{s.name}</span>
                            <span className="text-[10px] text-slate-400 block">{s.nis}</span>
                          </span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 shrink-0">
                          {formatRupiah(s.balance)}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={handleSubmitCloseSavings}
            disabled={closeSavingsIds.size === 0}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Ajukan Tutup Tabungan ({closeSavingsIds.size} Siswa)
          </button>
        </div>
        )}

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
                        {tx.closesAccount && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                            Tutup Tabungan
                          </span>
                        )}
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

      {/* Pending Edit Approvals Panel */}
      <PendingEditApprovals type="Penarikan" />

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
                <th className="py-2.5 px-3 text-center">Aksi</th>
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
                      <div className="flex items-center justify-center gap-1.5">
                        {t.status === 'Disetujui' && !t.hasPendingEdit && (
                          <button
                            type="button"
                            onClick={() => setEditingTx(t)}
                            title="Perbaiki Transaksi"
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {t.hasPendingEdit && (
                          <span
                            title="Menunggu persetujuan Super Admin"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap"
                          >
                            <Clock className="w-2.5 h-2.5" /> Pending Edit
                          </span>
                        )}
                        {t.status === 'Disetujui' && (
                          <button
                            type="button"
                            onClick={() => generateTransactionReceiptPDF(t, schoolSettings)}
                            title="Cetak Kuitansi"
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
                type="button"
                onClick={() => setRejectingTxId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <TransactionEditModal transaction={editingTx} onClose={() => setEditingTx(null)} />
      )}
    </div>
  );
};
