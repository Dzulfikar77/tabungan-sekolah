/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { initialUsers } from '../utils/initialData';
import { ShieldCheck, UserCheck, KeyRound, Eye, Lock, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentUser, schoolSettings } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>('Super Admin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleQuickLogin = (role: UserRole) => {
    const user = initialUsers.find((u) => u.role === role);
    if (user) {
      setCurrentUser(user);
      onClose();
    }
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const matched = initialUsers.find(
      (u) => u.username.toLowerCase() === usernameInput.trim().toLowerCase()
    );

    if (matched) {
      setCurrentUser(matched);
      onClose();
    } else {
      setErrorMsg('Username tidak ditemukan. Silakan pilih role cepat di bawah.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Masuk Aplikasi Tabungan</h2>
              <p className="text-xs text-slate-400">{schoolSettings.name}</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Form Login */}
          <form onSubmit={handleCustomLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                placeholder="Masukkan username (contoh: kepsek / bendahara)"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Masuk dengan Akun
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              Atau Akses Cepat Demo Role
            </span>
          </div>

          {/* Quick Role Selection Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('Developer')}
              className="p-3 border border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100 rounded-xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 font-bold text-xs text-purple-900 mb-0.5">
                <KeyRound className="w-4 h-4 text-purple-600" />
                <span>Developer</span>
              </div>
              <p className="text-[10px] text-purple-700">Full System & Maintenance</p>
            </button>

            <button
              onClick={() => handleQuickLogin('Super Admin')}
              className="p-3 border border-emerald-200 hover:border-emerald-400 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-900 mb-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Super Admin</span>
              </div>
              <p className="text-[10px] text-emerald-700">Kepala Sekolah / Approver</p>
            </button>

            <button
              onClick={() => handleQuickLogin('Admin')}
              className="p-3 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 rounded-xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 font-bold text-xs text-blue-900 mb-0.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Admin</span>
              </div>
              <p className="text-[10px] text-blue-700">Bendahara / Operator</p>
            </button>

            <button
              onClick={() => handleQuickLogin('Viewer')}
              className="p-3 border border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-0.5">
                <Eye className="w-4 h-4 text-slate-600" />
                <span>Viewer</span>
              </div>
              <p className="text-[10px] text-slate-600">Siswa / Orang Tua (Read-only)</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
