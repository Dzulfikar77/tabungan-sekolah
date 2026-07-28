/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatDate } from '../utils/format';
import { generateStudentCertificatePDF } from '../utils/pdfGenerator';
import {
  Wallet,
  BookOpen,
  CheckCircle2,
  Printer,
  History,
  Search,
  User,
  ShieldCheck,
  CreditCard,
  XCircle,
  Clock,
} from 'lucide-react';

export const ViewerPage: React.FC = () => {
  const {
    students,
    transactions,
    books,
    bookDistributions,
    bookPayments,
    schoolSettings,
    currentUser,
    currentAcademicYear,
  } = useApp();

  const activeStudents = students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  );

  // Default selected student: if user has studentId, or first student
  const defaultStudentId = currentUser.studentId || (activeStudents[0]?.id ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(defaultStudentId);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedStudent = activeStudents.find((s) => s.id === selectedStudentId) || activeStudents[0];

  const studentTransactions = selectedStudent
    ? transactions.filter((t) => t.studentId === selectedStudent.id)
    : [];

  const studentBookPayments = selectedStudent
    ? bookPayments.filter((bp) => bp.studentId === selectedStudent.id)
    : [];

  const studentBookDistributions = selectedStudent
    ? bookDistributions.filter((bd) => bd.studentId === selectedStudent.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Read-Only Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold">Portal Orang Tua & Siswa (Read-Only)</h2>
            <p className="text-xs text-slate-300">
              Pantau informasi saldo tabungan, riwayat setoran, serta status penyerahan buku sekolah
            </p>
          </div>
        </div>

        {/* Student Selector Dropdown for demo / testing */}
        <div className="flex items-center gap-2 bg-white/10 p-2 rounded-xl border border-white/10 text-xs">
          <User className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300 font-medium">Pilih Siswa:</span>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="bg-slate-800 text-white font-bold rounded-lg px-2 py-1 focus:outline-none cursor-pointer border border-slate-700"
          >
            {activeStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.nis} - Kelas {s.classGrade})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedStudent && (
        <>
          {/* Main Balance & Print Certificate Card */}
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
                  {formatRupiah(selectedStudent.balance)}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Anak: <strong>{selectedStudent.name}</strong> (NIS: {selectedStudent.nis} / Kelas {selectedStudent.classGrade})
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                generateStudentCertificatePDF(
                  selectedStudent,
                  studentTransactions,
                  studentBookPayments,
                  schoolSettings
                )
              }
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              Cetak Bukti Tabungan (PDF)
            </button>
          </div>

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
                                  : t.status === 'Menunggu Persetujuan'
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

            {/* Right: Book Distributions & Book Payments */}
            <div className="space-y-6">
              {/* Received Books Status */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Daftar Penyerahan Buku Kelas {selectedStudent.classGrade}
                </h3>

                <div className="space-y-2 text-xs">
                  {books.filter((b) => b.classGrade === selectedStudent.classGrade).length === 0 ? (
                    <div className="text-center py-4 text-slate-400">Belum ada daftar buku untuk kelas ini.</div>
                  ) : (
                    books
                      .filter((b) => b.classGrade === selectedStudent.classGrade)
                      .map((b) => {
                        const dist = studentBookDistributions.find((bd) => bd.bookId === b.id);
                        const isReceived = dist ? dist.received : false;

                        return (
                          <div
                            key={b.id}
                            className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{b.title}</div>
                              <div className="text-[10px] text-slate-400">
                                {b.category} • {formatRupiah(b.price)}
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                isReceived
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {isReceived ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Diterima
                                </>
                              ) : (
                                'Belum'
                              )}
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
                          <span className="font-bold text-emerald-600">{bp.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
