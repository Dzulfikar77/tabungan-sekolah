/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { resolveViewerLogin, searchViewerSuggestions, ViewerSuggestion, verifyParentIdentity } from '../utils/viewerCredentials';
import { ShieldCheck, Lock, LogIn, Eye, EyeOff, X, Search, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';

interface ViewerLoginPageProps {
  onBackToAdmin: () => void;
}

export const ViewerLoginPage: React.FC<ViewerLoginPageProps> = ({ onBackToAdmin }) => {
  const { setCurrentUser, schoolSettings, users, students, resetViewerPassword } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<ViewerSuggestion | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [isListOpen, setIsListOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  const [forgotMode, setForgotMode] = useState(false);
  const [parentNameInput, setParentNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotAttempts, setForgotAttempts] = useState(0);
  const [forgotStep, setForgotStep] = useState<'verify' | 'setPassword' | 'success' | 'locked'>('verify');

  const query = selectedStudent ? '' : username;
  const suggestions = useMemo(
    () => searchViewerSuggestions(users, students, query),
    [users, students, query]
  );
  const showList = !selectedStudent && isListOpen && suggestions.length > 0;

  const handleUsernameChange = (v: string) => {
    setUsername(v);
    setSelectedStudent(null);
    setHighlightIndex(0);
    setIsListOpen(true);
    setError('');
  };

  const handlePick = (s: ViewerSuggestion) => {
    setSelectedStudent(s);
    setUsername(s.name);
    setHighlightIndex(0);
    setIsListOpen(false);
    setError('');
    passwordRef.current?.focus();
  };

  const handleClearPick = () => {
    setSelectedStudent(null);
    setUsername('');
    setHighlightIndex(0);
    setIsListOpen(false);
    passwordRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && suggestions[highlightIndex]) {
      e.preventDefault();
      handlePick(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsListOpen(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedStudent) {
      const user = users.find((u) => u.role === 'Viewer' && u.studentId === selectedStudent.studentId);
      if (!user) {
        setError('Akun viewer tidak ditemukan. Hubungi sekolah.');
        return;
      }
      if (user.password !== password) {
        setError('Password salah.');
        return;
      }
      setCurrentUser(user);
      return;
    }

    const result = resolveViewerLogin(users, students, username, password);
    if ('user' in result) {
      setCurrentUser(result.user);
      return;
    }
    setError(result.error);
  };

  const resetForgotState = () => {
    setForgotMode(false);
    setParentNameInput('');
    setPhoneInput('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotAttempts(0);
    setForgotStep('verify');
    setError('');
    setSelectedStudent(null);
    setUsername('');
    setHighlightIndex(0);
    setIsListOpen(false);
  };

  const enterForgotMode = () => {
    setPassword('');
    resetForgotState();
    setForgotMode(true);
  };

  const handleVerify = () => {
    if (!selectedStudent) return;
    const student = students.find((s) => s.id === selectedStudent.studentId);
    if (verifyParentIdentity(student, parentNameInput, phoneInput)) {
      setForgotStep('setPassword');
      setError('');
      return;
    }
    const next = forgotAttempts + 1;
    setForgotAttempts(next);
    if (next >= 5) {
      setForgotStep('locked');
      return;
    }
    setError('Nama orang tua atau no. HP salah.');
  };

  const handleSavePassword = () => {
    if (!selectedStudent) return;
    if (newPassword.length < 4) {
      setError('Password baru minimal 4 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    const result = resetViewerPassword(selectedStudent.studentId, newPassword);
    if (result.success) {
      setForgotStep('success');
      setError('');
      return;
    }
    setError(result.error || 'Gagal mengganti password.');
  };

  const studentCombobox = (
    <div className="relative">
      {selectedStudent ? (
        <X className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
      ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      )}
      <input
        type="text"
        placeholder="Ketik nama anak..."
        value={username}
        readOnly={!!selectedStudent}
        onChange={(e) => handleUsernameChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => !selectedStudent && setIsListOpen(true)}
        onBlur={() => setTimeout(() => setIsListOpen(false), 150)}
        role="combobox"
        aria-expanded={showList}
        aria-controls="viewer-suggestions"
        className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-50"
        autoFocus
      />
      {selectedStudent && (
        <button
          type="button"
          onClick={handleClearPick}
          aria-label="Ulangi pencarian nama"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {showList && (
        <ul
          id="viewer-suggestions"
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto"
        >
          {suggestions.map((s, i) => (
            <li key={s.studentId} role="option" aria-selected={i === highlightIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(s)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${i === highlightIndex ? 'bg-emerald-50' : ''}`}
              >
                <span className="block text-sm font-semibold text-slate-800">
                  {s.name} — Kelas {s.classGrade}
                </span>
                <span className="block text-[11px] text-slate-500">
                  Orang Tua: {s.parentName || '-'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-900 text-white p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 overflow-hidden">
            {schoolSettings.logoUrl ? (
              <img src={schoolSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            )}
          </div>
          <h1 className="text-xl font-bold mb-1">Portal Orang Tua & Siswa</h1>
          <p className="text-sm text-slate-400">{schoolSettings.name}</p>
          <p className="text-xs text-slate-500 mt-2">Lihat saldo tabungan, riwayat transaksi, dan status pembayaran</p>
        </div>

        {/* Form */}
        <div className="p-8 space-y-5">
          {!forgotMode ? (
            <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Anak</label>
              {studentCombobox}
              <p className="text-[11px] text-slate-400 mt-1">
                Ketik nama anak — saran muncul otomatis. Pilih anak Anda, lalu isi password.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={passwordRef}
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

            <div className="text-center">
              <button
                type="button"
                onClick={enterForgotMode}
                className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer underline"
              >
                Lupa Password?
              </button>
            </div>
          </form>
          ) : (
            <div className="space-y-4">
              {forgotStep === 'locked' ? (
                <div className="space-y-4">
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2.5 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Terlalu banyak percobaan. Hubungi pihak sekolah.
                  </div>
                  <button
                    type="button"
                    onClick={resetForgotState}
                    className="w-full py-2.5 border border-slate-200 text-slate-600 hover:text-slate-800 font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Kembali ke Login
                  </button>
                </div>
              ) : forgotStep === 'success' ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-2.5 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Password berhasil diganti! Silakan login dengan password baru.
                  </div>
                  <button
                    type="button"
                    onClick={resetForgotState}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Kembali ke Login
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Anak</label>
                    {studentCombobox}
                    <p className="text-[11px] text-slate-400 mt-1">
                      Pilih anak Anda untuk mereset password.
                    </p>
                  </div>

                  {selectedStudent && forgotStep === 'verify' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Orang Tua</label>
                        <input
                          type="text"
                          placeholder="Nama lengkap orang tua"
                          value={parentNameInput}
                          onChange={(e) => setParentNameInput(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">No. Telepon / WhatsApp</label>
                        <input
                          type="tel"
                          placeholder="Nomor telepon orang tua"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                          {error}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleVerify}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Verifikasi
                      </button>
                    </>
                  )}

                  {selectedStudent && forgotStep === 'setPassword' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password Baru</label>
                        <input
                          type="password"
                          placeholder="Minimal 4 karakter"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Konfirmasi Password</label>
                        <input
                          type="password"
                          placeholder="Ulangi password baru"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                          {error}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleSavePassword}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
                      >
                        <Lock className="w-4 h-4" />
                        Simpan
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={resetForgotState}
                    className="w-full py-2.5 border border-slate-200 text-slate-600 hover:text-slate-800 font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Batal / Kembali ke Login
                  </button>
                </>
              )}
            </div>
          )}

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
