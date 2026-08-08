/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  KoperasiKegiatanItem,
  KoperasiKegiatanType,
  ClassGrade,
  PaymentMethod,
  BookPayment,
} from '../types';
import { formatRupiah, formatDate, filterByAccessLevel, filterByUserLevel, levelVisibleClasses, isBookVisible } from '../utils/format';
import {
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
  Layers,
  ShoppingBag,
  Compass,
  ShieldCheck,
  UserCheck,
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
    approveWithdrawal,
    rejectWithdrawal,
    currentUser,
    currentAcademicYear,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'distribution' | 'payment'>('payment');

  // Add Item Modal State
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [itemType, setItemType] = useState<KoperasiKegiatanType>('Koperasi');
  const [itemCategoryChoice, setItemCategoryChoice] = useState<string>('Buku');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemClass, setItemClass] = useState<ClassGrade | 'Semua Kelas'>('Semua Kelas');
  const [itemPrice, setItemPrice] = useState<number>(25000);

  // Distribution Filter
  const [distClassFilter, setDistClassFilter] = useState<ClassGrade>(() =>
    currentUser.accessLevel === 'TK' ? 'TK A' : 'Kelas 1A'
  );

  // Transaction Input Form State
  const [transType, setTransType] = useState<KoperasiKegiatanType>('Koperasi');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedStudentClass, setSelectedStudentClass] = useState<ClassGrade>('Kelas 1A');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const activeStudents = filterByAccessLevel(students.filter(
    (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
  ), currentUser);

  const filteredStudents = activeStudents.filter((s) => {
    const matchesClass = s.classGrade === selectedStudentClass;
    const matchesSearch =
      s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      s.nis.toLowerCase().includes(studentSearchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const visibleBooks = books.filter((b) => isBookVisible(b, currentUser));

  // Filter items available for selected transaction type
  const availableItems = visibleBooks.filter((b) => (b.type || 'Koperasi') === transType);

  const selectedItem = visibleBooks.find((b) => b.id === selectedItemId);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const visibleBookPayments = filterByUserLevel<BookPayment>(bookPayments, currentUser);

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || itemPrice <= 0) return;

    const finalCategory =
      itemCategoryChoice === 'Lainnya' ? customCategory.trim() || 'Lainnya' : itemCategoryChoice;

    addBook({
      title: itemTitle.trim(),
      type: itemType,
      category: finalCategory,
      classGrade: itemClass,
      price: itemPrice,
    });

    setIsAddItemOpen(false);
    setItemTitle('');
    setCustomCategory('');
    setItemPrice(25000);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');

    if (!selectedItemId || !selectedStudentId) {
      setPaymentError('Silakan pilih item (Koperasi/Kegiatan) dan siswa terlebih dahulu.');
      return;
    }

    const res = await addBookPayment(selectedItemId, selectedStudentId, paymentMethod);

    if (!res.success) {
      setPaymentError(res.error || 'Gagal memproses transaksi.');
    } else {
      setPaymentSuccess(
        paymentMethod === 'Tunai'
          ? 'Transaksi pembayaran tunai berhasil dicatat!'
          : 'Pengajuan potong tabungan berhasil dibuat! Memerlukan persetujuan Admin (Wali Kelas) & Super Admin (Kepala Sekolah).'
      );
      setSelectedItemId('');
      setSelectedStudentId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveSubTab('payment')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'payment'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Input Transaksi Koperasi & Kegiatan
          </button>
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'catalog'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" /> Katalog Master Item
          </button>
          <button
            onClick={() => setActiveSubTab('distribution')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
              activeSubTab === 'distribution'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckSquare className="w-4 h-4" /> Status Penyerahan / Keikutsertaan
          </button>
        </div>

        {activeSubTab === 'catalog' && (
          <button
            onClick={() => setIsAddItemOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Tambah Item Baru
          </button>
        )}
      </div>

      {/* 1. INPUT TRANSAKSI (KOPERASI & KEGIATAN) */}
      {activeSubTab === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Transaction Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Input Pembayaran Koperasi & Kegiatan Sekolah
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih tipe transaksi, item, siswa, dan metode pembayaran.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200">
                1 Section Terpadu
              </span>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-4 text-xs">
              {/* STEP 1: Choose Section Type (Koperasi vs Kegiatan) */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  1. Pilih Kategori Section *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTransType('Koperasi');
                      setSelectedItemId('');
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex items-center gap-3 transition-all ${
                      transType === 'Koperasi'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <ShoppingBag
                      className={`w-5 h-5 ${
                        transType === 'Koperasi' ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold">Koperasi Sekolah</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Buku, Seragam, Alat Tulis & item khusus
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransType('Kegiatan');
                      setSelectedItemId('');
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex items-center gap-3 transition-all ${
                      transType === 'Kegiatan'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Compass
                      className={`w-5 h-5 ${
                        transType === 'Kegiatan' ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-bold">Kegiatan Siswa</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Outing class, Outbound & kegiatan sekolah
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 2: Choose Item */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  2. Pilih Item {transType} *
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Pilih Item {transType} --</option>
                  {availableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.title} (Kelas: {item.classGrade}) — {formatRupiah(item.price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* STEP 3: Choose Class & Student */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800 mb-1">
                    3a. Pilih Kelas Siswa *
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto p-0.5">
                    {levelVisibleClasses(currentUser).map((cls) => {
                      const count = activeStudents.filter((s) => s.classGrade === cls).length;
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => { setSelectedStudentClass(cls); setSelectedStudentId(''); }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                            selectedStudentClass === cls
                              ? 'bg-slate-900 text-white shadow-xs'
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

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    3b. Cari & Pilih Nama Siswa *
                  </label>
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cari nama / NIS siswa..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
                      />
                    </div>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.nis}) — Saldo: {formatRupiah(s.balance)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedStudent && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{selectedStudent.name}</span>
                    <span className="text-slate-500 block text-[11px]">
                      NIS: {selectedStudent.nis} | Kelas: {selectedStudent.classGrade}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 text-[10px] block">Saldo Tabungan</span>
                    <span className="font-bold text-emerald-700 text-xs">
                      {formatRupiah(selectedStudent.balance)}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 4: Choose Payment Method */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  4. Metode Pembayaran *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tunai')}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex items-center gap-3 transition-colors ${
                      paymentMethod === 'Tunai'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Tunai (Cash)</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Langsung lunas & disetujui
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Potong Tabungan')}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex items-center gap-3 transition-colors ${
                      paymentMethod === 'Potong Tabungan'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-purple-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Potong Tabungan</div>
                      <div className="text-[10px] text-purple-700 font-medium">
                        Perlu Approval 2-Tier (Admin & Super Admin)
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {paymentMethod === 'Potong Tabungan' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Alur Persetujuan 2-Tier Potong Tabungan:
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-700 pl-1">
                    <li>
                      <strong>Tahap 1 (Admin / Wali Kelas):</strong> Menyetujui pengajuan potongan.
                    </li>
                    <li>
                      <strong>Tahap 2 (Super Admin / Kepala Sekolah):</strong> Persetujuan final & pemotongan saldo tabungan.
                    </li>
                  </ol>
                </div>
              )}

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
                Proses Transaksi {transType}
              </button>
            </form>
          </div>

          {/* History & Approval List Sidebar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Riwayat Transaksi</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({visibleBookPayments.length} item)
              </span>
            </h3>

            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1 text-xs">
              {visibleBookPayments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  Belum ada transaksi Koperasi & Kegiatan.
                </div>
              ) : (
                visibleBookPayments.map((bp) => (
                  <div
                    key={bp.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                  >
                    <div className="flex justify-between items-start font-bold text-slate-900">
                      <div>
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 text-[9px] rounded-md mr-1 uppercase">
                          {bp.itemType || 'Koperasi'}
                        </span>
                        <span>{bp.itemTitle || bp.bookTitle}</span>
                      </div>
                      <span className="text-emerald-700 font-extrabold shrink-0 ml-2">
                        {formatRupiah(bp.amount)}
                      </span>
                    </div>

                    <div className="text-slate-600 text-[11px]">
                      Siswa: <strong>{bp.studentName}</strong> ({bp.classGrade})
                    </div>

                    {/* Status Badge & Approval details */}
                    <div className="pt-1 border-t border-slate-200 flex flex-col gap-1.5 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Metode: <strong>{bp.paymentMethod}</strong></span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            bp.status === 'Disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : bp.status === 'Menunggu Approval Super Admin'
                              ? 'bg-amber-100 text-amber-800'
                              : bp.status === 'Menunggu Approval Admin'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {bp.status}
                        </span>
                      </div>

                      {bp.paymentMethod === 'Potong Tabungan' && (
                        <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span>1. Admin / Wali Kelas:</span>
                            <span className="font-bold">
                              {bp.approvedByAdmin ? '✅ Disetujui' : '⏳ Pending'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span>2. Super Admin (Kepsek):</span>
                            <span className="font-bold">
                              {bp.approvedBySuperAdmin ? '✅ Disetujui' : '⏳ Pending'}
                            </span>
                          </div>

                          {/* Quick Approve Action buttons inside sidebar for Wali Kelas / Admin / Super Admin */}
                          {bp.savingsTransactionId && bp.status !== 'Disetujui' && bp.status !== 'Ditolak' && (
                            <div className="pt-1.5 flex gap-1">
                              {(currentUser.role === 'Wali Kelas' || currentUser.role === 'Admin') && !bp.approvedByAdmin && (
                                <button
                                  onClick={async () => {
                                    const r = await approveWithdrawal(bp.savingsTransactionId!);
                                    if (!r.success) alert(r.error);
                                  }}
                                  className="w-full py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-[10px] cursor-pointer"
                                >
                                  Approve Admin
                                </button>
                              )}

                              {(currentUser.role === 'Super Admin' || currentUser.role === 'Developer') && (
                                <button
                                  onClick={async () => {
                                    const r = await approveWithdrawal(bp.savingsTransactionId!);
                                    if (!r.success) alert(r.error);
                                  }}
                                  className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[10px] cursor-pointer"
                                >
                                  Approve Kepsek
                                </button>
                              )}

                              <button
                                onClick={async () => {
                                  const r = await rejectWithdrawal(bp.savingsTransactionId!, 'Ditolak dari menu Koperasi');
                                  if (!r.success) alert(r.error);
                                }}
                                className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md font-bold text-[10px] cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MASTER CATALOG TAB */}
      {activeSubTab === 'catalog' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Master Katalog Koperasi & Kegiatan</h3>
              <p className="text-xs text-slate-500">
                Daftar lengkap item Koperasi (Buku, Seragam, Alat Tulis) dan Kegiatan (Outing class, Outbound, dll).
              </p>
            </div>
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Tambah Item Baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Nama Item</th>
                  <th className="py-3 px-4">Tipe Section</th>
                  <th className="py-3 px-4">Kategori Item</th>
                  <th className="py-3 px-4">Untuk Kelas</th>
                  <th className="py-3 px-4">Harga (Rp)</th>
                  <th className="py-3 px-4 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleBooks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada data item tersimpan.
                    </td>
                  </tr>
                ) : (
                  visibleBooks.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{b.title}</td>
                      <td className="py-3 px-4 font-bold">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            b.type === 'Kegiatan'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {b.type || 'Koperasi'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{b.category}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{b.classGrade}</td>
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

      {/* 3. DISTRIBUTION / KEIKUTSERTAAN STATUS TAB */}
      {activeSubTab === 'distribution' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Status Penyerahan Item / Keikutsertaan Kegiatan
              </h3>
              <p className="text-xs text-slate-500">
                Centang status diterimanya barang Koperasi atau keikutsertaan Kegiatan per kelas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Pilih Kelas:</span>
              <select
                value={distClassFilter}
                onChange={(e) => setDistClassFilter(e.target.value as ClassGrade)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
              >
                {levelVisibleClasses(currentUser).map((cls) => (
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
                  {visibleBooks
                    .filter((b) => b.classGrade === distClassFilter || b.classGrade === 'Semua Kelas')
                    .map((b) => (
                      <th key={b.id} className="py-3 px-4 text-center">
                        <div className="font-bold">{b.title}</div>
                        <span className="text-[10px] text-emerald-600 block">{formatRupiah(b.price)}</span>
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
                          .filter((b) => b.classGrade === distClassFilter || b.classGrade === 'Semua Kelas')
                          .map((b) => {
                            const dist = bookDistributions.find(
                              (bd) => (bd.itemId === b.id || bd.bookId === b.id) && bd.studentId === st.id
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
                                      Sudah
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

      {/* MODAL: ADD NEW ITEM (KOPERASI / KEGIATAN) */}
      {isAddItemOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Master Item Baru</h3>
              <button
                onClick={() => setIsAddItemOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Section *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setItemType('Koperasi');
                      setItemCategoryChoice('Buku');
                    }}
                    className={`p-2 rounded-lg border text-center font-bold cursor-pointer ${
                      itemType === 'Koperasi'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Koperasi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemType('Kegiatan');
                      setItemCategoryChoice('Outing Class');
                    }}
                    className={`p-2 rounded-lg border text-center font-bold cursor-pointer ${
                      itemType === 'Kegiatan'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Kegiatan
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Item *</label>
                {itemType === 'Koperasi' ? (
                  <select
                    value={itemCategoryChoice}
                    onChange={(e) => setItemCategoryChoice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-medium"
                  >
                    <option value="Buku">Buku</option>
                    <option value="Seragam">Seragam</option>
                    <option value="Alat Tulis">Alat Tulis</option>
                    <option value="Lainnya">+ Tambah Item Custom</option>
                  </select>
                ) : (
                  <select
                    value={itemCategoryChoice}
                    onChange={(e) => setItemCategoryChoice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none font-medium"
                  >
                    <option value="Outing Class">Outing Class</option>
                    <option value="Outbound">Outbound</option>
                    <option value="Lainnya">+ Tambah Item Custom</option>
                  </select>
                )}
              </div>

              {itemCategoryChoice === 'Lainnya' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Kategori Custom *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Majalah Sekolah, Field Trip, dll."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Item / Kegiatan *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    itemType === 'Koperasi'
                      ? 'Contoh: Seragam Olahraga Lengkap / LKS Matematika'
                      : 'Contoh: Outing Class Ke Museum / Leadership Camp'
                  }
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Untuk Kelas</label>
                  <select
                    value={itemClass}
                    onChange={(e) => setItemClass(e.target.value as ClassGrade | 'Semua Kelas')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="Semua Kelas">Semua Kelas</option>
                    {levelVisibleClasses(currentUser).map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga / Biaya (Rp) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Simpan Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
