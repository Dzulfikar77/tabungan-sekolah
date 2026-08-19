/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { inspectBackupPayload } from '../utils/backup';
import type { BackupPreview } from '../utils/backup';
import { UserRole, ClassGrade } from '../types';
import { levelVisibleClasses } from '../utils/format';

const ALL_CLASS_GRADES: ClassGrade[] = levelVisibleClasses(null);
import {
  Building2,
  Image as ImageIcon,
  Download,
  Upload,
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Calendar,
  History,
  Eye,
  EyeOff,
} from 'lucide-react';

const ROLE_RANK: Record<UserRole, number> = {
  Developer: 4,
  'Super Admin': 3,
  Admin: 2,
  'Wali Kelas': 1,
  'Admin Koperasi': 1,
  Viewer: 0,
};

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    schoolSettings,
    updateSchoolSettings,
    exportBackupData,
    restoreBackupData,
    lastSnapshotTime,
    restoreLastSnapshot,
    currentUser,
    academicYears,
    addAcademicYear,
    deleteAcademicYear,
    users,
    addUser,
    updateUserRole,
    updateUserAccessLevel,
    updateUserAssignedClass,
    changeUserPassword,
    resetStaffPassword,
    deleteUser,
  } = useApp();

  const [name, setName] = useState(schoolSettings.name);
  const [address, setAddress] = useState(schoolSettings.address);
  const [phone, setPhone] = useState(schoolSettings.phone);
  const [logoUrl, setLogoUrl] = useState(schoolSettings.logoUrl || '');

  const [monthlyAmount, setMonthlyAmount] = useState(schoolSettings.monthlyDeductionAmount ?? 2000);
  const [sppTKAmount, setSppTKAmount] = useState(schoolSettings.sppTKAmount ?? 50000);
  const [sppSDAmount, setSppSDAmount] = useState(schoolSettings.sppSDAmount ?? 0);
  const [settingsError, setSettingsError] = useState('');

  const [restoreJson, setRestoreJson] = useState('');
  const [restoreMessage, setRestoreMessage] = useState<{ success?: boolean; msg?: string } | null>(null);
  const [backupError, setBackupError] = useState('');
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const [newYear, setNewYear] = useState('');
  const [yearMsg, setYearMsg] = useState<{ success?: boolean; msg?: string } | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('Admin');
  const [newUserAccessLevel, setNewUserAccessLevel] = useState<string>('');
  const [newUserAssignedClass, setNewUserAssignedClass] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userMsg, setUserMsg] = useState<{ success?: boolean; msg?: string } | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const values = { monthlyAmount, sppTKAmount, sppSDAmount };
    for (const [label, value] of Object.entries(values)) {
      if (!Number.isInteger(Number(value)) || Number(value) < 0) {
        setSettingsError(`Nominal "${label}" harus berupa angka bulat, tidak boleh negatif.`);
        return;
      }
    }
    setSettingsError('');
    updateSchoolSettings({
      name,
      address,
      phone,
      logoUrl,
      monthlyDeductionAmount: Number(monthlyAmount),
      sppTKAmount: Number(sppTKAmount),
      sppSDAmount: Number(sppSDAmount),
    });
    onClose();
  };

  const MAX_LOGO_BYTES = 200 * 1024;
  const MAX_LOGO_DIMENSION = 256;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSettingsError('Logo harus berupa file gambar.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize to a sane logo size before encoding — a raw phone photo
        // otherwise lands unmodified in school_settings.logo_url (and gets
        // duplicated into audit_logs' before/after snapshot on every save).
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale) || 1;
        canvas.height = Math.round(img.height * scale) || 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setSettingsError('Gagal memproses gambar.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl.length > MAX_LOGO_BYTES * 1.4) {
          setSettingsError('Logo terlalu besar bahkan setelah dikompres. Coba gambar lain.');
          return;
        }
        setSettingsError('');
        setLogoUrl(dataUrl);
      };
      img.onerror = () => setSettingsError('Gagal membaca file gambar.');
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadBackup = () => {
    const res = exportBackupData();
    if (!res.success || !res.data) {
      setBackupError(res.error || 'Gagal mengekspor cadangan.');
      return;
    }
    setBackupError('');
    const blob = new Blob([res.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Tabungan_Sekolah_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleInspectRestore = () => {
    if (!restoreJson.trim()) return;
    setRestoreMessage(null);
    let data: unknown;
    try {
      data = JSON.parse(restoreJson.trim());
    } catch {
      setRestorePreview({ valid: false, counts: { students: 0, transactions: 0, bookPayments: 0, sppPayments: 0, bookDistributions: 0, academicYears: 0 }, error: 'File JSON tidak valid — gagal di-parsing.' });
      setRestoreMessage({ success: false, msg: 'File JSON tidak valid — gagal di-parsing.' });
      return;
    }
    const preview = inspectBackupPayload(data);
    setRestorePreview(preview);
    if (!preview.valid) {
      setRestoreMessage({ success: false, msg: preview.error || 'Data cadangan tidak valid.' });
    }
  };

  const handleProcessRestore = async () => {
    if (!restorePreview?.valid || !restoreJson.trim()) return;
    setRestoreLoading(true);
    setRestoreMessage(null);
    const res = await restoreBackupData(restoreJson.trim());
    setRestoreLoading(false);
    if (res.success) {
      setRestoreMessage({ success: true, msg: 'Database berhasil dipulihkan dari cadangan JSON!' });
      setRestorePreview(null);
    } else {
      setRestoreMessage({ success: false, msg: res.error || 'Gagal memulihkan database.' });
    }
  };

  const handleRestoreLastSnapshot = async () => {
    const res = await restoreLastSnapshot();
    setRestoreMessage({
      success: res.success,
      msg: res.success ? 'Database berhasil dipulihkan dari snapshot terakhir!' : res.error || 'Gagal memulihkan dari snapshot.',
    });
  };

  const handleAddYear = async () => {
    if (currentUser.demoMode) {
      setYearMsg({ success: false, msg: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' });
      return;
    }
    const trimmed = newYear.trim();
    if (!/^\d{4}\/\d{4}$/.test(trimmed)) {
      setYearMsg({ success: false, msg: 'Format tahun ajaran salah. Contoh: 2026/2027' });
      return;
    }
    const [start, end] = trimmed.split('/').map(Number);
    if (end !== start + 1) {
      setYearMsg({ success: false, msg: 'Tahun kedua harus satu tahun setelah tahun pertama. Contoh: 2026/2027' });
      return;
    }
    if (academicYears.some((y) => y.year === trimmed)) {
      setYearMsg({ success: false, msg: `Tahun ajaran ${trimmed} sudah ada.` });
      return;
    }
    const res = await addAcademicYear(trimmed);
    if (!res.success) {
      setYearMsg({ success: false, msg: res.error || 'Gagal membuat tahun ajaran baru.' });
      return;
    }
    setNewYear('');
    setYearMsg({ success: true, msg: `Tahun ajaran ${trimmed} dibuat dan langsung diaktifkan.` });
  };

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newUserName.trim() || !newUserPassword.trim()) {
      setUserMsg({ success: false, msg: 'Username, nama, dan password wajib diisi.' });
      return;
    }
    if (newUserPassword.length < 8) {
      setUserMsg({ success: false, msg: 'Password minimal 8 karakter.' });
      return;
    }
    const res = await addUser({
      username: newUsername.trim(),
      name: newUserName.trim(),
      role: newUserRole as UserRole,
      accessLevel: (newUserAccessLevel || undefined) as 'TK' | 'MI' | undefined,
      assignedClass: (newUserRole === 'Wali Kelas' ? newUserAssignedClass || undefined : undefined) as ClassGrade | undefined,
      password: newUserPassword,
    });
    if (res.success) {
      setUserMsg({ success: true, msg: `User ${newUsername.trim()} (${newUserRole}) berhasil ditambahkan.` });
      setNewUsername('');
      setNewUserName('');
      setNewUserRole('Admin');
      setNewUserAccessLevel('');
      setNewUserAssignedClass('');
      setNewUserPassword('');
    } else {
      setUserMsg({ success: false, msg: res.error || 'Gagal menambah user.' });
    }
  };

  const [passwordDialog, setPasswordDialog] = useState<{ id: string; name: string; action: 'change' | 'reset' } | null>(null);
  const [passwordDialogValue, setPasswordDialogValue] = useState('');
  const [passwordDialogConfirm, setPasswordDialogConfirm] = useState('');
  const [passwordDialogShow, setPasswordDialogShow] = useState(false);
  const [passwordDialogError, setPasswordDialogError] = useState('');

  const closePasswordDialog = () => {
    setPasswordDialog(null);
    setPasswordDialogValue('');
    setPasswordDialogConfirm('');
    setPasswordDialogShow(false);
    setPasswordDialogError('');
  };

  const submitPasswordDialog = async () => {
    if (!passwordDialog) return;
    if (passwordDialogValue.length < 8) {
      setPasswordDialogError('Password baru minimal 8 karakter.');
      return;
    }
    if (passwordDialogValue !== passwordDialogConfirm) {
      setPasswordDialogError('Konfirmasi password tidak cocok.');
      return;
    }
    const { id, name, action } = passwordDialog;
    const res = action === 'change'
      ? await changeUserPassword(id, passwordDialogValue)
      : await resetStaffPassword(id, passwordDialogValue);
    if (res.success) {
      setUserMsg({ success: true, msg: action === 'change' ? `Password ${name} berhasil diganti.` : `Password ${name} berhasil direset.` });
      closePasswordDialog();
    } else {
      setPasswordDialogError(res.error || 'Gagal mengubah password.');
    }
  };

  const handleDeleteUser = async (id: string, name: string, username: string) => {
    if (!confirm(`Hapus user "${name}" (${username})? Tindakan ini tidak dapat dibatalkan.`)) return;
    const res = await deleteUser(id);
    if (res.success) {
      setUserMsg({ success: true, msg: `User ${name} dihapus.` });
    } else {
      setUserMsg({ success: false, msg: res.error || 'Gagal menghapus user.' });
    }
  };

  const canResetStaffPassword = (targetRole: UserRole, studentId?: string) => {
    // Guard: can only reset users strictly lower in rank
    if (ROLE_RANK[currentUser.role] <= ROLE_RANK[targetRole]) return false;
    // Guard: for Viewer, skip if linked to a student (managed via student lifecycle)
    if (targetRole === 'Viewer' && studentId) return false;
    return true;
  };


  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto border border-slate-100 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-base">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Pengaturan Sekolah & Backup Database
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Pengaturan Profil Sekolah */}
        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400">
            Identitas Sekolah (Header Laporan PDF)
          </h4>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Sekolah / Lembaga *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap *</label>
            <textarea
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">No. Telepon / HP Sekolah</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Upload Logo Sekolah</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-12 h-12 object-contain border border-slate-200 rounded-lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="p-1 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Manajemen Tahun Ajaran — khusus Developer */}
          {currentUser.role === 'Developer' && (
            <>
              <hr className="border-slate-100 my-4" />
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" /> Manajemen Tahun Ajaran (Developer)
              </h4>

              <div className="space-y-2">
                {academicYears.map((ay) => (
                  <div key={ay.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{ay.year}</span>
                      {ay.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">AKTIF</span>
                      )}
                    </div>
                    {!ay.isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Hapus tahun ajaran ${ay.year}?\n\nData siswa & transaksi TETAP tersimpan (tidak ikut dihapus).\nTahun ${ay.year} hanya dilepas dari daftar.\nLanjutkan?`)) {
                            const res = deleteAcademicYear(ay.id);
                            if (res.success) {
                              setYearMsg({ success: true, msg: `Tahun ajaran ${ay.year} dihapus.` });
                            } else {
                              setYearMsg({ success: false, msg: res.error || 'Gagal menghapus tahun ajaran.' });
                            }
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-[11px] cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="Contoh: 2026/2027"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddYear}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer shrink-0"
                >
                  Tambah & Aktifkan
                </button>
              </div>

              {yearMsg && (
                <div className={`p-2 rounded-lg text-xs font-semibold ${yearMsg.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {yearMsg.msg}
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Tahun ajaran aktif dipakai otomatis di seluruh section (Dashboard, SPP, Setoran, Penarikan, Koperasi, Laporan). Data tahun sebelumnya tetap tersimpan dan aman.
              </p>
            </>
          )}

          <hr className="border-slate-100 my-4" />

          {/* Aturan Potongan Bulanan */}
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400">
            Aturan Potongan Bulanan Otomatis
          </h4>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nominal Potongan (Rp) per Bulan</label>
              <input
                type="number"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default: Rp 2.000. Pemotongan dilakukan setiap tanggal 28. Saldo kurang akan dicatat sebagai tunggakan.</p>
            </div>
          </div>

          {settingsError && (
            <div className="p-2 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800">{settingsError}</div>
          )}

          {/* SPP Settings */}
          <hr className="border-slate-100 my-4" />
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400">
            Tarif SPP (Pembayaran Sekolah)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SPP TK (A & B)</label>
              <input
                type="number"
                value={sppTKAmount}
                onChange={(e) => setSppTKAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default: Rp 50.000</p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SPP MI (Kelas 1 - 6)</label>
              <input
                type="number"
                value={sppSDAmount}
                onChange={(e) => setSppSDAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">0 = Gratis (tidak wajib bayar)</p>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-xs"
          >
            Simpan Pengaturan
          </button>
        </form>

        {/* Manajemen User — khusus Developer */}
        {(currentUser.role === 'Developer' || currentUser.role === 'Super Admin') && (
          <div className="space-y-3 text-xs">
            <hr className="border-slate-100 my-4" />
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-purple-600" /> Manajemen User
            </h4>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {users.map((u) => (
                <div key={u.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">
                        {u.name}
                        {u.demoMode && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">DEMO</span>}
                        {u.id === currentUser.id && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(Anda)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">@{u.username}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 shrink-0">{u.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={u.role}
                      disabled={u.demoMode || u.id === currentUser.id || currentUser.role !== 'Developer'}
                      title={currentUser.role !== 'Developer' ? 'Hanya Developer yang dapat mengubah role' : undefined}
                      onChange={(e) => updateUserRole(u.id, e.target.value as UserRole)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-semibold bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {(['Developer', 'Super Admin', 'Admin', 'Wali Kelas', 'Admin Koperasi', 'Viewer'] as UserRole[]).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <select
                      value={u.accessLevel || ''}
                      disabled={u.demoMode || u.id === currentUser.id || currentUser.role !== 'Developer'}
                      title={currentUser.role !== 'Developer' ? 'Hanya Developer yang dapat mengubah jenjang akses' : 'Jenjang akses data (TK/MI)'}
                      onChange={(e) => updateUserAccessLevel(u.id, (e.target.value || undefined) as 'TK' | 'MI' | undefined)}
                      className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-semibold bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">Semua Jenjang</option>
                      <option value="TK">TK</option>
                      <option value="MI">MI</option>
                    </select>
                    {u.role === 'Wali Kelas' && (
                      <select
                        value={u.assignedClass || ''}
                        disabled={u.demoMode || u.id === currentUser.id || currentUser.role !== 'Developer'}
                        title={currentUser.role !== 'Developer' ? 'Hanya Developer yang dapat mengubah kelas' : 'Kelas spesifik yang dipegang guru ini'}
                        onChange={(e) => updateUserAssignedClass(u.id, (e.target.value || undefined) as ClassGrade | undefined)}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] font-semibold bg-white focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">Belum diatur (semua kelas)</option>
                        {ALL_CLASS_GRADES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => setPasswordDialog({ id: u.id, name: u.name, action: 'change' })}
                      disabled={u.demoMode || currentUser.role !== 'Developer'}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg font-semibold text-[11px] cursor-pointer disabled:cursor-not-allowed"
                    >
                      Ganti Password
                    </button>
                    {/* Reset Password — hierarchy-guarded (rank strictly higher); existing changeUserPassword above stays Developer-only */}
                    {canResetStaffPassword(u.role, u.studentId) && (
                      <button
                        type="button"
                        onClick={() => setPasswordDialog({ id: u.id, name: u.name, action: 'reset' })}
                        disabled={u.demoMode}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-[11px] cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" /> Reset Password
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.id, u.name, u.username)}
                      disabled={u.id === currentUser.id || (currentUser.role !== 'Developer' && u.role === 'Developer' && !u.demoMode)}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-lg font-semibold text-[11px] cursor-pointer disabled:cursor-not-allowed"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Tambah User Baru — Developer only. Menambah akun staff bukan
                privilege Super Admin, beda dari reset-password/delete di atas
                yang tetap Developer+Super Admin (lihat admin-users/index.ts action="create"). */}
            {currentUser.role === 'Developer' && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                <div className="font-bold text-purple-900 text-[11px]">Tambah User Baru</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Username"
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    {(['Developer', 'Super Admin', 'Admin', 'Wali Kelas', 'Admin Koperasi', 'Viewer'] as UserRole[])
                      .filter((r) => ROLE_RANK[r] < ROLE_RANK[currentUser.role])
                      .map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                  </select>
                  <select
                    value={newUserAccessLevel}
                    onChange={(e) => setNewUserAccessLevel(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none"
                  >
                    <option value="">Semua Jenjang</option>
                    <option value="TK">Khusus TK</option>
                    <option value="MI">Khusus MI</option>
                  </select>
                  {newUserRole === 'Wali Kelas' && (
                    <select
                      value={newUserAssignedClass}
                      onChange={(e) => setNewUserAssignedClass(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none col-span-2"
                    >
                      <option value="">Kelas yang dipegang (opsional)</option>
                      {ALL_CLASS_GRADES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Password (min. 8 karakter)"
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddUser}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Tambah User
                </button>
              </div>
            )}

            {userMsg && (
              <div className={`p-2 rounded-lg text-xs font-semibold ${userMsg.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {userMsg.msg}
              </div>
            )}
          </div>
        )}

        <hr className="border-slate-100" />

        {/* Backup & Restore Section */}
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-purple-600" /> Backup & Restore Database
          </h4>

          {/* Backup Button */}
          {ROLE_RANK[currentUser.role] >= 3 ? (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-purple-900">Ekspor Cadangan JSON</div>
                <div className="text-[11px] text-purple-700">Unduh seluruh file keadaan sistem</div>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Backup
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-500 text-[11px]">
              * Ekspor cadangan hanya dapat dilakukan oleh role Super Admin/Developer.
            </div>
          )}
          {backupError && (
            <div className="p-2 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800">{backupError}</div>
          )}

          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-indigo-900 flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-indigo-600" /> Snapshot Otomatis
              </div>
              <div className="text-[11px] text-indigo-700">
                {lastSnapshotTime
                  ? `Snapshot terakhir: ${new Date(lastSnapshotTime).toLocaleString('id-ID')}`
                  : 'Belum ada snapshot otomatis.'}
              </div>
            </div>
            {currentUser.role === 'Developer' && (
              <button
                onClick={handleRestoreLastSnapshot}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg cursor-pointer shrink-0"
              >
                Restore Snapshot
              </button>
            )}
          </div>

          {/* Restore Section - Developer Role Only */}
          {currentUser.role === 'Developer' ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-purple-600" /> Restore Database (Khusus Developer)
              </div>
              <textarea
                placeholder="Tempelkan isi file JSON backup disini..."
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none text-[11px] font-mono"
                rows={3}
              />
              <button
                onClick={handleInspectRestore}
                disabled={!restoreJson.trim()}
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 font-semibold rounded-lg cursor-pointer"
              >
                Periksa &amp; Preview Cadangan
              </button>

              {restorePreview?.valid && (
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-800 space-y-0.5">
                  <div className="font-bold">Akan dipulihkan:</div>
                  <div>Siswa: {restorePreview.counts.students} · Transaksi: {restorePreview.counts.transactions}</div>
                  <div>Pembayaran Buku: {restorePreview.counts.bookPayments} · SPP: {restorePreview.counts.sppPayments} · Distribusi: {restorePreview.counts.bookDistributions}</div>
                  <div className="text-[10px] text-emerald-600">Snapshot kondisi saat ini dibuat otomatis sebagai cadangan rollback.</div>
                </div>
              )}

              <button
                onClick={handleProcessRestore}
                disabled={!restorePreview?.valid || restoreLoading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold rounded-lg cursor-pointer"
              >
                {restoreLoading ? 'Memulihkan…' : 'Proses Restore System State'}
              </button>

              {restoreMessage && (
                <div
                  className={`p-2 rounded-lg text-xs font-semibold ${
                    restoreMessage.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {restoreMessage.msg}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-500 text-[11px]">
              * Pemulihan/Restore database hanya dapat dilakukan oleh role Developer.
            </div>
          )}
        </div>
      </div>

      {passwordDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                {passwordDialog.action === 'change' ? 'Ganti' : 'Reset'} Password — {passwordDialog.name}
              </div>
              <button onClick={closePasswordDialog} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password Baru</label>
              <div className="relative">
                <input
                  type={passwordDialogShow ? 'text' : 'password'}
                  autoFocus
                  value={passwordDialogValue}
                  onChange={(e) => setPasswordDialogValue(e.target.value)}
                  className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none"
                  placeholder="Minimal 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setPasswordDialogShow(!passwordDialogShow)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {passwordDialogShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Konfirmasi Password</label>
              <input
                type={passwordDialogShow ? 'text' : 'password'}
                value={passwordDialogConfirm}
                onChange={(e) => setPasswordDialogConfirm(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                placeholder="Ulangi password baru"
              />
            </div>
            {passwordDialogError && (
              <div className="p-2 rounded-lg text-xs font-semibold bg-rose-100 text-rose-800">{passwordDialogError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={submitPasswordDialog}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg cursor-pointer"
              >
                Simpan
              </button>
              <button
                onClick={closePasswordDialog}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
