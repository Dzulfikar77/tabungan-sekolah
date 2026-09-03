import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cekSesiValid, getDataUser, hapusSesi } from '../utils/auth';

export default function DashboardSiswa() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<{ identifier: string } | null>(null);

  useEffect(() => {
    if (!cekSesiValid()) {
      alert('Sesi Anda telah habis (lebih dari 5 menit). Silakan login kembali.');
      navigate('/login-siswa');
      return;
    }

    const data = getDataUser();
    if (data?.role !== 'siswa') {
      hapusSesi();
      navigate('/login-siswa');
      return;
    }
    setUserData(data);

    const interval = setInterval(() => {
      if (!cekSesiValid()) {
        alert('Sesi Anda telah habis. Anda dikeluarkan otomatis demi keamanan.');
        navigate('/login-siswa');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    hapusSesi();
    navigate('/');
  };

  if (!userData) return <div>Memuat...</div>;

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-green-700">Dashboard Siswa</h1>
      <p className="mt-4">Selamat datang, NISN: <strong>{userData.identifier}</strong></p>
      <div className="mt-6 p-4 bg-blue-100 rounded inline-block">
        <p className="text-sm text-blue-800">Sesi login Anda berlaku selama 5 menit. Diamkan halaman ini selama 5 menit untuk mengetes auto-logout.</p>
      </div>
      <br />
      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      >
        Keluar (Logout)
      </button>
    </div>
  );
}
