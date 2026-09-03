interface WelcomeProps {
  onStudentLogin: () => void;
  onAdminLogin: () => void;
}

export default function Welcome({ onStudentLogin, onAdminLogin }: WelcomeProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-xl shadow-lg text-center max-w-lg">
        <h1 className="text-3xl font-bold text-green-700 mb-4">
          Selamat Datang di Mambaul Ulum
        </h1>
        <p className="text-gray-600 mb-8">
          Sistem Informasi Tabungan Sekolah
        </p>

        <button
          type="button"
          onClick={onStudentLogin}
          className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Masuk sebagai Siswa
        </button>

        <div className="mt-6">
          <button
            type="button"
            onClick={onAdminLogin}
            className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer"
          >
            Login Admin
          </button>
        </div>
      </div>
    </div>
  );
}
