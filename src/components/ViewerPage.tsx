/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { normalizeName } from '../utils/viewerCredentials';
import { formatRupiah, formatDate, isPendingApprovalStatus } from '../utils/format';
import { generateStudentCertificatePDF } from '../utils/pdfGenerator';
import {
  Wallet,
  BookOpen,
  CheckCircle2,
  Printer,
  History,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
} from 'lucide-react';

interface ViewerPageProps {
  onLogout: () => void;
}

export const ViewerPage: React.FC<ViewerPageProps> = ({ onLogout }) => {
  const {
    students,
    transactions,
    books,
    bookDistributions,
    bookPayments,
    sppPayments,
    schoolSettings,
    currentUser,
    currentAcademicYear,
    changeViewerPassword,
  } = useApp();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showIdentityConfirm, setShowIdentityConfirm] = useState(true);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const student = students.find((s) => s.id === currentUser.studentId);

  if (!student) {
    return (
      <div className="text-center py-20 text-slate-500">
        Data siswa tidak ditemukan.
      </div>
    );
  }

  const nameHasDuplicate = students.some(
    (s) => !s.isDeleted && s.id !== student.id && normalizeName(s.name) === normalizeName(student.name)
  );

  const studentTransactions = transactions.filter((t) => t.studentId === student.id);
  const studentBookPayments = bookPayments.filter((bp) => bp.studentId === student.id);
  const studentBookDistributions = bookDistributions.filter((bd) => bd.studentId === student.id);
  const studentSppPayments = sppPayments.filter((sp) => sp.studentId === student.id);

  const classBooks = books.filter((b) => b.classGrade === student.classGrade);

  const tunggakanBooks = studentBookPayments.filter((bp) => bp.status !== 'Disetujui');

  const now = new Date();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const allMonths: string[] = [];
  for (let m = 6; m < 12; m++) allMonths.push(`${monthNames[m]} ${startYear}`);
  for (let m = 0; m < 6; m++) allMonths.push(`${monthNames[m]} ${startYear + 1}`);
  const currentIdx = now.getMonth() >= 6 ? now.getMonth() - 6 : now.getMonth() + 6;
  const paidPeriods = studentSppPayments
    .filter((sp) => sp.status === 'Disetujui')
    .map((sp) => sp.period);
  const tunggakanSpp = allMonths.filter((m, idx) => idx <= currentIdx && !paidPeriods.includes(m));

  const handleLogout = () => {
    onLogout();
  };

  const handleChangePassword = () => {
    setPwError('');
    setPwSuccess('');

    if (currentUser.password !== oldPassword) {
      setPwError('Password lama salah.');
      return;
    }
    if (newPassword.length < 4) {
      setPwError('Password baru minimal 4 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Konfirmasi password tidak cocok.');
      return;
    }

    const res = changeViewerPassword(newPassword);
    if (!res.success) {
      setPwError(res.error || 'Gagal mengubah password.');
      return;
    }
    setPwSuccess('Password berhasil diubah!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setPwSuccess('');
      setShowChangePassword(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold">Portal Orang Tua & Siswa</h2>
            <p className="text-xs text-slate-300">
              {student.name} — Kelas {student.classGrade} (NIS: {student.nis})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            Ubah Password
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>
      </div>

      {/* Ambiguous Name Confirmation */}
      {showIdentityConfirm && nameHasDuplicate && (
        <div className="bg-amber-50 rounded-2xl border border-amber-300 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Pastikan ini anak Anda
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            Terdapat siswa lain dengan nama yang sama. Anak Anda:{' '}
            <strong>{student.name}</strong> — Kelas {student.classGrade} (NIS: {student.nis}) ·
            Orang Tua: {student.parentName || '-'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowIdentityConfirm(false)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Ini anak saya
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Bukan anak saya
            </button>
          </div>
        </div>
      )}

      {/* Change Password Form */}
      {showChangePassword && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            Ubah Password
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Password Lama</label>
              <div className="relative">
                <input
                  type={showOldPw ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                  placeholder="Password lama"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPw(!showOldPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                >
                  {showOldPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Password Baru</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8"
                  placeholder="Min. 4 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                >
                  {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Konfirmasi Password Baru</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ulangi password baru"
              />
            </div>
          </div>
          {pwError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2 rounded-lg">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-2 rounded-lg">{pwSuccess}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleChangePassword}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Simpan
            </button>
            <button
              onClick={() => { setShowChangePassword(false); setPwError(''); setPwSuccess(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Main Balance Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saldo Akhir Tabungan
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-700">
              {formatRupiah(student.balance)}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Anak: <strong>{student.name}</strong> (NIS: {student.nis} / Kelas {student.classGrade})
            </p>
            {student.pendingDebt && student.pendingDebt > 0 && (
              <p className="text-xs text-rose-600 mt-0.5 font-semibold">
                Tunggakan Potongan: {formatRupiah(student.pendingDebt)}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() =>
            generateStudentCertificatePDF(student, studentTransactions, studentBookPayments, schoolSettings)
          }
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          Cetak Bukti Tabungan (PDF)
        </button>
      </div>

      {/* Tunggakan Alerts */}
      {(tunggakanBooks.length > 0 || tunggakanSpp.length > 0 || (student.pendingDebt && student.pendingDebt > 0)) && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Tunggakan
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {student.pendingDebt && student.pendingDebt > 0 && (
              <div className="p-3 bg-white rounded-xl border border-amber-200">
                <div className="font-bold text-amber-900">Potongan Bulanan</div>
                <div className="text-amber-700 mt-1">{formatRupiah(student.pendingDebt)}</div>
              </div>
            )}
            {tunggakanSpp.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-amber-200">
                <div className="font-bold text-amber-900">SPP Belum Lunas</div>
                <div className="text-amber-700 mt-1">{tunggakanSpp.length} bulan: {tunggakanSpp.join(', ')}</div>
              </div>
            )}
            {tunggakanBooks.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-amber-200">
                <div className="font-bold text-amber-900">Pembayaran Buku</div>
                <div className="text-amber-700 mt-1">{tunggakanBooks.length} item menunggu approval</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Savings Transaction History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="w-4 h-4 text-emerald-600" />
            Riwayat Transaksi Tabungan
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">No. Transaksi</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Jenis</th>
                  <th className="py-2.5 px-3">Nominal</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {studentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Belum ada riwayat transaksi tabungan.
                    </td>
                  </tr>
                ) : (
                  studentTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{t.transactionNumber}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{formatDate(t.createdAt)}</td>
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
                              : isPendingApprovalStatus(t.status)
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{t.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* SPP Payment History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              Riwayat Pembayaran SPP
            </h3>
            <div className="space-y-2 text-xs">
              {studentSppPayments.length === 0 ? (
                <div className="text-center py-4 text-slate-400">Belum ada pembayaran SPP.</div>
              ) : (
                studentSppPayments.map((sp) => (
                  <div key={sp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{sp.period}</div>
                      <div className="text-[10px] text-slate-500">Metode: {sp.paymentMethod}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {sp.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Book Distributions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Daftar Penyerahan Buku
            </h3>
            <div className="space-y-2 text-xs">
              {classBooks.length === 0 ? (
                <div className="text-center py-4 text-slate-400">Belum ada daftar buku untuk kelas ini.</div>
              ) : (
                classBooks.map((b) => {
                  const dist = studentBookDistributions.find((bd) => bd.bookId === b.id);
                  const isReceived = dist ? dist.received : false;
                  return (
                    <div key={b.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{b.title}</div>
                        <div className="text-[10px] text-slate-400">{b.category} • {formatRupiah(b.price)}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        isReceived ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isReceived ? (
                          <><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Diterima</>
                        ) : 'Belum'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Book Payments History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-purple-600" />
              Riwayat Pembayaran Buku
            </h3>
            <div className="space-y-2 text-xs">
              {studentBookPayments.length === 0 ? (
                <div className="text-center py-4 text-slate-400">Belum ada transaksi pembayaran buku.</div>
              ) : (
                studentBookPayments.map((bp) => (
                  <div key={bp.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{bp.bookTitle}</span>
                      <span className="text-emerald-700">{formatRupiah(bp.amount)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Metode: {bp.paymentMethod}</span>
                      <span className={`font-bold ${bp.status === 'Disetujui' ? 'text-emerald-600' : bp.status === 'Ditolak' ? 'text-rose-600' : 'text-amber-600'}`}>
                        {bp.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
