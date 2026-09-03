import { Link } from 'react-router-dom';

export default function Welcome() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm w-full border-t-4 border-green-600">
        <h1 className="text-2xl font-bold text-green-700 mb-2">
          Tabungan Siswa
        </h1>
        <h2 className="text-xl font-bold text-gray-800 mb-6">
          Mambaul Ulum
        </h2>
        <p className="text-gray-600 mb-8 text-sm">
          Silakan masuk untuk mengecek saldo tabungan putra/putri Anda.
        </p>

        <Link
          to="/login-siswa"
          className="block w-full py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-lg shadow-md"
        >
          Cek Tabungan Sekarang
        </Link>
      </div>
    </div>
  );
}
