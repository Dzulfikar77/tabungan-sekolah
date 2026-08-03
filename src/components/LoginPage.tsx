/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Building2, User, Lock, LogIn, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';

interface LoginPageProps {
  onViewerLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onViewerLogin }) => {
  const { login, schoolSettings, users, verifyRecoveryKey, selfResetAdminPassword } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = login(username, password);
    if (!result.success) {
      setError(result.error || 'Login gagal.');
    }
  };

  const resetForgotState = () => {
    setForgotUsername('');
    setRecoveryKey('');
    setNewPassword('');
    setConfirmPassword('');
    setShowRecoveryKey(false);
    setShowNewPassword(false);
    setForgotError('');
    setForgotSuccess('');
  };

  const handleForgotReset = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotUsername.trim()) {
      setForgotError('Username tidak boleh kosong.');
      return;
    }
    if (!recoveryKey.trim()) {
      setForgotError('Recovery Key tidak boleh kosong.');
      return;
    }
    if (newPassword.length < 4) {
      setForgotError('Password baru minimal 4 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Konfirmasi password tidak cocok.');
      return;
    }

    const result = selfResetAdminPassword(forgotUsername, recoveryKey, newPassword);
    if (!result.success) {
      setForgotError(result.error || 'Gagal mereset password.');
      return;
    }
    setForgotSuccess('Password berhasil direset! Silakan login.');
    setForgotError('');
    setRecoveryKey('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleBackToLogin = () => {
    setForgotMode(false);
    resetForgotState();
  };

  const recoveryEnabled = verifyRecoveryKey('');

  const matchedUser = users.find(
    (u) => u.role !== 'Viewer' && u.username.toLowerCase() === forgotUsername.trim().toLowerCase()
  );
  const escalationHint = (() => {
    if (!forgotUsername.trim() || !matchedUser) return null;
    switch (matchedUser.role) {
      case 'Admin':
        return 'Hubungi Super Admin / Kepala Sekolah.';
      case 'Super Admin':
        return 'Hubungi Developer.';
      case 'Developer':
        return 'Reset via Developer / AI (script reset-password).';
      case 'Wali Kelas':
        return 'Hubungi Admin / Super Admin.';
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-900 text-white p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 overflow-hidden">
            {schoolSettings.logoUrl ? (
              <img src={schoolSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <h1 className="text-xl font-bold mb-1">Sistem Informasi Sekolah</h1>
          <p className="text-sm text-slate-400">{schoolSettings.name}</p>
        </div>

        {/* Form */}
        <div className="p-8 space-y-5">
          {forgotMode ? (
            <div className="space-y-4">
              {forgotSuccess ? (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-lg">
                    {forgotSuccess}
                  </div>
                  <button
                    onClick={handleBackToLogin}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    Kembali ke Login
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgotReset} className="space-y-4">
                  <div className="text-center mb-2">
                    <h2 className="text-lg font-bold text-slate-800">Reset Password</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Masukkan username dan recovery key Anda.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Username admin staff"
                        value={forgotUsername}
                        onChange={(e) => {
                          setForgotUsername(e.target.value);
                          setForgotError('');
                        }}
                        className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>

                  {escalationHint && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-2.5 rounded-lg">
                      {escalationHint}
                    </div>
                  )}

                  {!recoveryEnabled ? (
                    <>
                      <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium px-4 py-3 rounded-lg">
                        Fitur reset password belum diaktifkan. Silakan hubungi atasan Anda.
                      </div>
                      <button
                        type="button"
                        onClick={handleBackToLogin}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Recovery Key</label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showRecoveryKey ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={recoveryKey}
                            onChange={(e) => {
                              setRecoveryKey(e.target.value);
                              setForgotError('');
                            }}
                            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRecoveryKey(!showRecoveryKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRecoveryKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password Baru</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="Min. 4 karakter"
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setForgotError('');
                            }}
                            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Konfirmasi Password Baru</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              setForgotError('');
                            }}
                            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {forgotError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                          {forgotError}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-4 h-4" />
                        Reset Password
                      </button>

                      <button
                        type="button"
                        onClick={handleBackToLogin}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          ) : (
          <>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi</label>
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
              type="button"
              onClick={() => setForgotMode(true)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              Lupa Password?
            </button>
          </div>

          {onViewerLogin && (
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                Atau
              </span>
            </div>
          )}

          {onViewerLogin && (
            <button
              onClick={onViewerLogin}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Login sebagai Orang Tua / Siswa
            </button>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
};
