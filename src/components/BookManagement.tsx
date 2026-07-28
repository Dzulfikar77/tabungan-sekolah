/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Book, BookCategory, ClassGrade, PaymentMethod } from '../types';
import { ALL_CLASSES } from '../utils/initialData';
import { formatRupiah, formatDate } from '../utils/format';
import {
  BookOpen,
  Plus,
  CheckCircle2,
  Clock,
  Search,
  CheckSquare,
  Square,
  CreditCard,
  Banknote,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';

export const BookManagement: React.FC = () => {
  const {
    books,
    addBook,
    deleteBook,
    students,
    bookDistributions,
    toggleBookDistribution,
    bookPayments,
    addBookPayment,
    currentAcademicYear,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'distribution' | 'payment'>('catalog');

  // Book Add Modal State
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookCategory, setBookCategory] = useState<BookCategory>('LKS');
  const [bookClass, setBookClass] = useState<ClassGrade>('Kelas 1A');
  const [bookPrice, setBookPrice] = useState<number>(35000);

  // Distribution State Filter
  const [distClassFilter, setDistClassFilter] = useState<ClassGrade>('Kelas 1A');

  // Payment Form State
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const activeStudents = students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  );

  const classes = ALL_CLASSES;

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim() || bookPrice <= 0) return;

    addBook({
      title: bookTitle.trim(),
      category: bookCategory,
      classGrade: bookClass,
      price: bookPrice,
    });

    setIsAddBookOpen(false);
    setBookTitle('');
    setBookPrice(35000);
  };

  const handleProcessBookPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    if (!selectedBookId || !selectedStudentId) {
      setPaymentError('Silakan pilih buku dan siswa terlebih dahulu.');
      return;
    }

    const res = addBookPayment(selectedBookId, selectedStudentId, paymentMethod);

    if (!res.success) {
      setPaymentError(res.error || 'Gagal memproses pembayaran buku.');
    } else {
      setPaymentSuccess(
        paymentMethod === 'Tunai'
          ? 'Pembayaran tunai berhasil dicatat dan status distribusi buku otomatis diperbarui.'
          : 'Pengajuan pembayaran via potong tabungan berhasil dikirim. Menunggu persetujuan Super Admin.'
      );
      setSelectedBookId('');
      setSelectedStudentId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tab Navigation */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'catalog'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Katalog Data Buku
          </button>
          <button
            onClick={() => setActiveSubTab('distribution')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'distribution'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckSquare className="w-4 h-4" /> Status Penyerahan Buku
          </button>
          <button
            onClick={() => setActiveSubTab('payment')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'payment'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Input Pembayaran Buku
          </button>
        </div>

        {activeSubTab === 'catalog' && (
          <button
            onClick={() => setIsAddBookOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Tambah Data Buku
          </button>
        )}
      </div>

      {/* 1. Catalog Tab */}
      {activeSubTab === 'catalog' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Master Katalog Buku & LKS</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Judul Buku</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Untuk Kelas</th>
                  <th className="py-3 px-4">Harga (Rp)</th>
                  <th className="py-3 px-4 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {books.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada data buku tersimpan.
                    </td>
                  </tr>
                ) : (
                  books.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{b.title}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.category === 'LKS' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {b.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">Kelas {b.classGrade}</td>
                      <td className="py-3 px-4 font-extrabold text-emerald-700">
                        {formatRupiah(b.price)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => deleteBook(b.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Distribution Status Tab */}
      {activeSubTab === 'distribution' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Status Penyerahan / Diterimanya Buku Oleh Siswa
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Pilih Kelas:</span>
              <select
                value={distClassFilter}
                onChange={(e) => setDistClassFilter(e.target.value as ClassGrade)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              >
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Siswa (NIS)</th>
                  {books
                    .filter((b) => b.classGrade === distClassFilter)
                    .map((b) => (
                      <th key={b.id} className="py-3 px-4 text-center">
                        {b.title} <span className="block text-[10px] text-emerald-600">{formatRupiah(b.price)}</span>
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {activeStudents.filter((s) => s.classGrade === distClassFilter).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Tidak ada siswa di Kelas {distClassFilter}.
                    </td>
                  </tr>
                ) : (
                  activeStudents
                    .filter((s) => s.classGrade === distClassFilter)
                    .map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {st.name} <span className="text-slate-400 font-normal">({st.nis})</span>
                        </td>
                        {books
                          .filter((b) => b.classGrade === distClassFilter)
                          .map((b) => {
                            const dist = bookDistributions.find(
                              (bd) => bd.bookId === b.id && bd.studentId === st.id
                            );
                            const received = dist ? dist.received : false;

                            return (
                              <td key={b.id} className="py-3 px-4 text-center">
                                <button
                                  onClick={() => toggleBookDistribution(b.id, st.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                    received
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {received ? (
                                    <>
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                      Diterima
                                    </>
                                  ) : (
                                    <>
                                      <Square className="w-3.5 h-3.5 text-slate-400" />
                                      Belum
                                    </>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Input Payment Tab */}
      {activeSubTab === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
              Input Transaksi Pembayaran Buku
            </h3>

            <form onSubmit={handleProcessBookPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Buku *</label>
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">-- Pilih Buku Dari Katalog --</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (Kelas {b.classGrade}) — {formatRupiah(b.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Siswa *</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nis} - {s.name} (Kelas {s.classGrade}) — Saldo: {formatRupiah(s.balance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">Metode Pembayaran *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex items-center gap-2 transition-colors ${
                      paymentMethod === 'Tunai'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div>Tunai (Cash)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Langsung lunas disetujui</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Potong Tabungan')}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex items-center gap-2 transition-colors ${
                      paymentMethod === 'Potong Tabungan'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-purple-600" />
                    <div>
                      <div>Potong Tabungan</div>
                      <div className="text-[10px] text-slate-500 font-normal">Memerlukan approval Super Admin</div>
                    </div>
                  </button>
                </div>
              </div>

              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {paymentSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{paymentSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-xs"
              >
                Simpan Transaksi Pembayaran Buku
              </button>
            </form>
          </div>

          {/* History of Book Payments */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Riwayat Transaksi Buku
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 text-xs">
              {bookPayments.length === 0 ? (
                <div className="text-center py-6 text-slate-400">Belum ada riwayat pembayaran buku.</div>
              ) : (
                bookPayments.map((bp) => (
                  <div key={bp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between items-start font-bold text-slate-900">
                      <span>{bp.bookTitle}</span>
                      <span className="text-emerald-700 font-extrabold">{formatRupiah(bp.amount)}</span>
                    </div>
                    <div className="text-slate-600">
                      Siswa: {bp.studentName} ({bp.studentNis})
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                      <span>Metode: <strong>{bp.paymentMethod}</strong></span>
                      <span
                        className={`font-bold ${
                          bp.status === 'Disetujui' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {bp.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {isAddBookOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Buku Baru</h3>
              <button onClick={() => setIsAddBookOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Buku / LKS *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: LKS Bahasa Indonesia Semester 1"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={bookCategory}
                    onChange={(e) => setBookCategory(e.target.value as BookCategory)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="LKS">LKS</option>
                    <option value="Buku Penunjang">Buku Penunjang</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Untuk Kelas</label>
                  <select
                    value={bookClass}
                    onChange={(e) => setBookClass(e.target.value as ClassGrade)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Harga Buku (Rp) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={bookPrice}
                  onChange={(e) => setBookPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBookOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Simpan Buku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
