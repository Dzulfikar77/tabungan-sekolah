import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function LoginSiswa() {
  const [nisn, setNisn] = useState('');
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
      setPesanError('Jawaban matematika salah! Silakan coba lagi.');
      buatSoalCaptcha();
      return;
    }
    setPesanError('');
    alert(`Login Siswa berhasil! NISN: ${nisn}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-blue-600 mb-6">Login Siswa</h2>

        {pesanError && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm text-center">
            {pesanError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="nisn" className="block text-sm font-medium text-gray-700">NISN</label>
            <input
              id="nisn"
              type="text"
              required
              value={nisn}
              onChange={(e) => setNisn(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password-siswa" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password-siswa"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="bg-gray-100 p-4 rounded-lg">
            <label htmlFor="captcha-siswa" className="block text-sm font-medium text-gray-700 mb-2">
              Selesaikan perhitungan ini: <span className="font-bold text-lg text-blue-600">{angka1} + {angka2} = ?</span>
            </label>
            <input
              id="captcha-siswa"
              type="number"
              required
              placeholder="Masukkan hasil"
              value={jawabanCaptcha}
              onChange={(e) => setJawabanCaptcha(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition">
            Masuk
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-blue-600">
            &larr; Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
