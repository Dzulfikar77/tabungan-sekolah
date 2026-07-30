/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { initialUsers } from '../utils/initialData';
import { ShieldCheck, User, Lock, LogIn, Eye, EyeOff } from 'lucide-react';

interface ViewerLoginPageProps {
  onBackToAdmin: () => void;
}

export const ViewerLoginPage: React.FC<ViewerLoginPageProps> = ({ onBackToAdmin }) => {
  const { setCurrentUser, schoolSettings } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim().toLowerCase();
    const user = initialUsers.find(
      (u) =>
        u.role === 'Viewer' &&
        u.username.toLowerCase() === trimmedUsername &&
        u.password === password
    );

    if (!user) {
      setError('Username atau password salah.');
      return;
    }

    setCurrentUser(user);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-900 text-white p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-1">Portal Orang Tua & Siswa</h1>
          <p className="text-sm text-slate-400">{schoolSettings.name}</p>
          <p className="text-xs text-slate-500 mt-2">Lihat saldo tabungan, riwayat transaksi, dan status pembayaran</p>
        </div>

        {/* Form */}
        <div className="p-8 space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Masuk
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={onBackToAdmin}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer underline"
            >
              Kembali ke Login Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
