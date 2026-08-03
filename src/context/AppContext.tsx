/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  Student,
  Transaction,
  TransactionEditRequest,
  TransactionStatus,
  Book,
  BookDistribution,
  BookPayment,
  SppPayment,
  AcademicYear,
  AuditLogItem,
  SchoolSettings,
  MonthlyDeductionSummary,
} from '../types';
import {
  initialUsers,
  initialSchoolSettings,
  initialAcademicYears,
  initialStudents,
  initialBooks,
  initialBookDistributions,
  initialBookPayments,
  initialTransactions,
  initialSppPayments,
  initialAuditLogs,
} from '../utils/initialData';
import { generateTransactionNumber } from '../utils/format';
import { generateViewerUsername, generateViewerPassword } from '../utils/viewerCredentials';
import { fetchAll, insertRow, updateRow, deleteRow, deleteRowsBy, upsertRow, onSyncError, SyncError } from '../lib/db';

const ROLE_RANK: Record<UserRole, number> = { Developer: 4, 'Super Admin': 3, Admin: 2, 'Wali Kelas': 1, Viewer: 0 };

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  switchRole: (role: UserRole) => void;

  schoolSettings: SchoolSettings;
  updateSchoolSettings: (settings: Partial<SchoolSettings>) => void;

  academicYears: AcademicYear[];
  currentAcademicYear: AcademicYear;
  addAcademicYear: (year: string) => void;
  setCurrentAcademicYearId: (id: string) => void;
  bulkPromoteStudents: (fromClass: string, toClass: string) => void;

  students: Student[];
  addStudent: (studentData: Omit<Student, 'id' | 'createdAt' | 'balance'> & { initialBalance?: number }) => { success: boolean; error?: string };
  updateStudent: (id: string, data: Partial<Student>) => void;
  softDeleteStudent: (id: string) => void;
  importStudentsBulk: (newStudents: Partial<Student>[]) => { addedCount: number; errors: string[] };

  transactions: Transaction[];
  addDeposit: (studentId: string, amount: number, reason: string) => { success: boolean; transaction?: Transaction; error?: string };
  requestWithdrawal: (studentId: string, amount: number, reason: string) => { success: boolean; transaction?: Transaction; error?: string };
  approveWithdrawal: (transactionId: string) => { success: boolean; error?: string };
  rejectWithdrawal: (transactionId: string, rejectionReason?: string) => { success: boolean; error?: string };
  closeStudentSavings: (studentIds: string[], reason: string) => { success: boolean; pendingCount: number; closedCount: number; totalWithdrawn: number; errors: string[] };
  requestEditTransaction: (transactionId: string, newAmount: number, newReason: string) => { success: boolean; error?: string };
  approveEditTransaction: (transactionId: string) => { success: boolean; error?: string };
  rejectEditTransaction: (transactionId: string, rejectionReason?: string) => { success: boolean; error?: string };

  toggleMonthlyDeduction: (enabled: boolean) => void;
  runMonthlyDeduction: () => MonthlyDeductionSummary;

  books: Book[];
  addBook: (book: Omit<Book, 'id'>) => void;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => void;

  bookDistributions: BookDistribution[];
  toggleBookDistribution: (bookId: string, studentId: string) => void;

  bookPayments: BookPayment[];
  addBookPayment: (bookId: string, studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan') => { success: boolean; error?: string };

  auditLogs: AuditLogItem[];
  addAuditLog: (action: string, valueBefore: string, valueAfter: string, details: string) => void;

  sppPayments: SppPayment[];
  addSppPayment: (studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan', period: string) => { success: boolean; error?: string };

  exportBackupData: () => string;
  restoreBackupData: (jsonString: string) => { success: boolean; error?: string };

  syncErrors: SyncError[];
  clearSyncErrors: () => void;

  users: User[];
  addUser: (data: { username: string; name: string; role: UserRole; password: string; accessLevel?: 'TK' | 'MI' }) => { success: boolean; error?: string };
  updateUserRole: (id: string, role: UserRole) => void;
  changeUserPassword: (id: string, newPassword: string) => void;
  changeViewerPassword: (newPassword: string) => { success: boolean; error?: string };
  resetViewerPassword: (studentId: string, newPassword: string) => { success: boolean; error?: string };
  verifyRecoveryKey: (key: string) => boolean;
  resetStaffPassword: (targetUserId: string, newPassword: string) => { success: boolean; error?: string };
  selfResetAdminPassword: (username: string, key: string, newPassword: string) => { success: boolean; error?: string };
  backfillViewerCredentials: () => { created: number; errors: string[] };
  deleteUser: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tabungan_sekolah_v1_data';

function mergeById<T extends { id: string }>(db: T[], local: T[]): T[] {
  const dbIds = new Set(db.map((x) => x.id));
  return [...db, ...local.filter((x) => !dbIds.has(x.id))];
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_school`);
    return saved ? JSON.parse(saved) : initialSchoolSettings;
  });

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_years`);
    return saved ? JSON.parse(saved) : initialAcademicYears;
  });

  const [currentAcademicYearId, setCurrentAcademicYearIdState] = useState<string>(() => {
    const current = academicYears.find((y) => y.isCurrent) || academicYears[0];
    return current ? current.id : 'ay-2';
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_students`);
    return saved ? JSON.parse(saved) : initialStudents;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_transactions`);
    return saved ? JSON.parse(saved) : initialTransactions;
  });

  const [books, setBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_books`);
    return saved ? JSON.parse(saved) : initialBooks;
  });

  const [bookDistributions, setBookDistributions] = useState<BookDistribution[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_distributions`);
    return saved ? JSON.parse(saved) : initialBookDistributions;
  });

  const [bookPayments, setBookPayments] = useState<BookPayment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_book_payments`);
    return saved ? JSON.parse(saved) : initialBookPayments;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_audit_logs`);
    return saved ? JSON.parse(saved) : initialAuditLogs;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_users`);
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [sppPayments, setSppPayments] = useState<SppPayment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_spp_payments`);
    return saved ? JSON.parse(saved) : initialSppPayments;
  });

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_school`, JSON.stringify(schoolSettings));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_years`, JSON.stringify(academicYears));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_students`, JSON.stringify(students));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_transactions`, JSON.stringify(transactions));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_books`, JSON.stringify(books));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_distributions`, JSON.stringify(bookDistributions));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_book_payments`, JSON.stringify(bookPayments));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_audit_logs`, JSON.stringify(auditLogs));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_spp_payments`, JSON.stringify(sppPayments));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_users`, JSON.stringify(users));
  }, [schoolSettings, academicYears, students, transactions, books, bookDistributions, bookPayments, auditLogs, sppPayments, users]);

  const [dbLoaded, setDbLoaded] = useState(false);
  useEffect(() => {
    const fetchFromSupabase = async () => {
      const [dbStudents, dbTransactions, dbBooks, dbDistributions, dbBookPayments, dbSppPayments, dbAcademicYears, dbAuditLogs, dbUsers] = await Promise.all([
        fetchAll<Student>('students'),
        fetchAll<Transaction>('transactions'),
        fetchAll<Book>('books'),
        fetchAll<BookDistribution>('book_distributions'),
        fetchAll<BookPayment>('book_payments'),
        fetchAll<SppPayment>('spp_payments'),
        fetchAll<AcademicYear>('academic_years'),
        fetchAll<AuditLogItem>('audit_logs'),
        fetchAll<User>('users'),
      ]);
      if (dbStudents.length > 0) setStudents((prev) => mergeById(dbStudents, prev));
      if (dbTransactions.length > 0) setTransactions((prev) => mergeById(dbTransactions, prev));
      if (dbBooks.length > 0) setBooks((prev) => mergeById(dbBooks, prev));
      if (dbDistributions.length > 0) setBookDistributions((prev) => mergeById(dbDistributions, prev));
      if (dbBookPayments.length > 0) setBookPayments((prev) => mergeById(dbBookPayments, prev));
      if (dbSppPayments.length > 0) setSppPayments((prev) => mergeById(dbSppPayments, prev));
      if (dbAcademicYears.length > 0) setAcademicYears((prev) => mergeById(dbAcademicYears, prev));
      if (dbAuditLogs.length > 0) setAuditLogs((prev) => mergeById(dbAuditLogs, prev));
      if (dbUsers.length > 0) setUsers((prev) => mergeById(dbUsers, prev));
      setDbLoaded(true);
    };
    fetchFromSupabase();
  }, []);

  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  useEffect(() => {
    return onSyncError((err) => {
      setSyncErrors((prev) => [err, ...prev].slice(0, 5));
    });
  }, []);
  const clearSyncErrors = () => setSyncErrors([]);

  const currentAcademicYear = academicYears.find((y) => y.id === currentAcademicYearId) || academicYears[0];

  const switchRole = (role: UserRole) => {
    if (!currentUser) return;
    const found = initialUsers.find((u) => u.role === role);
    if (found) {
      setCurrentUser(found);
      addAuditLog('Ganti Role Demo', `User: ${currentUser.name}`, `User: ${found.name}`, `Beralih tampilan ke role ${role}`);
    }
  };

  const login = async (username: string, password: string) => {
    const user = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (user) {
      setCurrentUser(user);
      return { success: true };
    }
    return { success: false, error: 'Username atau kata sandi salah.' };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const addUser = (data: { username: string; name: string; role: UserRole; password: string; accessLevel?: 'TK' | 'MI' }) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Developer yang dapat menambah user.' };
    }
    if (users.some((u) => u.username.toLowerCase() === data.username.trim().toLowerCase())) {
      return { success: false, error: `Username "${data.username}" sudah dipakai.` };
    }
    const newUser: User = {
      id: `u-${Date.now()}`,
      username: data.username.trim(),
      name: data.name.trim(),
      role: data.role,
      password: data.password,
      accessLevel: data.accessLevel,
    };
    setUsers((prev) => [...prev, newUser]);
    insertRow('users', newUser);
    addAuditLog('Tambah User', '-', `User: ${newUser.username} (${newUser.role})`, `Menambahkan user baru ${newUser.name} dengan role ${newUser.role}`);
    return { success: true };
  };

  const updateUserRole = (id: string, role: UserRole) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') return;
    const target = users.find((u) => u.id === id);
    if (!target || target.role === role) return;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    updateRow('users', id, { role });
    addAuditLog('Ubah Role User', `User: ${target.username} (${target.role})`, `User: ${target.username} (${role})`, `Mengubah role user ${target.name} menjadi ${role}`);
  };

  const changeUserPassword = (id: string, newPassword: string) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') return;
    const target = users.find((u) => u.id === id);
    if (!target) return;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, password: newPassword } : u)));
    updateRow('users', id, { password: newPassword });
    addAuditLog('Ganti Password User', `User: ${target.username}`, `User: ${target.username}`, `Password user ${target.name} diubah oleh Developer.`);
  };

  const deleteUser = (id: string) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') return;
    if (id === currentUser.id) return;
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const developerCount = users.filter((u) => u.role === 'Developer' && !u.demoMode).length;
    if (target.role === 'Developer' && !target.demoMode && developerCount <= 1) {
      addAuditLog('Hapus User Ditolak', `User: ${target.username}`, '-', `Percobaan menghapus Developer terakhir ditolak.`);
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    deleteRow('users', id);
    addAuditLog('Hapus User', `User: ${target.username} (${target.role})`, '-', `Menghapus user ${target.name} (${target.username}) dari sistem.`);
  };

  const findLinkedViewerUser = (studentId: string): User | undefined =>
    users.find((u) => u.role === 'Viewer' && u.studentId === studentId);

  const deleteLinkedViewerUser = (studentId: string, reason: string) => {
    const linked = findLinkedViewerUser(studentId);
    if (!linked) return;
    setUsers((prev) => prev.filter((u) => u.id !== linked.id));
    deleteRow('users', linked.id);
    addAuditLog('Hapus User Viewer', `User: ${linked.username}`, '-', `User viewer ${linked.username} dihapus (${reason}).`);
  };

  const changeViewerPassword = (newPassword: string) => {
    if (!currentUser || currentUser.role !== 'Viewer') {
      return { success: false, error: 'Hanya Viewer yang dapat mengubah password sendiri.' };
    }
    if (newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, password: newPassword } : u)));
    updateRow('users', currentUser.id, { password: newPassword });
    addAuditLog('Ubah Password Viewer', currentUser.username, currentUser.username, `Viewer ${currentUser.name} mengubah password sendiri.`);
    return { success: true };
  };

  const resetViewerPassword = (studentId: string, newPassword: string) => {
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    const target = users.find((u) => u.role === 'Viewer' && u.studentId === studentId);
    if (!target) {
      return { success: false, error: 'Akun viewer tidak ditemukan.' };
    }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, password: newPassword } : u)));
    updateRow('users', target.id, { password: newPassword });
    addAuditLog('Reset Password Viewer', 'User: ' + target.username, 'User: ' + target.username, 'Password viewer ' + target.username + ' direset melalui lupa-password.');
    return { success: true };
  };

  const verifyRecoveryKey = (key: string) => {
    const envKey = import.meta.env.VITE_ADMIN_RECOVERY_KEY;
    if (!envKey) return false;
    return key.trim() === envKey;
  };

  const resetStaffPassword = (targetUserId: string, newPassword: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const target = users.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, error: 'User tidak ditemukan.' };
    }
    if (ROLE_RANK[currentUser.role] <= ROLE_RANK[target.role]) {
      return { success: false, error: 'Anda tidak memiliki wewenang untuk mereset password user ini.' };
    }
    if (newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    setUsers((prev) => prev.map((u) => (u.id === targetUserId ? { ...u, password: newPassword } : u)));
    updateRow('users', targetUserId, { password: newPassword });
    addAuditLog('Reset Password User', 'User: ' + target.username, 'User: ' + target.username, 'Password ' + target.username + ' direset oleh ' + currentUser.name + '.');
    return { success: true };
  };

  const selfResetAdminPassword = (username: string, key: string, newPassword: string) => {
    if (!verifyRecoveryKey(key)) {
      return { success: false, error: 'Recovery key salah.' };
    }
    if (newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    const target = users.find((u) => u.role !== 'Viewer' && u.username.toLowerCase() === username.trim().toLowerCase());
    if (!target) {
      return { success: false, error: 'Username tidak ditemukan.' };
    }
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, password: newPassword } : u)));
    updateRow('users', target.id, { password: newPassword });
    addAuditLog('Reset Password via Recovery Key', 'User: ' + target.username, 'User: ' + target.username, 'Password ' + target.username + ' direset via recovery key.');
    return { success: true };
  };

  const backfillViewerCredentials = () => {
    if (!currentUser || currentUser.demoMode) {
      return { created: 0, errors: ['Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.'] };
    }
    if (currentUser.role !== 'Developer' && currentUser.role !== 'Super Admin' && currentUser.role !== 'Admin') {
      return { created: 0, errors: ['Anda tidak memiliki hak untuk melakukan backfill.'] };
    }
    const usedUsernames: string[] = users.map((u) => u.username);
    const usedPasswords: string[] = users.filter((u) => u.role === 'Viewer').map((u) => u.password || '');
    const createdUsers: User[] = [];

    students.forEach((s) => {
      if (s.isDeleted || s.status !== 'Aktif') return;
      if (findLinkedViewerUser(s.id)) return;
      const ay = academicYears.find((y) => y.id === s.academicYearId) || currentAcademicYear;
      const username = generateViewerUsername(s.name, usedUsernames);
      const password = generateViewerPassword(ay, usedPasswords);
      usedUsernames.push(username);
      usedPasswords.push(password);
      createdUsers.push({
        id: `u-bf-${Date.now()}-${createdUsers.length}`,
        username,
        name: s.name,
        role: 'Viewer',
        studentId: s.id,
        password,
      });
    });

    if (createdUsers.length > 0) {
      setUsers((prev) => [...createdUsers, ...prev]);
      Promise.all(createdUsers.map((u) => insertRow('users', u)));
      addAuditLog('Backfill Kredensial Viewer', '-', `User Viewer dibuat: ${createdUsers.length}`, `Membuat ${createdUsers.length} User Viewer untuk siswa eksisting.`);
    }
    return { created: createdUsers.length, errors: [] };
  };

  const addAuditLog = (action: string, valueBefore: string, valueAfter: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      timestamp: new Date().toISOString(),
      valueBefore,
      valueAfter,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    insertRow('audit_logs', newLog);
  };

  const updateSchoolSettings = (settings: Partial<SchoolSettings>) => {
    if (!currentUser || currentUser.demoMode) return;
    const before = JSON.stringify(schoolSettings);
    setSchoolSettings((prev) => ({ ...prev, ...settings }));
    updateRow('school_settings', 'singleton', settings);
    addAuditLog('Update Pengaturan Sekolah', before, JSON.stringify({ ...schoolSettings, ...settings }), 'Mengubah nama, alamat, atau logo sekolah');
  };

  const addAcademicYear = (yearStr: string) => {
    if (!currentUser || currentUser.demoMode) return;
    const newYearId = `ay-${Date.now()}`;
    const updatedYears = academicYears.map((y) => ({ ...y, isCurrent: false }));
    const newYear: AcademicYear = {
      id: newYearId,
      year: yearStr,
      isCurrent: true,
      createdAt: new Date().toISOString(),
    };
    setAcademicYears([...updatedYears, newYear]);
    setCurrentAcademicYearIdState(newYearId);
    insertRow('academic_years', newYear);
    academicYears.forEach((y) => {
      if (y.isCurrent) updateRow('academic_years', y.id, { isCurrent: false });
    });
    addAuditLog('Tambah Tahun Ajaran', `Aktif: ${currentAcademicYear.year}`, `Aktif: ${yearStr}`, `Membuka tahun ajaran baru ${yearStr} dan mengarsip data sebelumnya.`);
  };

  const setCurrentAcademicYearId = (id: string) => {
    if (!currentUser || currentUser.demoMode) return;
    const target = academicYears.find((y) => y.id === id);
    if (!target || target.isCurrent) return;
    setAcademicYears((prev) => prev.map((y) => ({ ...y, isCurrent: y.id === id })));
    setCurrentAcademicYearIdState(id);
    academicYears.forEach((y) => {
      if (y.isCurrent || y.id === id) updateRow('academic_years', y.id, { isCurrent: y.id === id });
    });
    addAuditLog('Ganti Tahun Ajaran Aktif', `Aktif: ${currentAcademicYear.year}`, `Aktif: ${target.year}`, `Mengubah tahun ajaran aktif menjadi ${target.year}`);
  };

  const bulkPromoteStudents = (fromClass: string, toClass: string) => {
    if (!currentUser || currentUser.demoMode) return;
    const affected = students.filter((s) => !s.isDeleted && s.classGrade === fromClass);
    setStudents((prev) =>
      prev.map((s) => {
        if (!s.isDeleted && s.classGrade === fromClass) {
          if (toClass === 'Lulus') {
            return { ...s, status: 'Lulus' };
          }
          return { ...s, classGrade: toClass as any };
        }
        return s;
      })
    );
    affected.forEach((s) => {
      updateRow('students', s.id, toClass === 'Lulus' ? { status: 'Lulus' } : { classGrade: toClass });
      if (toClass === 'Lulus') deleteLinkedViewerUser(s.id, 'naik ke Lulus');
    });
    addAuditLog('Pindah Kelas Massal', `Kelas asal: ${fromClass}`, `Kelas tujuan: ${toClass}`, `Memindahkan ${affected.length} siswa dari kelas ${fromClass} ke ${toClass}`);
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'createdAt' | 'balance'> & { initialBalance?: number }) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    // Validate NIS uniqueness
    const exists = students.find((s) => s.nis === studentData.nis && !s.isDeleted);
    if (exists) {
      return { success: false, error: `NIS ${studentData.nis} sudah terdaftar atas nama ${exists.name}!` };
    }

    const newId = `st-${Date.now()}`;
    const { initialBalance, ...studentFields } = studentData;
    const initialBal = initialBalance || 0;
    const newStudent: Student = {
      ...studentFields,
      id: newId,
      balance: initialBal,
      createdAt: new Date().toISOString(),
    };

    setStudents((prev) => [newStudent, ...prev]);
    insertRow('students', newStudent);

    // Auto-create viewer user (username = nama, password = tahun ajaran + seq)
    const ay = academicYears.find((y) => y.id === newStudent.academicYearId) || currentAcademicYear;
    const viewerUser: User = {
      id: `u-${Date.now()}`,
      username: generateViewerUsername(newStudent.name, users.map((u) => u.username)),
      name: newStudent.name,
      role: 'Viewer',
      studentId: newStudent.id,
      password: generateViewerPassword(ay, users.filter((u) => u.role === 'Viewer').map((u) => u.password || '')),
    };
    setUsers((prev) => [viewerUser, ...prev]);
    insertRow('users', viewerUser);

    // If initial balance > 0, auto-generate initial setoran
    if (initialBal > 0) {
      const trNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length);
      const initialTx: Transaction = {
        id: `tr-${Date.now()}`,
        transactionNumber: trNum,
        studentId: newId,
        studentName: newStudent.name,
        studentNis: newStudent.nis,
        classGrade: newStudent.classGrade,
        type: 'Setoran',
        amount: initialBal,
        status: 'Disetujui',
        reason: 'Setoran Saldo Awal Pendaftaran',
        createdById: currentUser.id,
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
        academicYearId: currentAcademicYear.id,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [initialTx, ...prev]);
      insertRow('transactions', initialTx);
    }

    addAuditLog('Tambah Siswa Baru', '-', `Siswa: ${newStudent.name} (NIS: ${newStudent.nis})`, `Menambahkan siswa baru kelas ${newStudent.classGrade} dengan saldo awal Rp ${initialBal}`);
    return { success: true };
  };

  const updateStudent = (id: string, data: Partial<Student>) => {
    if (!currentUser || currentUser.demoMode) return;
    const student = students.find((s) => s.id === id);
    if (!student) return;

    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    updateRow('students', id, data);
    addAuditLog('Edit Data Siswa', JSON.stringify(student), JSON.stringify({ ...student, ...data }), `Mengubah data siswa ${student.name} (NIS: ${student.nis})`);
  };

  const softDeleteStudent = (id: string) => {
    if (!currentUser || currentUser.demoMode) return;
    const student = students.find((s) => s.id === id);
    if (!student) return;

    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, isDeleted: true } : s)));
    updateRow('students', id, { isDeleted: true });
    deleteLinkedViewerUser(id, 'soft delete siswa');
    addAuditLog('Hapus Siswa (Soft Delete)', `Status: ${student.status}`, 'Status: Soft Deleted', `Menghapus siswa ${student.name} (NIS: ${student.nis}). Data histori tetap aman.`);
  };

  const importStudentsBulk = (newStudentsList: Partial<Student>[]) => {
    if (!currentUser || currentUser.demoMode) {
      return { addedCount: 0, errors: ['Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.'] };
    }
    let addedCount = 0;
    const errors: string[] = [];
    const addedArray: Student[] = [];
    const addedUsers: User[] = [];
    const addedTransactions: Transaction[] = [];

    newStudentsList.forEach((st, idx) => {
      if (!st.nis || !st.name) {
        errors.push(`Baris ${idx + 1}: Data NIS atau Nama kosong.`);
        return;
      }

      const duplicate = students.find((s) => s.nis === st.nis && !s.isDeleted) || addedArray.find((s) => s.nis === st.nis);
      if (duplicate) {
        errors.push(`NIS ${st.nis} duplikat (sudah ada).`);
        return;
      }

      const newId = `st-import-${Date.now()}-${idx}`;
      const initBal = st.balance || 0;
      const newStudent: Student = {
        id: newId,
        nis: st.nis,
        name: st.name,
        classGrade: st.classGrade || 'Kelas 1A',
        status: 'Aktif',
        parentName: st.parentName || '',
        phone: st.phone || '',
        balance: initBal,
        academicYearId: currentAcademicYear.id,
        createdAt: new Date().toISOString(),
      };

      addedArray.push(newStudent);
      addedCount++;

      // Auto-create viewer user (username = nama, password = tahun ajaran + seq)
      const ay = academicYears.find((y) => y.id === (st.academicYearId || currentAcademicYear.id)) || currentAcademicYear;
      const batchUsernames = addedUsers.map((u) => u.username);
      const batchPws = addedUsers.map((u) => u.password || '');
      const allUsernames = users.map((u) => u.username).concat(batchUsernames);
      const allPws = users.filter((u) => u.role === 'Viewer').map((u) => u.password || '').concat(batchPws);
      const viewerUser: User = {
        id: `u-imp-${Date.now()}-${idx}`,
        username: generateViewerUsername(newStudent.name, allUsernames),
        name: newStudent.name,
        role: 'Viewer',
        studentId: newStudent.id,
        password: generateViewerPassword(ay, allPws),
      };
      addedUsers.push(viewerUser);

      if (initBal > 0) {
        const trNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length + addedTransactions.length);
        addedTransactions.push({
          id: `tr-imp-${Date.now()}-${idx}`,
          transactionNumber: trNum,
          studentId: newId,
          studentName: newStudent.name,
          studentNis: newStudent.nis,
          classGrade: newStudent.classGrade,
          type: 'Setoran',
          amount: initBal,
          status: 'Disetujui',
          reason: 'Setoran Saldo Awal Import Excel',
          createdById: currentUser.id,
          createdByName: currentUser.name,
          createdByRole: currentUser.role,
          academicYearId: currentAcademicYear.id,
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (addedArray.length > 0) {
      setStudents((prev) => [...addedArray, ...prev]);
      Promise.all(addedArray.map((s) => insertRow('students', s)));
      if (addedUsers.length > 0) {
        setUsers((prev) => [...addedUsers, ...prev]);
        Promise.all(addedUsers.map((u) => insertRow('users', u)));
      }
      if (addedTransactions.length > 0) {
        setTransactions((prev) => [...addedTransactions, ...prev]);
        Promise.all(addedTransactions.map((t) => insertRow('transactions', t)));
      }
      addAuditLog('Import Massal Siswa Excel', '-', `Total diimport: ${addedCount}`, `Berhasil mengimport ${addedCount} data siswa dari Excel.`);
    }

    return { addedCount, errors };
  };

  const addDeposit = (studentId: string, amount: number, reason: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId && !s.isDeleted);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Nominal setoran harus lebih besar dari 0.' };
    }
    if (amount > 99999000) {
      return { success: false, error: 'Nominal melebihi batas maksimal transaksi (Rp 99.999.000).' };
    }

    const trNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length);
    const balanceBefore = student.balance;
    const balanceAfter = balanceBefore + amount;

    const newTx: Transaction = {
      id: `tr-${Date.now()}`,
      transactionNumber: trNum,
      studentId,
      studentName: student.name,
      studentNis: student.nis,
      classGrade: student.classGrade,
      type: 'Setoran',
      amount,
      status: 'Disetujui',
      reason,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
      academicYearId: currentAcademicYear.id,
      createdAt: new Date().toISOString(),
    };

    // Realtime update balance
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, balance: balanceAfter } : s)));
    setTransactions((prev) => [newTx, ...prev]);
    insertRow('transactions', newTx);
    updateRow('students', studentId, { balance: balanceAfter });

    // Auto-deduct pending debt jika saldo sudah mencukupi
    const existingDebt = student.pendingDebt || 0;
    const deductionTransactions: Transaction[] = [];
    if (existingDebt > 0) {
      if (balanceAfter >= existingDebt) {
        // Saldo cukup untuk lunasi tunggakan
        const finalBalance = balanceAfter - existingDebt;
        const debtTrNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length + 1);
        const debtTx: Transaction = {
          id: `tr-auto-debt-${Date.now()}`,
          transactionNumber: debtTrNum,
          studentId,
          studentName: student.name,
          studentNis: student.nis,
          classGrade: student.classGrade,
          type: 'Potongan Bulanan',
          amount: existingDebt,
          status: 'Disetujui',
          reason: `Pelunasan Otomatis Tunggakan Potongan Bulanan (Rp ${existingDebt.toLocaleString('id-ID')})`,
          createdById: currentUser.id,
          createdByName: `${currentUser.name} (Sistem Otomatis)`,
          createdByRole: currentUser.role,
          academicYearId: currentAcademicYear.id,
          createdAt: new Date().toISOString(),
        };
        deductionTransactions.push(debtTx);
        setStudents((prev) =>
          prev.map((s) => {
            if (s.id === studentId) {
              const updated = { ...s, balance: finalBalance };
              delete updated.pendingDebt;
              return updated;
            }
            return s;
          })
        );
        setTransactions((prev) => [debtTx, ...prev]);
        insertRow('transactions', debtTx);
        updateRow('students', studentId, { balance: finalBalance, pendingDebt: 0 });
      } else if (balanceAfter > 0) {
        // Saldo ada tapi kurang: potong habis, kurangi tunggakan
        const remainingDebt = existingDebt - balanceAfter;
        const debtTrNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length + 1);
        const debtTx: Transaction = {
          id: `tr-auto-debt-${Date.now()}`,
          transactionNumber: debtTrNum,
          studentId,
          studentName: student.name,
          studentNis: student.nis,
          classGrade: student.classGrade,
          type: 'Potongan Bulanan',
          amount: balanceAfter,
          status: 'Disetujui',
          reason: `Potongan Otomatis Tunggakan Sebagian (Sisa Rp ${remainingDebt.toLocaleString('id-ID')})`,
          createdById: currentUser.id,
          createdByName: `${currentUser.name} (Sistem Otomatis)`,
          createdByRole: currentUser.role,
          academicYearId: currentAcademicYear.id,
          createdAt: new Date().toISOString(),
        };
        deductionTransactions.push(debtTx);
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, balance: 0, pendingDebt: remainingDebt } : s))
        );
        setTransactions((prev) => [debtTx, ...prev]);
        insertRow('transactions', debtTx);
        updateRow('students', studentId, { balance: 0, pendingDebt: remainingDebt });
      }
    }

    addAuditLog(
      'Setoran Tabungan',
      `Saldo ${student.name}: Rp ${balanceBefore.toLocaleString('id-ID')}`,
      `Saldo ${student.name}: Rp ${balanceAfter.toLocaleString('id-ID')}${existingDebt > 0 ? ' (Ada potongan tunggakan)' : ''}`,
      `Setoran Rp ${amount.toLocaleString('id-ID')} (${trNum}) oleh ${currentUser.name}${existingDebt > 0 ? `. Tunggakan otomatis dipotong Rp ${(balanceAfter - (students.find(s => s.id === studentId)?.balance || balanceAfter)).toLocaleString('id-ID')}` : ''}`
    );

    return { success: true, transaction: newTx, autoDeducted: deductionTransactions.length > 0, deductionTransactions };
  };

  const requestWithdrawal = (studentId: string, amount: number, reason: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId && !s.isDeleted);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Nominal potongan harus lebih besar dari 0.' };
    }
    if (amount > student.balance) {
      return {
        success: false,
        error: `Saldo tidak mencukupi. Saldo saat ini: Rp ${student.balance.toLocaleString('id-ID')}`,
      };
    }

    const trNum = generateTransactionNumber('PT', currentAcademicYear.year, transactions.length);

    let initialStatus: TransactionStatus = 'Menunggu Approval Admin';
    let isAdminApproved = false;
    let adminName: string | undefined = undefined;
    let isSuperAdminApproved = false;
    let superAdminName: string | undefined = undefined;

    if (currentUser.role === 'Wali Kelas' || currentUser.role === 'Admin') {
      initialStatus = 'Menunggu Approval Super Admin';
      isAdminApproved = true;
      adminName = currentUser.name;
    } else if (currentUser.role === 'Super Admin' || currentUser.role === 'Developer') {
      initialStatus = 'Disetujui';
      isAdminApproved = true;
      adminName = currentUser.name;
      isSuperAdminApproved = true;
      superAdminName = currentUser.name;
    }

    const newTx: Transaction = {
      id: `tr-${Date.now()}`,
      transactionNumber: trNum,
      studentId,
      studentName: student.name,
      studentNis: student.nis,
      classGrade: student.classGrade,
      type: 'Penarikan',
      amount,
      status: initialStatus,
      reason,
      approvedByAdmin: isAdminApproved,
      approvedByAdminName: adminName,
      approvedBySuperAdmin: isSuperAdminApproved,
      approvedBySuperAdminName: superAdminName,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
      academicYearId: currentAcademicYear.id,
      createdAt: new Date().toISOString(),
    };

    // If Super Admin/Dev requested directly, deduct balance immediately
    if (initialStatus === 'Disetujui') {
      const balanceAfter = student.balance - amount;
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: balanceAfter } : s)));
      updateRow('students', student.id, { balance: balanceAfter });
    }

    setTransactions((prev) => [newTx, ...prev]);
    insertRow('transactions', newTx);

    addAuditLog(
      'Pengajuan Penarikan',
      `Saldo ${student.name}: Rp ${student.balance.toLocaleString('id-ID')}`,
      `Status: ${initialStatus}`,
      `Pengajuan penarikan Rp ${amount.toLocaleString('id-ID')} untuk ${student.name} (${trNum}). Status: ${initialStatus}`
    );

    return { success: true, transaction: newTx };
  };

  const approveWithdrawal = (transactionId: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }
    if (tx.status === 'Disetujui' || tx.status === 'Ditolak') {
      return { success: false, error: 'Transaksi ini sudah selesai diproses.' };
    }

    const student = students.find((s) => s.id === tx.studentId);
    if (!student) {
      return { success: false, error: 'Data siswa tidak ditemukan.' };
    }

    // Role Wali Kelas / Admin approval (Tier 1)
    if (currentUser.role === 'Wali Kelas' || currentUser.role === 'Admin') {
      if (tx.approvedByAdmin) {
        return { success: false, error: 'Transaksi ini sudah disetujui oleh Admin/Wali Kelas. Menunggu persetujuan Kepala Sekolah.' };
      }

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                status: 'Menunggu Approval Super Admin',
                approvedByAdmin: true,
                approvedByAdminName: currentUser.name,
              }
            : t
        )
      );

      setBookPayments((prev) =>
        prev.map((bp) =>
          bp.savingsTransactionId === transactionId
            ? {
                ...bp,
                status: 'Menunggu Approval Super Admin',
                approvedByAdmin: true,
                approvedByAdminName: currentUser.name,
              }
            : bp
        )
      );
      const tier1Bp = bookPayments.find((bp) => bp.savingsTransactionId === transactionId);
      if (tier1Bp) {
        updateRow('book_payments', tier1Bp.id, { status: 'Menunggu Approval Super Admin', approvedByAdmin: true, approvedByAdminName: currentUser.name });
      }

      updateRow('transactions', transactionId, { status: 'Menunggu Approval Super Admin', approvedByAdmin: true, approvedByAdminName: currentUser.name });

      addAuditLog(
        'Approval Penarikan (Admin / Wali Kelas)',
        'Status: Menunggu Approval Admin',
        'Status: Menunggu Approval Super Admin',
        `Disetujui tahap 1 oleh ${currentUser.name} (${currentUser.role}). Menunggu persetujuan akhir Kepala Sekolah.`
      );

      return { success: true };
    }

    // Role Super Admin / Developer approval (Tier 2 / Final)
    if (currentUser.role === 'Super Admin' || currentUser.role === 'Developer') {
      if (tx.closesAccount) {
        const finalAmount = executeCloseAccount(student);

        setTransactions((prev) =>
          prev.map((t) =>
            t.id === transactionId
              ? {
                  ...t,
                  amount: finalAmount,
                  status: 'Disetujui',
                  approvedByAdmin: true,
                  approvedByAdminName: t.approvedByAdminName || currentUser.name,
                  approvedBySuperAdmin: true,
                  approvedBySuperAdminName: currentUser.name,
                  approvedById: currentUser.id,
                  approvedByName: currentUser.name,
                  approvedByRole: currentUser.role,
                }
              : t
          )
        );
        updateRow('transactions', transactionId, {
          amount: finalAmount,
          status: 'Disetujui',
          approvedByAdmin: true,
          approvedBySuperAdmin: true,
          approvedBySuperAdminName: currentUser.name,
          approvedById: currentUser.id,
          approvedByName: currentUser.name,
          approvedByRole: currentUser.role,
        });

        addAuditLog(
          'Approval Tutup Tabungan (Final)',
          `Saldo ${student.name}: Rp ${finalAmount.toLocaleString('id-ID')}`,
          'Saldo: 0 — data siswa dihapus',
          `Persetujuan final tutup tabungan ${student.name} (NIS: ${student.nis}). Seluruh saldo Rp ${finalAmount.toLocaleString('id-ID')} ditarik, data siswa dihapus permanen.`
        );

        return { success: true };
      }

      if (student.balance < tx.amount) {
        return {
          success: false,
          error: `Saldo siswa saat ini (Rp ${student.balance.toLocaleString('id-ID')}) tidak mencukupi nominal potongan (Rp ${tx.amount.toLocaleString('id-ID')}).`,
        };
      }

      const balanceBefore = student.balance;
      const balanceAfter = balanceBefore - tx.amount;

      // Deduct balance & finalize approval
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: balanceAfter } : s)));
      updateRow('students', student.id, { balance: balanceAfter });
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                status: 'Disetujui',
                approvedByAdmin: true,
                approvedByAdminName: t.approvedByAdminName || currentUser.name,
                approvedBySuperAdmin: true,
                approvedBySuperAdminName: currentUser.name,
                approvedById: currentUser.id,
                approvedByName: currentUser.name,
                approvedByRole: currentUser.role,
              }
            : t
        )
      );
      updateRow('transactions', transactionId, {
        status: 'Disetujui',
        approvedByAdmin: true,
        approvedBySuperAdmin: true,
        approvedBySuperAdminName: currentUser.name,
        approvedById: currentUser.id,
        approvedByName: currentUser.name,
        approvedByRole: currentUser.role,
      });

      setBookPayments((prev) =>
        prev.map((bp) =>
          bp.savingsTransactionId === transactionId
            ? {
                ...bp,
                status: 'Disetujui',
                approvedByAdmin: true,
                approvedByAdminName: bp.approvedByAdminName || currentUser.name,
                approvedBySuperAdmin: true,
                approvedBySuperAdminName: currentUser.name,
              }
            : bp
        )
      );
      const tier2Bp = bookPayments.find((bp) => bp.savingsTransactionId === transactionId);
      if (tier2Bp) {
        updateRow('book_payments', tier2Bp.id, {
          status: 'Disetujui',
          approvedByAdmin: true,
          approvedBySuperAdmin: true,
          approvedBySuperAdminName: currentUser.name,
        });
      }

      addAuditLog(
        'Approval Penarikan Final (Super Admin)',
        `Saldo ${student.name}: Rp ${balanceBefore.toLocaleString('id-ID')}`,
        `Saldo ${student.name}: Rp ${balanceAfter.toLocaleString('id-ID')}`,
        `Persetujuan final disetujui oleh Kepala Sekolah (${currentUser.name}). Saldo Rp ${tx.amount.toLocaleString('id-ID')} (${tx.transactionNumber}) resmi dipotong.`
      );

      return { success: true };
    }

    return { success: false, error: 'Akses ditolak. Anda tidak memiliki wewenang untuk menyetujui transaksi.' };
  };

  const rejectWithdrawal = (transactionId: string, rejectionReason?: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer' && currentUser.role !== 'Admin' && currentUser.role !== 'Wali Kelas') {
      return { success: false, error: 'Anda tidak memiliki hak untuk menolak pengajuan.' };
    }

    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              status: 'Ditolak',
              rejectionReason: rejectionReason || 'Ditolak',
              approvedById: currentUser.id,
              approvedByName: currentUser.name,
              approvedByRole: currentUser.role,
            }
          : t
      )
    );
    updateRow('transactions', transactionId, { status: 'Ditolak', rejectionReason: rejectionReason || 'Ditolak' });

    setBookPayments((prev) =>
      prev.map((bp) =>
        bp.savingsTransactionId === transactionId ? { ...bp, status: 'Ditolak', rejectionReason } : bp
      )
    );
    const rejectBp = bookPayments.find((bp) => bp.savingsTransactionId === transactionId);
    if (rejectBp) {
      updateRow('book_payments', rejectBp.id, { status: 'Ditolak', rejectionReason: rejectionReason || 'Ditolak' });
    }

    addAuditLog(
      'Approval Penarikan Ditolak',
      `Status: ${tx.status}`,
      'Status: Ditolak',
      `Pengajuan ${tx.transactionNumber} ditolak oleh ${currentUser.name} (${currentUser.role}). Alasan: ${rejectionReason || 'Ditolak'}`
    );

    return { success: true };
  };

  const requestEditTransaction = (transactionId: string, newAmount: number, newReason: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }
    if (tx.status !== 'Disetujui') {
      return { success: false, error: 'Hanya transaksi berstatus Disetujui yang dapat diperbaiki.' };
    }
    if (tx.hasPendingEdit) {
      return { success: false, error: 'Transaksi ini sudah memiliki permintaan perbaikan yang menunggu persetujuan.' };
    }
    if (tx.type === 'Potongan Bulanan') {
      return { success: false, error: 'Transaksi Potongan Bulanan otomatis tidak dapat diperbaiki.' };
    }
    if (newAmount <= 0) {
      return { success: false, error: 'Nominal baru harus lebih besar dari 0.' };
    }
    if (newAmount > 99999000) {
      return { success: false, error: 'Nominal melebihi batas maksimal transaksi (Rp 99.999.000).' };
    }
    if (newAmount === tx.amount && newReason.trim() === tx.reason.trim()) {
      return { success: false, error: 'Tidak ada perubahan: nominal dan keterangan sama dengan data saat ini.' };
    }

    const editRequest: TransactionEditRequest = {
      requestedById: currentUser.id,
      requestedByName: currentUser.name,
      requestedByRole: currentUser.role,
      requestedAt: new Date().toISOString(),
      oldAmount: tx.amount,
      newAmount,
      oldReason: tx.reason,
      newReason: newReason.trim(),
    };

    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, hasPendingEdit: true, editRequest } : t))
    );
    updateRow('transactions', transactionId, { has_pending_edit: true, edit_request: editRequest });

    addAuditLog(
      'Perbaikan Transaksi Diajukan',
      `${tx.transactionNumber}: Rp ${tx.amount.toLocaleString('id-ID')} / Ket: ${tx.reason}`,
      `${tx.transactionNumber}: Rp ${newAmount.toLocaleString('id-ID')} / Ket: ${newReason.trim()}`,
      `Permintaan perbaikan ${tx.type} ${tx.studentName} (${tx.transactionNumber}) diajukan oleh ${currentUser.name}. Menunggu persetujuan Super Admin.`
    );

    return { success: true };
  };

  const approveEditTransaction = (transactionId: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Super Admin (Kepala Sekolah) yang dapat menyetujui perbaikan transaksi.' };
    }
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }
    if (!tx.hasPendingEdit || !tx.editRequest) {
      return { success: false, error: 'Tidak ada permintaan perbaikan untuk transaksi ini.' };
    }
    const student = students.find((s) => s.id === tx.studentId);
    if (!student) {
      return { success: false, error: 'Data siswa tidak ditemukan.' };
    }

    const { oldAmount, newAmount, newReason } = tx.editRequest;
    const diff = newAmount - oldAmount;
    const newBalance = tx.type === 'Setoran' ? student.balance + diff : student.balance - diff;
    if (newBalance < 0) {
      return {
        success: false,
        error: `Saldo siswa (Rp ${student.balance.toLocaleString('id-ID')}) tidak mencukupi setelah perbaikan nominal (menjadi Rp ${newBalance.toLocaleString('id-ID')}).`,
      };
    }

    setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: newBalance } : s)));
    updateRow('students', student.id, { balance: newBalance });

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              amount: newAmount,
              reason: newReason,
              hasPendingEdit: false,
              editRequest: undefined,
            }
          : t
      )
    );
    updateRow('transactions', transactionId, { amount: newAmount, reason: newReason, has_pending_edit: false, edit_request: null });

    addAuditLog(
      'Perbaikan Transaksi Disetujui',
      `${tx.transactionNumber}: Rp ${oldAmount.toLocaleString('id-ID')} / Ket: ${tx.editRequest.oldReason}`,
      `${tx.transactionNumber}: Rp ${newAmount.toLocaleString('id-ID')} / Ket: ${newReason}`,
      `Perbaikan ${tx.type} ${tx.studentName} (${tx.transactionNumber}) disetujui oleh ${currentUser.name}. Saldo ${student.name} diperbarui menjadi Rp ${newBalance.toLocaleString('id-ID')}.`
    );

    return { success: true };
  };

  const rejectEditTransaction = (transactionId: string, rejectionReason?: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Super Admin (Kepala Sekolah) yang dapat menolak perbaikan transaksi.' };
    }
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }
    if (!tx.hasPendingEdit || !tx.editRequest) {
      return { success: false, error: 'Tidak ada permintaan perbaikan untuk transaksi ini.' };
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, hasPendingEdit: false, editRequest: undefined } : t))
    );
    updateRow('transactions', transactionId, { has_pending_edit: false, edit_request: null });

    addAuditLog(
      'Perbaikan Transaksi Ditolak',
      `${tx.transactionNumber}: Rp ${tx.editRequest.oldAmount.toLocaleString('id-ID')} → Rp ${tx.editRequest.newAmount.toLocaleString('id-ID')}`,
      `${tx.transactionNumber}: tetap Rp ${tx.amount.toLocaleString('id-ID')}`,
      `Permintaan perbaikan ${tx.transactionNumber} ditolak oleh ${currentUser.name}. Alasan: ${rejectionReason || 'Tidak ada alasan'}. Data asli dipertahankan.`
    );

    return { success: true };
  };

  const executeCloseAccount = (student: Student) => {
    const finalAmount = student.balance;
    deleteLinkedViewerUser(student.id, 'tutup tabungan');
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
    setBookDistributions((prev) => prev.filter((d) => d.studentId !== student.id));
    setBookPayments((prev) => prev.filter((p) => p.studentId !== student.id));
    setSppPayments((prev) => prev.filter((p) => p.studentId !== student.id));

    deleteRow('students', student.id);
    deleteRowsBy('book_distributions', 'student_id', student.id);
    deleteRowsBy('book_payments', 'student_id', student.id);
    deleteRowsBy('spp_payments', 'student_id', student.id);

    addAuditLog(
      'Tutup Tabungan',
      `Saldo ${student.name}: Rp ${finalAmount.toLocaleString('id-ID')}`,
      'Saldo: 0 (ditarik penuh) — data siswa dihapus',
      `Tabungan ${student.name} (NIS: ${student.nis}, ${student.classGrade}) ditutup. Seluruh saldo Rp ${finalAmount.toLocaleString('id-ID')} ditarik dan data siswa dihapus permanen dari database.`
    );

    return finalAmount;
  };

  const requestCloseSavings = (studentIds: string[], reason: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, pendingCount: 0, closedCount: 0, totalWithdrawn: 0, errors: ['Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.'] };
    }
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer' && currentUser.role !== 'Admin' && currentUser.role !== 'Wali Kelas') {
      return { success: false, pendingCount: 0, closedCount: 0, totalWithdrawn: 0, errors: ['Anda tidak memiliki hak untuk mengajukan tutup tabungan.'] };
    }

    const errors: string[] = [];
    const pendingTxs: Transaction[] = [];
    const immediateCloses: { student: Student; tx: Transaction }[] = [];
    let totalRequested = 0;

    studentIds.forEach((sid) => {
      const student = students.find((s) => s.id === sid && !s.isDeleted);
      if (!student) {
        errors.push(`Siswa tidak ditemukan (ID: ${sid}).`);
        return;
      }
      if (student.balance <= 0) {
        errors.push(`Saldo ${student.name} sudah Rp 0, tidak dapat ditutup.`);
        return;
      }

      const trNum = generateTransactionNumber('PT', currentAcademicYear.year, transactions.length + pendingTxs.length + immediateCloses.length);

      let initialStatus: TransactionStatus = 'Menunggu Approval Super Admin';
      let isAdminApproved = false;
      let adminName: string | undefined = undefined;
      let isSuperAdminApproved = false;
      let superAdminName: string | undefined = undefined;

      if (currentUser.role === 'Wali Kelas' || currentUser.role === 'Admin') {
        initialStatus = 'Menunggu Approval Super Admin';
        isAdminApproved = true;
        adminName = currentUser.name;
      } else {
        initialStatus = 'Disetujui';
        isAdminApproved = true;
        adminName = currentUser.name;
        isSuperAdminApproved = true;
        superAdminName = currentUser.name;
      }

      const newTx: Transaction = {
        id: `tr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        transactionNumber: trNum,
        studentId: student.id,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        type: 'Penarikan',
        amount: student.balance,
        status: initialStatus,
        reason: `Tutup Tabungan — ${reason}`,
        closesAccount: true,
        approvedByAdmin: isAdminApproved,
        approvedByAdminName: adminName,
        approvedBySuperAdmin: isSuperAdminApproved,
        approvedBySuperAdminName: superAdminName,
        createdById: currentUser.id,
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
        academicYearId: currentAcademicYear.id,
        createdAt: new Date().toISOString(),
      };

      totalRequested += student.balance;

      if (initialStatus === 'Disetujui') {
        immediateCloses.push({ student, tx: newTx });
      } else {
        pendingTxs.push(newTx);
      }
    });

    if (pendingTxs.length > 0) {
      setTransactions((prev) => [...pendingTxs, ...prev]);
      pendingTxs.forEach((tx) => insertRow('transactions', tx));
    }

    let totalWithdrawn = 0;
    immediateCloses.forEach(({ student, tx }) => {
      const finalAmount = executeCloseAccount(student);
      totalWithdrawn += finalAmount;
      const finalTx = { ...tx, amount: finalAmount };
      setTransactions((prev) => [finalTx, ...prev]);
      insertRow('transactions', finalTx);
    });

    addAuditLog(
      'Pengajuan Tutup Tabungan',
      `${studentIds.length} siswa diajukan`,
      pendingTxs.length > 0 ? `${pendingTxs.length} menunggu approval Super Admin` : 'Semua langsung disetujui',
      `Pengajuan tutup tabungan untuk ${studentIds.length} siswa. Alasan: ${reason}. ${pendingTxs.length > 0 ? `${pendingTxs.length} menunggu persetujuan Kepala Sekolah.` : ''}${immediateCloses.length > 0 ? ` ${immediateCloses.length} langsung ditutup, total ditarik Rp ${totalWithdrawn.toLocaleString('id-ID')}.` : ''}${errors.length > 0 ? ` Error: ${errors.join('; ')}` : ''}`
    );

    return { success: true, pendingCount: pendingTxs.length, closedCount: immediateCloses.length, totalWithdrawn, errors };
  };

  const toggleMonthlyDeduction = (enabled: boolean) => {
    updateSchoolSettings({ monthlyDeductionEnabled: enabled });
  };

  const runMonthlyDeduction = (): MonthlyDeductionSummary => {
    if (!currentUser || currentUser.demoMode) {
      return { runDate: new Date().toISOString(), totalStudentsDeducted: 0, totalAmountDeducted: 0, deductedStudents: [], skippedStudents: [], pendingDebtStudents: [] };
    }
    const activeStudents = students.filter(
      (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
    );

    const amountToDeduct = schoolSettings.monthlyDeductionAmount || 2000;

    const deductedList: { id: string; name: string; nis: string; balanceBefore: number; balanceAfter: number }[] = [];
    const skippedList: { id: string; name: string; nis: string; balance: number; reason: string }[] = [];
    const pendingDebtList: { id: string; name: string; nis: string; debt: number; balance: number }[] = [];

    const newTransactions: Transaction[] = [];
    const updatedStudentsMap: Record<string, number> = {};
    const updatedDebtMap: Record<string, number> = {};

    activeStudents.forEach((student) => {
      const existingDebt = student.pendingDebt || 0;
      const totalToDeduct = amountToDeduct + existingDebt;

      if (student.balance >= totalToDeduct) {
        const balBefore = student.balance;
        const balAfter = balBefore - totalToDeduct;
        updatedStudentsMap[student.id] = balAfter;
        updatedDebtMap[student.id] = 0;

        deductedList.push({
          id: student.id,
          name: student.name,
          nis: student.nis,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
        });

        if (existingDebt > 0) {
          const trNum1 = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length + newTransactions.length);
          newTransactions.push({
            id: `tr-auto-debt-${Date.now()}-${student.id}`,
            transactionNumber: trNum1,
            studentId: student.id,
            studentName: student.name,
            studentNis: student.nis,
            classGrade: student.classGrade,
            type: 'Potongan Bulanan',
            amount: existingDebt,
            status: 'Disetujui',
            reason: `Pelunasan Tunggakan Potongan Bulanan (Akumulasi Rp ${existingDebt.toLocaleString('id-ID')})`,
            createdById: currentUser.id,
            createdByName: `${currentUser.name} (Sistem Potongan Bulanan)`,
            createdByRole: currentUser.role,
            academicYearId: currentAcademicYear.id,
            createdAt: new Date().toISOString(),
          });
        }

        const trNum2 = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length + newTransactions.length);
        newTransactions.push({
          id: `tr-auto-${Date.now()}-${student.id}`,
          transactionNumber: trNum2,
          studentId: student.id,
          studentName: student.name,
          studentNis: student.nis,
          classGrade: student.classGrade,
          type: 'Potongan Bulanan',
          amount: amountToDeduct,
          status: 'Disetujui',
          reason: `Potongan Bulanan Administrasi Periode ${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
          createdById: currentUser.id,
          createdByName: `${currentUser.name} (Sistem Potongan Bulanan)`,
          createdByRole: currentUser.role,
          academicYearId: currentAcademicYear.id,
          createdAt: new Date().toISOString(),
        });
      } else if (student.balance > 0) {
        const remainingDebt = totalToDeduct - student.balance;
        updatedStudentsMap[student.id] = 0;
        updatedDebtMap[student.id] = remainingDebt;

        pendingDebtList.push({
          id: student.id,
          name: student.name,
          nis: student.nis,
          debt: remainingDebt,
          balance: 0,
        });

        const trNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length + newTransactions.length);
        newTransactions.push({
          id: `tr-auto-${Date.now()}-${student.id}`,
          transactionNumber: trNum,
          studentId: student.id,
          studentName: student.name,
          studentNis: student.nis,
          classGrade: student.classGrade,
          type: 'Potongan Bulanan',
          amount: student.balance,
          status: 'Disetujui',
          reason: `Potongan Bulanan Sebagian (Sisa tunggakan Rp ${remainingDebt.toLocaleString('id-ID')})`,
          createdById: currentUser.id,
          createdByName: `${currentUser.name} (Sistem Potongan Bulanan)`,
          createdByRole: currentUser.role,
          academicYearId: currentAcademicYear.id,
          createdAt: new Date().toISOString(),
        });
      } else {
        const newDebt = (existingDebt || 0) + amountToDeduct;
        updatedDebtMap[student.id] = newDebt;
        updatedStudentsMap[student.id] = 0;

        pendingDebtList.push({
          id: student.id,
          name: student.name,
          nis: student.nis,
          debt: newDebt,
          balance: 0,
        });

        skippedList.push({
          id: student.id,
          name: student.name,
          nis: student.nis,
          balance: 0,
          reason: `Saldo kosong, tunggakan bertambah Rp ${amountToDeduct.toLocaleString('id-ID')} (Total tunggakan: Rp ${newDebt.toLocaleString('id-ID')})`,
        });
      }
    });

    if (Object.keys(updatedStudentsMap).length > 0 && Object.keys(updatedDebtMap).length > 0) {
      setStudents((prev) =>
        prev.map((s) => {
          let updated = { ...s };
          if (updatedStudentsMap[s.id] !== undefined) {
            updated.balance = updatedStudentsMap[s.id];
          }
          if (updatedDebtMap[s.id] !== undefined) {
            if (updatedDebtMap[s.id] > 0) {
              updated.pendingDebt = updatedDebtMap[s.id];
            } else {
              delete updated.pendingDebt;
            }
          }
          return updated;
        })
      );
      Object.entries(updatedStudentsMap).forEach(([sid, bal]) => {
        updateRow('students', sid, { balance: bal, pendingDebt: updatedDebtMap[sid] || 0 });
      });
      setTransactions((prev) => [...newTransactions, ...prev]);
      Promise.all(newTransactions.map((t) => insertRow('transactions', t)));
    }

    const summary: MonthlyDeductionSummary = {
      runDate: new Date().toISOString(),
      totalStudentsDeducted: deductedList.length,
      totalAmountDeducted: deductedList.reduce((sum, d) => sum + (d.balanceBefore - d.balanceAfter), 0),
      deductedStudents: deductedList,
      skippedStudents: skippedList,
      pendingDebtStudents: pendingDebtList,
    };

    updateSchoolSettings({ lastMonthlyDeductionRun: new Date().toISOString() });

    addAuditLog(
      'Eksekusi Potongan Bulanan Otomatis',
      '-',
      `Terpotong: ${deductedList.length} siswa (Rp ${summary.totalAmountDeducted.toLocaleString('id-ID')}), Tunggakan: ${pendingDebtList.length} siswa`,
      `Potongan bulanan Rp ${amountToDeduct} dijalankan tanggal 28. ${deductedList.length} siswa terpotong, ${pendingDebtList.length} siswa masuk tunggakan.`
    );

    return summary;
  };

  const addBook = (bookData: Omit<Book, 'id'>) => {
    if (!currentUser || currentUser.demoMode) return;
    const newBook: Book = {
      ...bookData,
      id: `bk-${Date.now()}`,
    };
    setBooks((prev) => [...prev, newBook]);
    insertRow('books', newBook);
    addAuditLog('Tambah Data Buku', '-', `Buku: ${newBook.title}`, `Menambahkan buku baru ${newBook.title} kelas ${newBook.classGrade} harga Rp ${newBook.price}`);
  };

  const updateBook = (id: string, bookData: Partial<Book>) => {
    if (!currentUser || currentUser.demoMode) return;
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...bookData } : b)));
    updateRow('books', id, bookData);
    addAuditLog('Edit Data Buku', '-', JSON.stringify(bookData), `Mengubah informasi data buku ID ${id}`);
  };

  const deleteBook = (id: string) => {
    if (!currentUser || currentUser.demoMode) return;
    const book = books.find((b) => b.id === id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    deleteRow('books', id);
    addAuditLog('Hapus Buku', `Buku: ${book?.title}`, '-', `Menghapus buku ${book?.title} dari sistem`);
  };

  const toggleBookDistribution = (bookId: string, studentId: string) => {
    if (!currentUser || currentUser.demoMode) return;
    const existing = bookDistributions.find((bd) => bd.bookId === bookId && bd.studentId === studentId);
    if (existing) {
      const updated = { ...existing, received: !existing.received, receivedAt: !existing.received ? new Date().toISOString() : undefined };
      setBookDistributions((prev) =>
        prev.map((bd) => (bd.id === existing.id ? updated : bd))
      );
      updateRow('book_distributions', existing.id, { received: updated.received, receivedAt: updated.receivedAt });
    } else {
      const newBd: BookDistribution = {
        id: `bd-${Date.now()}`,
        itemId: bookId,
        bookId,
        studentId,
        received: true,
        receivedAt: new Date().toISOString(),
      };
      setBookDistributions((prev) => [...prev, newBd]);
      insertRow('book_distributions', newBd);
    }
  };

  const addBookPayment = (bookId: string, studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan') => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const item = books.find((b) => b.id === bookId);
    const student = students.find((s) => s.id === studentId && !s.isDeleted);

    if (!item || !student) {
      return { success: false, error: 'Data item (Koperasi/Kegiatan) atau siswa tidak ditemukan.' };
    }

    const trNum = generateTransactionNumber('BK', currentAcademicYear.year, bookPayments.length);

    if (paymentMethod === 'Tunai') {
      const newPayment: BookPayment = {
        id: `bp-${Date.now()}`,
        transactionNumber: trNum,
        itemId: item.id,
        bookId: item.id,
        itemTitle: item.title,
        bookTitle: item.title,
        itemType: item.type || 'Koperasi',
        category: item.category,
        studentId,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        amount: item.price,
        paymentMethod: 'Tunai',
        status: 'Disetujui',
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        academicYearId: currentAcademicYear.id,
      };

      setBookPayments((prev) => [newPayment, ...prev]);
      insertRow('book_payments', newPayment);

      // Automatically mark distribution as received
      toggleBookDistribution(item.id, studentId);

      addAuditLog(
        `Pembayaran ${item.type || 'Koperasi'} Tunai`,
        '-',
        `Lunas Tunai: Rp ${item.price.toLocaleString('id-ID')}`,
        `Pembayaran ${item.type || 'Koperasi'} (${item.title}) oleh siswa ${student.name} secara tunai.`
      );

      return { success: true };
    } else {
      // Potong Tabungan -> must request withdrawal & go through 2-tier approval!
      if (student.balance < item.price) {
        return {
          success: false,
          error: `Saldo tabungan siswa (Rp ${student.balance.toLocaleString('id-ID')}) tidak mencukupi harga ${item.type.toLowerCase()} (Rp ${item.price.toLocaleString('id-ID')}).`,
        };
      }

      // 1. Generate savings withdrawal transaction with status based on role
      const withdrawalRes = requestWithdrawal(
        studentId,
        item.price,
        `Pembayaran ${item.type} (${item.title}) via Potong Tabungan`
      );

      if (!withdrawalRes.success || !withdrawalRes.transaction) {
        return { success: false, error: withdrawalRes.error || 'Gagal mengajukan potongan tabungan.' };
      }

      const tx = withdrawalRes.transaction;

      // 2. Generate BookPayment linked to withdrawal transaction ID
      const newPayment: BookPayment = {
        id: `bp-${Date.now()}`,
        transactionNumber: trNum,
        itemId: item.id,
        bookId: item.id,
        itemTitle: item.title,
        bookTitle: item.title,
        itemType: item.type || 'Koperasi',
        category: item.category,
        studentId,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        amount: item.price,
        paymentMethod: 'Potong Tabungan',
        status: tx.status,
        approvedByAdmin: tx.approvedByAdmin,
        approvedByAdminName: tx.approvedByAdminName,
        approvedBySuperAdmin: tx.approvedBySuperAdmin,
        approvedBySuperAdminName: tx.approvedBySuperAdminName,
        savingsTransactionId: tx.id,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        academicYearId: currentAcademicYear.id,
      };

      setBookPayments((prev) => [newPayment, ...prev]);
      insertRow('book_payments', newPayment);

      addAuditLog(
        `Pengajuan Pembayaran ${item.type} Potong Tabungan`,
        `Status: ${tx.status}`,
        `Status: ${tx.status}`,
        `Pengajuan pembayaran ${item.type.toLowerCase()} (${item.title}) via potong tabungan. Status: ${tx.status}.`
      );

      return { success: true };
    }
  };

  const addSppPayment = (studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan', period: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId && !s.isDeleted);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }

    const sppAmount = student.classGrade.startsWith('TK') ? (schoolSettings.sppTKAmount || 50000) : (schoolSettings.sppSDAmount || 0);
    if (sppAmount <= 0) {
      return { success: false, error: 'SPP untuk siswa ini gratis (Rp 0). Tidak perlu melakukan pembayaran.' };
    }
    const trNum = generateTransactionNumber('BK', currentAcademicYear.year, sppPayments.length);

    if (paymentMethod === 'Potong Tabungan') {
      if (student.balance < sppAmount) {
        return { success: false, error: `Saldo tabungan siswa (Rp ${student.balance.toLocaleString('id-ID')}) tidak mencukupi pembayaran SPP (Rp ${sppAmount.toLocaleString('id-ID')}).` };
      }
      const txNum = generateTransactionNumber('PT', currentAcademicYear.year, transactions.length);
      const newTx: Transaction = {
        id: `tr-${Date.now()}`,
        transactionNumber: txNum,
        studentId,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        type: 'Penarikan',
        amount: sppAmount,
        status: 'Disetujui',
        reason: `Pembayaran SPP ${period} via Potong Tabungan`,
        createdById: currentUser.id,
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
        academicYearId: currentAcademicYear.id,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
      insertRow('transactions', newTx);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, balance: s.balance - sppAmount } : s))
      );
      updateRow('students', studentId, { balance: student.balance - sppAmount });
    }

    const newPayment: SppPayment = {
      id: `spp-${Date.now()}`,
      transactionNumber: trNum,
      studentId,
      studentName: student.name,
      studentNis: student.nis,
      classGrade: student.classGrade,
      amount: sppAmount,
      paymentMethod,
      status: 'Disetujui',
      period,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      academicYearId: currentAcademicYear.id,
    };

    setSppPayments((prev) => [newPayment, ...prev]);
    insertRow('spp_payments', newPayment);

    addAuditLog(
      'Pembayaran SPP',
      '-',
      `${student.name}: Rp ${sppAmount.toLocaleString('id-ID')} (${period})`,
      `Pembayaran SPP ${student.name} (${student.nis}) - ${period} via ${paymentMethod} oleh ${currentUser.name}`
    );

    return { success: true };
  };

  const exportBackupData = () => {
    const backupObj = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.name,
      schoolSettings,
      academicYears,
      students,
      transactions,
      books,
      bookDistributions,
      bookPayments,
      sppPayments,
      auditLogs,
    };
    addAuditLog('Backup Database JSON', '-', `Versi 1.0`, `Ekspor cadangan data sistem oleh ${currentUser.name}`);
    return JSON.stringify(backupObj, null, 2);
  };

  const restoreBackupData = (jsonString: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Developer') {
      return { success: false, error: 'Fitur restore database hanya dapat diakses oleh role Developer.' };
    }

    try {
      const data = JSON.parse(jsonString);
      if (!data.schoolSettings || !data.students || !data.transactions) {
        return { success: false, error: 'Format file cadangan tidak valid!' };
      }

      setSchoolSettings(data.schoolSettings);
      setAcademicYears(data.academicYears || initialAcademicYears);
      setStudents(data.students || []);
      setTransactions(data.transactions || []);
      setBooks(data.books || []);
      setBookDistributions(data.bookDistributions || []);
      setBookPayments(data.bookPayments || []);
      setSppPayments(data.sppPayments || []);
      setAuditLogs(data.auditLogs || []);

      Promise.all([
        upsertRow('school_settings', data.schoolSettings),
        ...(data.academicYears || []).map((y: any) => upsertRow('academic_years', y)),
        ...(data.students || []).map((s: any) => upsertRow('students', s)),
        ...(data.transactions || []).map((t: any) => upsertRow('transactions', t)),
        ...(data.books || []).map((b: any) => upsertRow('books', b)),
        ...(data.bookDistributions || []).map((bd: any) => upsertRow('book_distributions', bd)),
        ...(data.bookPayments || []).map((bp: any) => upsertRow('book_payments', bp)),
        ...(data.sppPayments || []).map((sp: any) => upsertRow('spp_payments', sp)),
        ...(data.auditLogs || []).map((al: any) => upsertRow('audit_logs', al)),
      ]);

      addAuditLog(
        'Restore Database JSON',
        'Sistem Di-Restore',
        `Tanggal Cadangan: ${data.exportedAt || 'Tidak Diketahui'}`,
        `Pemulihan data penuh sistem berhasil dilakukan oleh Developer.`
      );

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Gagal membaca file JSON cadangan.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        login,
        logout,
        switchRole,
        schoolSettings,
        updateSchoolSettings,
        academicYears,
        currentAcademicYear,
        addAcademicYear,
        setCurrentAcademicYearId,
        bulkPromoteStudents,
        students,
        addStudent,
        updateStudent,
        softDeleteStudent,
        importStudentsBulk,
        transactions,
        addDeposit,
        requestWithdrawal,
        approveWithdrawal,
        rejectWithdrawal,
        requestEditTransaction,
        approveEditTransaction,
        rejectEditTransaction,
        closeStudentSavings: requestCloseSavings,
        toggleMonthlyDeduction,
        runMonthlyDeduction,
        books,
        addBook,
        updateBook,
        deleteBook,
        bookDistributions,
        toggleBookDistribution,
        bookPayments,
        addBookPayment,
        auditLogs,
        addAuditLog,
        sppPayments,
        addSppPayment,
        exportBackupData,
        restoreBackupData,
        syncErrors,
        clearSyncErrors,
        users,
        addUser,
        updateUserRole,
        changeUserPassword,
        changeViewerPassword,
        resetViewerPassword,
        verifyRecoveryKey,
        resetStaffPassword,
        selfResetAdminPassword,
        backfillViewerCredentials,
        deleteUser,
      }}
    >
      {syncErrors.length > 0 && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-medium shadow-lg relative z-50">
          <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <span className="leading-snug">
              Peringatan: Gagal menyimpan data ke cloud ({syncErrors[0].table} — {syncErrors[0].message.slice(0, 150)}). Data hanya tersimpan sementara di perangkat Anda. Periksa koneksi internet; jika masalah berlanjut, hubungi segera developer.
              {syncErrors.length > 1 && ` (+${syncErrors.length - 1} operasi gagal lainnya)`}
            </span>
            <button onClick={clearSyncErrors} className="shrink-0 bg-white/20 hover:bg-white/30 rounded px-2 py-1 cursor-pointer">
              Tutup
            </button>
          </div>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
