/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    schoolSettings,
    updateSchoolSettings,
    exportBackupData,
    restoreBackupData,
    currentUser,
    academicYears,
    addAcademicYear,
    setCurrentAcademicYearId,
  } = useApp();

  const [name, setName] = useState(schoolSettings.name);
  const [address, setAddress] = useState(schoolSettings.address);
  const [phone, setPhone] = useState(schoolSettings.phone);
  const [logoUrl, setLogoUrl] = useState(schoolSettings.logoUrl || '');

  const [monthlyAmount, setMonthlyAmount] = useState(schoolSettings.monthlyDeductionAmount || 2000);
  const [sppTKAmount, setSppTKAmount] = useState(schoolSettings.sppTKAmount || 50000);
  const [sppSDAmount, setSppSDAmount] = useState(schoolSettings.sppSDAmount || 0);

  const [restoreJson, setRestoreJson] = useState('');
  const [restoreMessage, setRestoreMessage] = useState<{ success?: boolean; msg?: string } | null>(null);

  const [newYear, setNewYear] = useState('');
  const [yearMsg, setYearMsg] = useState<{ success?: boolean; msg?: string } | null>(null);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        if (uploadEvt.target?.result) {
          setLogoUrl(uploadEvt.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Tabungan_Sekolah_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const handleProcessRestore = () => {
    if (!restoreJson.trim()) return;
    const res = restoreBackupData(restoreJson.trim());
    if (res.success) {
      setRestoreMessage({ success: true, msg: 'Database berhasil dipulihkan dari cadangan JSON!' });
    } else {
      setRestoreMessage({ success: false, msg: res.error || 'Gagal memulihkan database.' });
    }
  };

  const handleAddYear = () => {
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
    addAcademicYear(trimmed);
    setNewYear('');
    setYearMsg({ success: true, msg: `Tahun ajaran ${trimmed} dibuat dan langsung diaktifkan.` });
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

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-xs"
          >
            Simpan Pengaturan
          </button>

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
        </form>

        <hr className="border-slate-100 my-4" />

        {/* Manajemen Tahun Ajaran */}
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" /> Manajemen Tahun Ajaran
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
                    onClick={() => {
                      if (currentUser.demoMode) {
                        setYearMsg({ success: false, msg: 'Mode Demo: tidak dapat mengubah tahun ajaran.' });
                        return;
                      }
                      setCurrentAcademicYearId(ay.id);
                      setYearMsg({ success: true, msg: `Tahun ajaran ${ay.year} aktif sekarang.` });
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-[11px] cursor-pointer"
                  >
                    Aktifkan
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
        </div>

        <hr className="border-slate-100" />

        {/* Backup & Restore Section */}
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-purple-600" /> Backup & Restore Database
          </h4>

          {/* Backup Button */}
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
                onClick={handleProcessRestore}
                disabled={!restoreJson.trim()}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold rounded-lg cursor-pointer"
              >
                Proses Restore System State
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
    </div>
  );
};
