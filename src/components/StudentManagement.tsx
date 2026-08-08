/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Student, ClassGrade, StudentStatus } from '../types';
import { formatRupiah, formatDate, filterByAccessLevel } from '../utils/format';
import { downloadStudentImportTemplate, parseStudentsExcel } from '../utils/excelHandler';
import { YearEndDecision, isGraduatingClass } from '../utils/yearEnd';
import {
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Edit2,
  Trash2,
  ArrowRightLeft,
  CalendarCheck,
  X,
  AlertCircle,
  CheckCircle,
  KeyRound,
} from 'lucide-react';

import { ALL_CLASSES } from '../utils/initialData';

export const StudentManagement: React.FC = () => {
  const {
    students,
    addStudent,
    updateStudent,
    softDeleteStudent,
    importStudentsBulk,
    bulkPromoteStudents,
    runYearEndClosure,
    currentAcademicYear,
    currentUser,
    academicYears,
    backfillViewerCredentials,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Aktif');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ addedCount: number; errors: string[] } | null>(null);

  const [isBackfillModalOpen, setIsBackfillModalOpen] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ created: number; errors: string[] } | null>(null);

  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [fromClass, setFromClass] = useState<ClassGrade>(ALL_CLASSES[0]);
  const [toClass, setToClass] = useState<string>(ALL_CLASSES[0]);

  const [isYearEndModalOpen, setIsYearEndModalOpen] = useState(false);
  const [yearEndClassFilter, setYearEndClassFilter] = useState<string>('ALL');
  const [yearEndTargetYearId, setYearEndTargetYearId] = useState<string>(currentAcademicYear.id);
  const [yearEndDecisions, setYearEndDecisions] = useState<Record<string, 'naik' | 'tinggal'>>({});
  const [yearEndRunning, setYearEndRunning] = useState(false);
  const [yearEndResult, setYearEndResult] = useState<{ success: boolean; moved: number; repeated: number; skipped: number; totalWithdrawn: number; errors: string[] } | null>(null);

  // Form State for Add
  const [nis, setNis] = useState('');
  const [name, setName] = useState('');
  const [classGrade, setClassGrade] = useState<ClassGrade>(ALL_CLASSES[0]);
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [formError, setFormError] = useState('');

  // Filter Active Non-Deleted Students
  const activeStudents = filterByAccessLevel(students.filter(
    (s) =>
      !s.isDeleted &&
      s.academicYearId === currentAcademicYear.id &&
      (selectedClassFilter === 'ALL' || s.classGrade === selectedClassFilter) &&
      (selectedStatusFilter === 'ALL' || s.status === selectedStatusFilter) &&
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nis.toLowerCase().includes(searchTerm.toLowerCase()))
  ), currentUser);

  const classes = ALL_CLASSES;

  const handleSaveAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nis.trim() || !name.trim()) {
      setFormError('NIS dan Nama Lengkap wajib diisi!');
      return;
    }

    const res = await addStudent({
      nis: nis.trim(),
      name: name.trim(),
      classGrade,
      status: 'Aktif',
      parentName: parentName.trim(),
      phone: phone.trim(),
      initialBalance: Number(initialBalance) || 0,
      academicYearId: currentAcademicYear.id,
    });

    if (!res.success) {
      setFormError(res.error || 'Gagal menambahkan siswa.');
    } else {
      setIsAddModalOpen(false);
      resetForm();
    }
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      const res = await updateStudent(editingStudent.id, {
        name,
        classGrade,
        status: editingStudent.status,
        parentName,
        phone,
      });
      if (res.success) {
        setIsEditModalOpen(false);
        setEditingStudent(null);
      } else {
        setFormError(res.error || 'Gagal menyimpan perubahan siswa.');
      }
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNis(student.nis);
    setName(student.name);
    setClassGrade(student.classGrade);
    setParentName(student.parentName || '');
    setPhone(student.phone || '');
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: string, studentName: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${studentName}? Data histori transaksi akan tetap tersimpan di Audit Log.`)) {
      await softDeleteStudent(id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleProcessImport = async () => {
    if (!importFile) return;
    try {
      const { validStudents, errors: parseErrors } = await parseStudentsExcel(importFile, currentAcademicYear.id);
      const res = await importStudentsBulk(validStudents);
      setImportResult({
        addedCount: res.addedCount,
        errors: [...parseErrors, ...res.errors],
      });
    } catch (err) {
      setImportResult({ addedCount: 0, errors: ['Gagal memproses file Excel. Pastikan format sesuai template.'] });
    }
  };

  const handleProcessPromote = () => {
    if (confirm(`Apakah Anda yakin ingin memindahkan seluruh siswa aktif dari Kelas ${fromClass} ke Kelas ${toClass}?`)) {
      bulkPromoteStudents(fromClass, toClass);
      setIsPromoteModalOpen(false);
    }
  };

  const yearEndCandidates = students.filter((s) =>
    !s.isDeleted &&
    s.status === 'Aktif' &&
    s.academicYearId === currentAcademicYear.id &&
    !isGraduatingClass(s.classGrade) &&
    (yearEndClassFilter === 'ALL' || s.classGrade === yearEndClassFilter)
  );

  const handleOpenYearEndModal = () => {
    setYearEndClassFilter('ALL');
    setYearEndTargetYearId(currentAcademicYear.id);
    setYearEndDecisions({});
    setYearEndResult(null);
    setIsYearEndModalOpen(true);
  };

  const handleProcessYearEnd = async () => {
    if (yearEndCandidates.length === 0) return;
    const decisions: YearEndDecision[] = yearEndCandidates.map((s) => ({
      studentId: s.id,
      action: yearEndDecisions[s.id] ?? 'naik',
    }));
    if (!confirm(`Proses Penutupan Tahun Ajaran untuk ${decisions.length} siswa?\n\nTabungan ditarik penuh (setelah dipotong utang), siswa naik atau tetap di kelas, lalu pindah ke tahun ajaran tujuan.`)) return;
    setYearEndRunning(true);
    const res = await runYearEndClosure(decisions, yearEndTargetYearId);
    setYearEndResult(res);
    setYearEndRunning(false);
  };

  const handleProcessBackfill = async () => {
    setBackfillResult(await backfillViewerCredentials());
  };

  const resetForm = () => {
    setNis('');
    setName('');
    setClassGrade(ALL_CLASSES[0]);
    setParentName('');
    setPhone('');
    setInitialBalance(0);
    setFormError('');
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Manajemen Data Master Siswa
          </h2>
          <p className="text-xs text-slate-500">
            Tahun Ajaran {currentAcademicYear.year} • Total: {activeStudents.length} Siswa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Siswa
          </button>

          <button
            onClick={() => {
              setImportFile(null);
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </button>

          {currentUser && (currentUser.role === 'Developer' || currentUser.role === 'Super Admin' || currentUser.role === 'Admin') && (
            <button
              onClick={() => {
                setBackfillResult(null);
                setIsBackfillModalOpen(true);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <KeyRound className="w-4 h-4" />
              Backfill Kredensial
            </button>
          )}

          <button
            onClick={() => setIsPromoteModalOpen(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Pindah Kelas Massal
          </button>

          {currentUser && (currentUser.role === 'Developer' || currentUser.role === 'Super Admin' || currentUser.role === 'Admin' || currentUser.role === 'Wali Kelas') && (
            <button
              onClick={handleOpenYearEndModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <CalendarCheck className="w-4 h-4" />
              Penutupan Tahun
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari NIS atau Nama Siswa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Class Filter */}
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((cls) => (
              <option key={cls} value={cls}>
                Kelas {cls}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="Aktif">Aktif</option>
            <option value="Lulus">Lulus</option>
            <option value="Pindah">Pindah</option>
            <option value="Keluar">Keluar</option>
          </select>
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4">Orang Tua / Wali</th>
                <th className="py-3 px-4">Saldo Tabungan</th>
                <th className="py-3 px-4">Tunggakan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {activeStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              ) : (
                activeStudents.map((st, index) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{st.nis}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{st.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                        Kelas {st.classGrade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {st.parentName || '-'} {st.phone && `(${st.phone})`}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      {formatRupiah(st.balance)}
                    </td>
                    <td className="py-3 px-4">
                      {st.pendingDebt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {formatRupiah(st.pendingDebt)}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          st.status === 'Aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : st.status === 'Lulus'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(st)}
                          title="Edit Data Siswa"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(st.id, st.name)}
                          title="Hapus Siswa (Soft Delete)"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Tambah Siswa Baru</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  NIS (Nomor Induk Siswa) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2025006"
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap siswa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas</label>
                  <select
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value as ClassGrade)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Orang Tua / Wali
                </label>
                <input
                  type="text"
                  placeholder="Nama orang tua/wali"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. Telepon / WhatsApp</label>
                <input
                  type="text"
                  placeholder="0812xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Edit Data Siswa</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIS (Tidak Dapat Diubah)</label>
                <input
                  type="text"
                  disabled
                  value={editingStudent.nis}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kelas</label>
                <select
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value as ClassGrade)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                >
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Orang Tua</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No Telepon</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Perbarui Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Import Massal Siswa via Excel</h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-blue-900">Unduh Format Template Excel</div>
                  <div className="text-[11px] text-blue-700">
                    Isi kolom Kelas dengan nilai tepat: TK A.1, TK A.2, TK B.1, TK B.2, Kelas 1A, Kelas 1 B, ..., Kelas 6B.
                    Lihat sheet "Daftar Kelas Valid" di dalam template.
                  </div>
                </div>
                <button
                  onClick={downloadStudentImportTemplate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Template
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih File Excel (.xlsx / .xls)</label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {importResult && (
                <div className="p-3 rounded-xl border text-xs space-y-1 bg-slate-50 border-slate-200">
                  <div className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Berhasil Mengimport: {importResult.addedCount} Siswa
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-rose-600 space-y-0.5">
                      <div className="font-bold">Catatan Peringatan/Error:</div>
                      {importResult.errors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={handleProcessImport}
                  disabled={!importFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Proses Import File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backfill Viewer Credentials Modal */}
      {isBackfillModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Backfill Kredensial Viewer</h3>
              <button
                onClick={() => setIsBackfillModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Membuat <strong>User Viewer</strong> (portal orang tua & siswa) untuk seluruh siswa aktif yang
                belum punya akses. Username diambil dari nama siswa (tanpa spasi), password mengikuti
                tahun ajaran masing-masing siswa + nomor urut 3 digit (contoh <code>20252026001</code>).
                Siswa yang sudah punya User Viewer tidak akan diubah.
              </p>

              {backfillResult && (
                <div className="p-3 rounded-xl border text-xs bg-slate-50 border-slate-200">
                  <div className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> {backfillResult.created} User Viewer berhasil dibuat
                  </div>
                  {backfillResult.errors.length > 0 && (
                    <div className="mt-2 text-rose-600 space-y-0.5">
                      {backfillResult.errors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsBackfillModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={handleProcessBackfill}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Proses Backfill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Promote Class Modal */}
      {isPromoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Pindah Kelas Massal (Kenaikan Kelas)</h3>
              <button
                onClick={() => setIsPromoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Fitur ini akan memindahkan <strong>seluruh siswa aktif</strong> pada kelas asal ke kelas tujuan secara instan untuk tahun ajaran baru.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dari Kelas Asal</label>
                  <select
                    value={fromClass}
                    onChange={(e) => setFromClass(e.target.value as ClassGrade)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ke Kelas Tujuan</label>
                  <select
                    value={toClass}
                    onChange={(e) => setToClass(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                    <option value="Lulus">Lulus (Status Lulus)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-[11px]">
                <strong>Catatan:</strong> Siswa yang dipindahkan ke "Lulus" statusnya akan berubah menjadi Lulus dan tersimpan selamanya.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsPromoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleProcessPromote}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg cursor-pointer shadow-xs"
                >
                  Eksekusi Pindah Kelas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Penutupan Tahun Modal */}
      {isYearEndModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full border border-slate-100 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Penutupan Tahun Ajaran {currentAcademicYear.year}</h3>
              <button
                onClick={() => setIsYearEndModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Tabungan seluruh siswa <strong>ditarik penuh</strong> di akhir tahun (utang potongan bulanan
                dipotong dulu dari saldo — saldo tidak pernah minus, sisa utang tetap menempel).
                Siswa <strong>Naik</strong> ke kelas berikutnya, atau <strong>tidak naik</strong> dan tetap di kelas yang sama.
                Kelas lulus (TK B / Kelas 6) tidak termasuk — gunakan <strong>Tutup Tabungan</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Filter Kelas</label>
                  <select
                    value={yearEndClassFilter}
                    onChange={(e) => setYearEndClassFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="ALL">Semua Kelas</option>
                    {ALL_CLASSES.filter((c) => !isGraduatingClass(c)).map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun Ajaran Tujuan</label>
                  <select
                    value={yearEndTargetYearId}
                    onChange={(e) => setYearEndTargetYearId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {yearEndCandidates.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Tidak ada siswa aktif (non-lulus) pada kelas terpilih.</div>
              ) : (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {yearEndCandidates.map((s) => {
                    const isTinggal = (yearEndDecisions[s.id] ?? 'naik') === 'tinggal';
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{s.name} <span className="text-slate-400 font-normal">({s.nis})</span></div>
                          <div className="text-[11px] text-slate-500">
                            Kelas {s.classGrade} • Saldo {formatRupiah(s.balance)}
                          </div>
                          <div className="text-[11px] text-indigo-600">
                            Kas ke wali: {formatRupiah(s.balance)} (ditarik penuh)
                          </div>
                          <div className="text-[11px] text-amber-600">
                            {s.pendingDebt ? <>Tunggakan: {formatRupiah(s.pendingDebt)} — tetap menempel (tidak dipotong)</> : 'Tanpa tunggakan'}
                          </div>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={isTinggal}
                            onChange={(e) =>
                              setYearEndDecisions((prev) => ({ ...prev, [s.id]: e.target.checked ? 'tinggal' : 'naik' }))
                            }
                            className="w-4 h-4 accent-indigo-600"
                          />
                          <span className="text-[11px] text-slate-600">Tdk Naik</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              {yearEndResult && (
                <div className="p-3 rounded-xl border text-xs bg-slate-50 border-slate-200">
                  {yearEndResult.success ? (
                    <div className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Penutupan tahun selesai: {yearEndResult.moved} naik, {yearEndResult.repeated} tinggal, {yearEndResult.skipped} dilewati, total ditarik {formatRupiah(yearEndResult.totalWithdrawn)}
                    </div>
                  ) : (
                    <div className="font-bold text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Selesai dengan sebagian error
                    </div>
                  )}
                  {yearEndResult.errors.length > 0 && (
                    <div className="mt-2 text-rose-600 space-y-0.5">
                      {yearEndResult.errors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsYearEndModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={handleProcessYearEnd}
                  disabled={yearEndCandidates.length === 0 || yearEndRunning}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {yearEndRunning ? 'Memproses...' : `Proses ${yearEndCandidates.length} Siswa`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
