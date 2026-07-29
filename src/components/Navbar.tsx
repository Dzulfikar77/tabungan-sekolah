/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import {
  Building2,
  Calendar,
  LogOut,
  LayoutDashboard,
  Users,
  Banknote,
  ArrowDownCircle,
  FileSpreadsheet,
  History,
  Settings,
  Eye,
  GraduationCap,
  Shield,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  openSettingsModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  openSettingsModal,
}) => {
  const {
    currentUser,
    schoolSettings,
    academicYears,
    currentAcademicYear,
    setCurrentAcademicYearId,
    transactions,
  } = useApp();

  const pendingApprovalsCount = transactions.filter(
    (t) => t.status === 'Menunggu Persetujuan'
  ).length;

  const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
    Developer: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    'Super Admin': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    Admin: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    'Wali Kelas': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    Viewer: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300' },
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Developer', 'Super Admin', 'Admin', 'Wali Kelas'] },
    { id: 'students', label: 'Siswa', icon: Users, roles: ['Developer', 'Super Admin', 'Admin', 'Wali Kelas'] },
    { id: 'spp', label: 'SPP', icon: GraduationCap, roles: ['Developer', 'Super Admin', 'Admin'] },
    { id: 'deposit', label: 'Setoran', icon: Banknote, roles: ['Developer', 'Super Admin', 'Admin', 'Wali Kelas'] },
    { id: 'withdrawal', label: 'Penarikan / Approval', icon: ArrowDownCircle, roles: ['Developer', 'Super Admin', 'Admin', 'Wali Kelas'], badge: pendingApprovalsCount },
    { id: 'books', label: 'Koperasi & Kegiatan', icon: Layers, roles: ['Developer', 'Super Admin', 'Admin', 'Wali Kelas'] },
    { id: 'reports', label: 'Laporan', icon: FileSpreadsheet, roles: ['Developer', 'Super Admin', 'Admin', 'Wali Kelas'] },
    { id: 'audit', label: 'Audit Log', icon: History, roles: ['Developer', 'Super Admin'] },
    { id: 'viewer', label: 'Tabungan Saya', icon: Eye, roles: ['Viewer'] },
    { id: 'spp', label: 'SPP', icon: GraduationCap, roles: ['Developer', 'Super Admin', 'Admin'] },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner & School Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & School Logo */}
        <div className="flex items-center gap-3">
          {schoolSettings.logoUrl ? (
            <img
              src={schoolSettings.logoUrl}
              alt="Logo Sekolah"
              className="w-10 h-10 object-contain rounded-md border border-slate-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              {schoolSettings.name}
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>Sistem Tabungan Digital</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
              <span>{schoolSettings.address}</span>
            </p>
          </div>
        </div>

        {/* Right Section: Academic Year & Role Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Academic Year Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-600">Tahun Ajaran:</span>
            <select
              value={currentAcademicYear.id}
              onChange={(e) => setCurrentAcademicYearId(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.year} {ay.isCurrent ? '(Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Role Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${roleColors[currentUser.role].bg} ${roleColors[currentUser.role].text} ${roleColors[currentUser.role].border}`}>
            <Shield className="w-3.5 h-3.5" />
            <span>{currentUser.role}</span>
            {currentUser.demoMode && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">DEMO</span>
            )}
          </div>

          {/* User Profile & Settings */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
            <button
              onClick={openSettingsModal}
              title="Pengaturan Sekolah & Backup"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              title="Keluar"
              className="flex items-center gap-1.5 px-2.5 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <nav className="flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
          {navItems
            .filter((item) => item.roles.includes(currentUser.role))
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                        isActive ? 'bg-white text-emerald-700' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>
    </header>
  );
};
