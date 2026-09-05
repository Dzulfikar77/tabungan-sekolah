import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import LoginSiswa from './components/LoginSiswa';
import LoginAdmin from './components/LoginAdmin';
import DashboardSiswa from './components/DashboardSiswa';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { StudentManagement } from './components/StudentManagement';
import { DepositForm } from './components/DepositForm';
import { WithdrawalForm } from './components/WithdrawalForm';
import { BookManagement } from './components/BookManagement';
import { Reports } from './components/Reports';
import { AuditLogView } from './components/AuditLogView';
import { SppPayment } from './components/SppPayment';
import { ViewerPage } from './components/ViewerPage';
import { SettingsModal } from './components/SettingsModal';

/**
 * Shell utama setelah login (rute /dashboard): Navbar dengan tab-tab fitur,
 * tombol Pengaturan (khusus Developer & Super Admin), dan SettingsModal.
 * Shell ini hilang saat refactor routing sebelumnya sehingga tombol
 * Pengaturan tidak pernah tampil meski login berhasil.
 */
function AdminShell() {
  const { currentUser, logout } = useApp();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Tanpa sesi aktif: kembali ke halaman login admin.
  if (!currentUser) {
    return <Navigate to="/admin" replace />;
  }

  if (currentUser.role === 'Viewer') {
    return (
      <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ViewerPage onLogout={logout} />
        </main>
        <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
            Sistem Informasi Sekolah • Portal Orang Tua
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col antialiased">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logout}
        openSettingsModal={() => setIsSettingsModalOpen(true)}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'students' && <StudentManagement />}
        {activeTab === 'deposit' && <DepositForm />}
        {activeTab === 'withdrawal' && <WithdrawalForm />}
        {activeTab === 'koprasi' && <BookManagement />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'audit' && <AuditLogView />}
        {activeTab === 'spp' && <SppPayment />}
        {activeTab === 'viewer' && <ViewerPage onLogout={logout} />}
      </main>
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          Sistem Informasi Sekolah • Powered by Dzulfikar Dev
        </div>
      </footer>
      {isSettingsModalOpen && (
        <SettingsModal onClose={() => setIsSettingsModalOpen(false)} />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginSiswa />} />
          <Route path="/admin" element={<LoginAdmin />} />
          <Route path="/dashboard-siswa" element={<DashboardSiswa />} />
          <Route path="/dashboard" element={<AdminShell />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
