/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ClassGrade } from '../types';
import type { SppPayment as SppPaymentRecord } from '../types';
import { formatRupiah, formatDate, filterByAccessLevel, filterByUserLevel } from '../utils/format';
import {
  GraduationCap,
  Banknote,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Search,
  Wallet,
  Baby,
} from 'lucide-react';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const TK_CLASSES: ClassGrade[] = ['TK A.1', 'TK A.2', 'TK B.1', 'TK B.2'];
const SD_CLASSES: ClassGrade[] = [
  'Kelas 1A', 'Kelas 1 B', 'Kelas 2A', 'Kelas 2B',
  'Kelas 3A', 'Kelas 3B', 'Kelas 4A', 'Kelas 4B',
  'Kelas 5A', 'Kelas 5B', 'Kelas 6A', 'Kelas 6B',
];

export const SppPayment: React.FC = () => {
  const {
    students,
    sppPayments,
    addSppPayment,
    currentUser,
    schoolSettings,
    currentAcademicYear,
  } = useApp();

  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Tunai' | 'Potong Tabungan'>('Tunai');
  const currentPeriod = `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [studentSearchTKA, setStudentSearchTKA] = useState('');
  const [studentSearchTKB, setStudentSearchTKB] = useState('');
  const [studentSearchMI, setStudentSearchMI] = useState('');

  const visibleSppPayments = filterByUserLevel<SppPaymentRecord>(sppPayments, currentUser);

  const activeStudents = filterByAccessLevel(students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  ), currentUser);

  const TK_A_CLASSES: ClassGrade[] = ['TK A.1', 'TK A.2'];
  const TK_B_CLASSES: ClassGrade[] = ['TK B.1', 'TK B.2'];

  const tkAStudents = activeStudents.filter((s) => TK_A_CLASSES.includes(s.classGrade));
  const tkBStudents = activeStudents.filter((s) => TK_B_CLASSES.includes(s.classGrade));
  const miStudents = activeStudents.filter((s) => SD_CLASSES.includes(s.classGrade));

  const filteredTKA = tkAStudents.filter((s) =>
    s.name.toLowerCase().includes(studentSearchTKA.toLowerCase()) ||
    s.nis.toLowerCase().includes(studentSearchTKA.toLowerCase())
  );
  const filteredTKB = tkBStudents.filter((s) =>
    s.name.toLowerCase().includes(studentSearchTKB.toLowerCase()) ||
    s.nis.toLowerCase().includes(studentSearchTKB.toLowerCase())
  );
  const filteredMI = miStudents.filter((s) =>
    s.name.toLowerCase().includes(studentSearchMI.toLowerCase()) ||
    s.nis.toLowerCase().includes(studentSearchMI.toLowerCase())
  );

  // ?? not || : sppSDAmount = 0 is a deliberate "gratis" setting, not a missing value.
  const sppTKRate = schoolSettings.sppTKAmount ?? 50000;
  const sppMIRate = schoolSettings.sppSDAmount ?? 0;

  const handlePaySpp = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (student && !student.classGrade.startsWith('TK')) {
      if (!sppMIRate || sppMIRate <= 0) return;
    }
    setPaymentStudentId(studentId);
    setPaymentError('');
    setPaymentSuccess('');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentStudentId) return;

    const res = await addSppPayment(paymentStudentId, paymentMethod, currentPeriod);
    if (!res.success) {
      setPaymentError(res.error || 'Gagal memproses pembayaran SPP.');
    } else {
      setPaymentSuccess(`Pembayaran SPP ${currentPeriod} berhasil dicatat!`);
      setPaymentStudentId('');
    }
  };

  const student = students.find((s) => s.id === paymentStudentId);
  const sppAmount = student?.classGrade.startsWith('TK') ? sppTKRate : sppMIRate;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
              Pembayaran SPP
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sumbangan Pembinaan Pendidikan — Bayar SPP siswa per bulan
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="p-2.5 bg-pink-50 rounded-xl border border-pink-200 text-center">
              <div className="text-[10px] text-pink-600 font-semibold">Tarif TK</div>
              <div className="font-bold text-pink-800">{formatRupiah(sppTKRate)}</div>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
              <div className="text-[10px] text-blue-600 font-semibold">Tarif MI</div>
              <div className="font-bold text-blue-800">{formatRupiah(sppMIRate)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Period Select & Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Periode (bulan berjalan):</span>
          <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">
            {currentPeriod}
          </span>
          <span className="text-[10px] text-slate-400" title="Periode otomatis mengikuti tanggal hari ini, tidak dapat diubah manual.">
            otomatis
          </span>
        </div>
        <div className="text-xs text-slate-500">
          Total SPP dibayarkan: <span className="font-bold text-emerald-700">{visibleSppPayments.length} transaksi</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TK A Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-pink-400 to-pink-500 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5" />
              <span className="font-bold text-sm">TK A</span>
            </div>
            <span className="text-pink-100 text-xs">
              {filteredTKA.length} siswa • {formatRupiah(sppTKRate)}/bulan
            </span>
          </div>

          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari TK A..."
                value={studentSearchTKA}
                onChange={(e) => setStudentSearchTKA(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {filteredTKA.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Tidak ada siswa TK A</div>
            ) : (
              filteredTKA.map((s) => {
                const paid = sppPayments.some(
                  (sp) => sp.studentId === s.id && sp.period === currentPeriod
                );
                return (
                  <div key={s.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm truncate">{s.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {s.nis} • Kelas {s.classGrade}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Saldo: <span className="font-semibold text-emerald-600">{formatRupiah(s.balance)}</span>
                          <span className="mx-1">•</span>
                          SPP: <span className="font-semibold">{formatRupiah(sppTKRate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {paid ? (
                          <span className="px-2.5 py-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Lunas
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePaySpp(s.id)}
                            className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                          >
                            Bayar SPP
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TK B Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5" />
              <span className="font-bold text-sm">TK B</span>
            </div>
            <span className="text-pink-100 text-xs">
              {filteredTKB.length} siswa • {formatRupiah(sppTKRate)}/bulan
            </span>
          </div>

          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari TK B..."
                value={studentSearchTKB}
                onChange={(e) => setStudentSearchTKB(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {filteredTKB.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Tidak ada siswa TK B</div>
            ) : (
              filteredTKB.map((s) => {
                const paid = sppPayments.some(
                  (sp) => sp.studentId === s.id && sp.period === currentPeriod
                );
                return (
                  <div key={s.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm truncate">{s.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {s.nis} • Kelas {s.classGrade}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Saldo: <span className="font-semibold text-emerald-600">{formatRupiah(s.balance)}</span>
                          <span className="mx-1">•</span>
                          SPP: <span className="font-semibold">{formatRupiah(sppTKRate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {paid ? (
                          <span className="px-2.5 py-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Lunas
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePaySpp(s.id)}
                            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                          >
                            Bayar SPP
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SD Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              <span className="font-bold text-sm">MI (Kelas 1 - 6)</span>
            </div>
            <span className="text-blue-100 text-xs">
              {filteredMI.length} siswa • {sppMIRate > 0 ? `${formatRupiah(sppMIRate)}/bulan` : 'Gratis'}
            </span>
          </div>

          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari siswa MI..."
                value={studentSearchMI}
                onChange={(e) => setStudentSearchMI(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {filteredMI.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Tidak ada siswa MI</div>
            ) : (
              filteredMI.map((s) => {
                const paid = sppPayments.some(
                  (sp) => sp.studentId === s.id && sp.period === currentPeriod
                );
                return (
                  <div key={s.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm truncate">{s.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {s.nis} • Kelas {s.classGrade}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Saldo: <span className="font-semibold text-emerald-600">{formatRupiah(s.balance)}</span>
                          <span className="mx-1">•</span>
                          SPP: <span className="font-semibold">{sppMIRate > 0 ? formatRupiah(sppMIRate) : 'Gratis'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {sppMIRate === 0 ? (
                          <span className="px-2.5 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg">Gratis</span>
                        ) : paid ? (
                          <span className="px-2.5 py-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Lunas
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePaySpp(s.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                          >
                            Bayar SPP
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentStudentId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Konfirmasi Pembayaran SPP</h3>
              <button
                onClick={() => setPaymentStudentId('')}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {student && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Siswa:</span>
                  <span className="font-bold text-slate-900">{student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">NIS / Kelas:</span>
                  <span className="font-semibold">{student.nis} • {student.classGrade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Periode:</span>
                  <span className="font-semibold">{currentPeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah SPP:</span>
                  <span className="font-bold text-emerald-700">{formatRupiah(sppAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo Tabungan:</span>
                  <span className="font-semibold">{formatRupiah(student.balance)}</span>
                </div>
              </div>
            )}

            {paymentSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {paymentSuccess}
              </div>
            )}

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {paymentError}
              </div>
            )}

            {!paymentSuccess && (
              <form onSubmit={handleConfirmPayment} className="space-y-4">
                <div>
                  <label className="block font-bold text-slate-800 text-xs mb-2">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Tunai')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                        paymentMethod === 'Tunai'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Banknote className="w-5 h-5 text-emerald-600 mb-1" />
                      <div className="text-xs font-bold">Tunai</div>
                      <div className="text-[10px] text-slate-500">Langsung lunas</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Potong Tabungan')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                        paymentMethod === 'Potong Tabungan'
                          ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Wallet className="w-5 h-5 text-purple-600 mb-1" />
                      <div className="text-xs font-bold">Potong Tabungan</div>
                      <div className="text-[10px] text-slate-500">Langsung dipotong</div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-xs"
                >
                  Konfirmasi Pembayaran SPP
                </button>
              </form>
            )}

            {paymentSuccess && (
              <button
                onClick={() => {
                  setPaymentStudentId('');
                  setPaymentSuccess('');
                }}
                className="w-full py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      {/* SPP Payment History */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          Riwayat Pembayaran SPP
          <span className="text-[10px] text-slate-400 font-normal ml-auto">
            {visibleSppPayments.length} transaksi
          </span>
        </h3>

        {visibleSppPayments.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Belum ada pembayaran SPP.
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {visibleSppPayments.map((sp) => (
              <div
                key={sp.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900">{sp.studentName}</div>
                  <div className="text-[11px] text-slate-500">
                    {sp.studentNis} • {sp.classGrade} • {sp.period}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatDate(sp.createdAt)}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="font-bold text-emerald-700">{formatRupiah(sp.amount)}</div>
                  <span className="text-[10px] text-slate-500">{sp.paymentMethod}</span>
                  <div className="text-[10px] text-slate-400">{sp.createdByName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
