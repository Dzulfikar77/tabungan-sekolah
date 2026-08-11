/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { StudentManagement } from './components/StudentManagement';
import { DepositForm } from './components/DepositForm';
import { WithdrawalForm } from './components/WithdrawalForm';
import { BookManagement } from './components/BookManagement';
import { Reports } from './components/Reports';
import { AuditLogView } from './components/AuditLogView';
import { ViewerPage } from './components/ViewerPage';
import { SppPayment } from './components/SppPayment';
import { LoginPage } from './components/LoginPage';
import { ViewerLoginPage } from './components/ViewerLoginPage';
import { SettingsModal } from './components/SettingsModal';

function MainLayout() {
  const { currentUser, logout } = useApp();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [viewerLoginMode, setViewerLoginMode] = useState(true);

  if (!currentUser) {
    if (viewerLoginMode) {
      return <ViewerLoginPage onBackToAdmin={() => setViewerLoginMode(false)} />;
    }
    return <LoginPage onViewerLogin={() => setViewerLoginMode(true)} />;
  }

  // Viewer sees full-page viewer portal without navbar
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
        {activeTab === 'books' && <BookManagement />}
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

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
