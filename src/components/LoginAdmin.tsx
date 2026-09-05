import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { simpanSesi } from '../utils/auth';

export default function LoginAdmin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [angka1, setAngka1] = useState(0);
  const [angka2, setAngka2] = useState(0);
  const [jawabanCaptcha, setJawabanCaptcha] = useState('');
  const [pesanError, setPesanError] = useState('');

  const buatSoalCaptcha = useCallback(() => {
    setAngka1(Math.floor(Math.random() * 10) + 1);
    setAngka2(Math.floor(Math.random() * 10) + 1);
    setJawabanCaptcha('');
  }, []);

  useEffect(() => {
    buatSoalCaptcha();
  }, [buatSoalCaptcha]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const jawabanBenar = angka1 + angka2;
    if (parseInt(jawabanCaptcha) !== jawabanBenar) {
      setPesanError('Captcha salah! Buktikan Anda bukan robot.');
      buatSoalCaptcha();
      return;
    }
    setPesanError('');
    simpanSesi('admin', username);
    alert('Login Admin berhasil! Mengarahkan ke Dashboard...');
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Portal Admin</h2>

        {pesanError && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm text-center">
            {pesanError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="block text-sm font-medium text-gray-700">Username Admin</label>
            <input
              id="admin-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-gray-800 focus:border-gray-800"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-gray-800 focus:border-gray-800"
            />
          </div>

          <div className="bg-gray-100 p-4 rounded-lg border border-gray-200">
            <label htmlFor="captcha-admin" className="block text-sm font-medium text-gray-700 mb-2">
              Validasi Keamanan: <span className="font-bold text-lg">{angka1} + {angka2} = ?</span>
            </label>
            <input
              id="captcha-admin"
              type="number"
              required
              placeholder="Jawaban"
              value={jawabanCaptcha}
              onChange={(e) => setJawabanCaptcha(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-gray-800 focus:border-gray-800"
            />
          </div>

          <button type="submit" className="w-full bg-gray-800 text-white font-bold py-2 px-4 rounded hover:bg-black transition">
            Masuk Sistem
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-800">
            &larr; Halaman Depan
          </Link>
        </div>
      </div>
    </div>
  );
}
