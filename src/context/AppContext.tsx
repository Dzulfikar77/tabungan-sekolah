/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  UserRole,
  Student,
  ClassGrade,
  Transaction,
  TransactionEditRequest,
  TransactionStatus,
  Book,
  BookDistribution,
  BookPayment,
  BookPaymentMethod,
  SppPayment,
  AcademicYear,
  AuditLogItem,
  SchoolSettings,
  MonthlyDeductionSummary,
} from '../types';
import {
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
import { generateTransactionNumber, isClassInUserLevel, formatDate } from '../utils/format';
import { normalizeName } from '../utils/viewerCredentials';
import { YearEndDecision, nextClassFrom } from '../utils/yearEnd';
import { mergeSchoolSettings } from '../utils/schoolSettings';
import { inspectBackupPayload } from '../utils/backup';
import { fetchAll, insertRow, updateRow, deleteRow, deleteRowsBy, upsertRow, toDbRow, onSyncError, SyncError, onSyncState, SyncState } from '../lib/db';
import { supabase } from '../lib/supabase';

const ROLE_RANK: Record<UserRole, number> = { Developer: 4, 'Super Admin': 3, Admin: 2, 'Wali Kelas': 1, 'Admin Koperasi': 1, Viewer: 0 };

function emailFor(username: string): string {
  return `${normalizeName(username)}@akun.tabungan-sekolah.local`;
}

// Migrasi data lama: TK A -> TK A.1, TK B -> TK B.1 (kelas TK dipecah jadi 2 kelompok).
type WithClassGrade = { classGrade?: string };
const migrateClassGrades = <T extends WithClassGrade>(rows: T[]): T[] =>
  rows.map((r) =>
    r.classGrade === 'TK A' ? { ...r, classGrade: 'TK A.1' } :
    r.classGrade === 'TK B' ? { ...r, classGrade: 'TK B.1' } : r
  );

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;

  schoolSettings: SchoolSettings;
  updateSchoolSettings: (settings: Partial<SchoolSettings>) => void;

  academicYears: AcademicYear[];
  currentAcademicYear: AcademicYear;
  addAcademicYear: (year: string) => Promise<{ success: boolean; error?: string }>;
  deleteAcademicYear: (id: string) => { success: boolean; error?: string };
  setCurrentAcademicYearId: (id: string) => Promise<{ success: boolean; error?: string }>;
  bulkPromoteStudents: (fromClass: string, toClass: string, excludeIds?: string[]) => void;
  runYearEndClosure: (decisions: YearEndDecision[], targetAcademicYearId: string) => Promise<{ success: boolean; moved: number; repeated: number; skipped: number; totalWithdrawn: number; errors: string[] }>;

  students: Student[];
  addStudent: (studentData: Omit<Student, 'id' | 'createdAt' | 'balance'> & { initialBalance?: number }) => Promise<{ success: boolean; error?: string }>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<{ success: boolean; error?: string }>;
  softDeleteStudent: (id: string) => Promise<{ success: boolean; error?: string }>;
  importStudentsBulk: (newStudents: Partial<Student>[]) => Promise<{ addedCount: number; errors: string[] }>;

  transactions: Transaction[];
  addDeposit: (studentId: string, amount: number, reason: string) => Promise<{ success: boolean; transaction?: Transaction; error?: string; autoDeducted?: boolean; deductionTransactions?: Transaction[] }>;
  requestWithdrawal: (studentId: string, amount: number, reason: string) => Promise<{ success: boolean; transaction?: Transaction; error?: string }>;
  approveWithdrawal: (transactionId: string) => Promise<{ success: boolean; error?: string }>;
  rejectWithdrawal: (transactionId: string, rejectionReason?: string) => Promise<{ success: boolean; error?: string }>;
  closeStudentSavings: (studentIds: string[], reason: string) => Promise<{ success: boolean; pendingCount: number; closedCount: number; totalWithdrawn: number; errors: string[] }>;
  requestEditTransaction: (transactionId: string, newAmount: number, newReason: string) => Promise<{ success: boolean; error?: string }>;
  approveEditTransaction: (transactionId: string) => Promise<{ success: boolean; error?: string }>;
  rejectEditTransaction: (transactionId: string, rejectionReason?: string) => Promise<{ success: boolean; error?: string }>;

  toggleMonthlyDeduction: (enabled: boolean) => void;
  runMonthlyDeduction: (force?: boolean) => Promise<MonthlyDeductionSummary>;

  books: Book[];
  addBook: (book: Omit<Book, 'id'>) => void;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => void;

  bookDistributions: BookDistribution[];
  toggleBookDistribution: (bookId: string, studentId: string) => void;

  bookPayments: BookPayment[];
  addBookPayment: (bookId: string, studentId: string, paymentMethod: BookPaymentMethod) => Promise<{ success: boolean; error?: string }>;
  settleBookPaymentDebt: (bookPaymentId: string, method: 'Tunai' | 'Potong Tabungan') => Promise<{ success: boolean; error?: string }>;

  auditLogs: AuditLogItem[];
  addAuditLog: (action: string, valueBefore: string, valueAfter: string, details: string) => void;

  sppPayments: SppPayment[];
  addSppPayment: (studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan', period: string) => Promise<{ success: boolean; error?: string }>;

  exportBackupData: () => { success: boolean; data?: string; error?: string };
  restoreBackupData: (jsonString: string) => Promise<{ success: boolean; error?: string }>;
  lastSnapshotTime: string | null;
  restoreLastSnapshot: () => Promise<{ success: boolean; error?: string }>;

  syncErrors: SyncError[];
  clearSyncErrors: () => void;
  syncState: SyncState;

  authLoading: boolean;

  users: User[];
  addUser: (data: { username: string; name: string; role: UserRole; password: string; accessLevel?: 'TK' | 'MI'; assignedClass?: ClassGrade }) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (id: string, role: UserRole) => Promise<void>;
  updateUserAccessLevel: (id: string, accessLevel: 'TK' | 'MI' | undefined) => Promise<void>;
  updateUserAssignedClass: (id: string, assignedClass: ClassGrade | undefined) => Promise<void>;
  changeUserPassword: (id: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changeViewerPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetViewerPassword: (studentId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  provisionViewerAccount: (studentId: string) => Promise<{ success: boolean; username?: string; initialCode?: string; error?: string }>;
  provisionViewersBulk: (studentIds: string[]) => Promise<{ studentId: string; success: boolean; username?: string; initialCode?: string; error?: string }[]>;
  resetStaffPassword: (targetUserId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tabungan_sekolah_v4_data';

const SNAPSHOT_DEDUP_MS = 5 * 60 * 1000;

// Auto-logout setelah idle — standar aplikasi kasir/keuangan (5-15 menit).
// 15 menit dipilih karena admin/guru sering bolak-balik dari komputer di
// sekolah, bukan terus-menerus mengetik.
const IDLE_LOGOUT_MS = 15 * 60 * 1000;

const hasSupabase = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

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
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialAcademicYears);
  });

  const [currentAcademicYearId, setCurrentAcademicYearIdState] = useState<string>(() => {
    const current = academicYears.find((y) => y.isCurrent) || academicYears[0];
    return current ? current.id : 'ay-2';
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_students`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialStudents);
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_transactions`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialTransactions);
  });

  const [books, setBooks] = useState<Book[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_books`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialBooks);
  });

  const [bookDistributions, setBookDistributions] = useState<BookDistribution[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_distributions`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialBookDistributions);
  });

  const [bookPayments, setBookPayments] = useState<BookPayment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_book_payments`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialBookPayments);
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_audit_logs`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialAuditLogs);
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_users`);
    return saved ? JSON.parse(saved) : [];
  });

  const [sppPayments, setSppPayments] = useState<SppPayment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_spp_payments`);
    return saved ? JSON.parse(saved) : (hasSupabase ? [] : initialSppPayments);
  });

  const [dbLoaded, setDbLoaded] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Persist the latest state into localStorage as a safety net, while Supabase remains the cloud source of truth.
  useEffect(() => {
    if (!dbLoaded) return;
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
  }, [dbLoaded, schoolSettings, academicYears, students, transactions, books, bookDistributions, bookPayments, auditLogs, sppPayments, users]);

  const [lastSnapshotTime, setLastSnapshotTime] = useState<string | null>(null);
  const lastSnapshotTimeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    supabase
      .from('snapshots')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLastSnapshotTime(data.created_at);
          lastSnapshotTimeRef.current = data.created_at;
        }
      });
  }, [currentUser]);

  const buildBackupPayload = () => ({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: currentUser?.name,
    schoolSettings,
    academicYears,
    students,
    transactions,
    books,
    bookDistributions,
    bookPayments,
    sppPayments,
    auditLogs,
  });

  // Snapshots live in the `snapshots` table (007_restore_rpc.sql), not
  // localStorage — per-machine storage was useless as an actual rollback:
  // gone if that one browser's data was cleared, invisible to anyone else.
  const saveSnapshot = async (force = false) => {
    if (!force && lastSnapshotTimeRef.current && Date.now() - new Date(lastSnapshotTimeRef.current).getTime() < SNAPSHOT_DEDUP_MS) {
      return;
    }
    try {
      const { error } = await supabase
        .from('snapshots')
        .insert({ created_by: currentUser?.name, payload: buildBackupPayload() });
      if (error) return; // snapshot non-kritis — gagal tidak memblokir operasi
      const now = new Date().toISOString();
      setLastSnapshotTime(now);
      lastSnapshotTimeRef.current = now;
    } catch {
      // snapshot non-kritis — gagal tidak memblokir operasi
    }
  };

  const saveSnapshotRef = useRef(saveSnapshot);
  saveSnapshotRef.current = saveSnapshot;
  useEffect(() => {
    const id = setInterval(() => saveSnapshotRef.current(), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const fetchFromSupabase = useCallback(async () => {
    const [dbSchoolSettings, dbStudents, dbTransactions, dbBooks, dbDistributions, dbBookPayments, dbSppPayments, dbAcademicYears, dbAuditLogs, dbUsers] = await Promise.all([
      fetchAll<SchoolSettings>('school_settings'),
      fetchAll<Student>('students'),
      fetchAll<Transaction>('transactions'),
      fetchAll<Book>('books'),
      fetchAll<BookDistribution>('book_distributions'),
      fetchAll<BookPayment>('book_payments'),
      fetchAll<SppPayment>('spp_payments'),
      fetchAll<AcademicYear>('academic_years'),
      fetchAll<AuditLogItem>('audit_logs'),
      fetchAll<User>('profiles'),
    ]);
    // DB adalah sumber kebenaran. Result null = query gagal (jaga data lokal).
    // Result [] = tabel memang kosong (clear data lokal agar tidak stale).
    if (dbSchoolSettings !== null) {
      if (dbSchoolSettings.length > 0) {
        setSchoolSettings((prev) => mergeSchoolSettings(prev, dbSchoolSettings[0]));
      } else {
        upsertRow('school_settings', { id: 'singleton', ...schoolSettings });
      }
    }
    if (dbStudents !== null) setStudents(migrateClassGrades(dbStudents));
    if (dbTransactions !== null) setTransactions(migrateClassGrades(dbTransactions));
    if (dbBooks !== null) setBooks(migrateClassGrades(dbBooks));
    if (dbDistributions !== null) setBookDistributions(dbDistributions);
    if (dbBookPayments !== null) setBookPayments(migrateClassGrades(dbBookPayments));
    if (dbSppPayments !== null) setSppPayments(migrateClassGrades(dbSppPayments));
    if (dbAcademicYears !== null) {
      setAcademicYears(dbAcademicYears.length > 0 ? mergeById(dbAcademicYears, []) : dbAcademicYears);
      const dbCurrent = dbAcademicYears.find((y) => y.isCurrent) || dbAcademicYears[0];
      if (dbCurrent) setCurrentAcademicYearIdState(dbCurrent.id);
    }
    if (dbAuditLogs !== null) setAuditLogs(dbAuditLogs);
    if (dbUsers !== null) setUsers(dbUsers);
    setDbLoaded(true);
  }, [schoolSettings]);

  useEffect(() => {
    if (!currentUser) return;
    fetchFromSupabase();
    
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchFromSupabase();
      }, 500);
    };

    const POLLING_INTERVAL_MS = 60000;

    const channel = supabase
      .channel('tabungan-sekolah-transactions-only')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions'
      }, debouncedFetch)
      .subscribe();

    const poll = setInterval(fetchFromSupabase, POLLING_INTERVAL_MS);
    
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [currentUser, fetchFromSupabase]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setCurrentUser({
            id: profile.id,
            username: profile.username,
            name: profile.name,
            role: profile.role,
            studentId: profile.student_id || undefined,
            accessLevel: profile.access_level || undefined,
            demoMode: profile.demo_mode ?? false,
            mustChangePassword: profile.must_change_password ?? false,
          });

          // Role-based redirect after successful login
          if (_event === 'SIGNED_IN') {
            const role = profile.role;
            
            // Redirect based on user role
            if (role === 'Admin' || role === 'Super Admin' || role === 'Developer' || role === 'Wali Kelas' || role === 'Admin Koperasi') {
              // Staff roles → Dashboard Admin
              window.location.href = '/dashboard';
            } else if (role === 'Viewer') {
              // Viewer role → Dashboard Siswa
              window.location.href = '/dashboard-siswa';
            } else {
              // Fallback for unknown roles
              window.location.href = '/';
            }
          }
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  useEffect(() => {
    return onSyncError((err) => {
      setSyncErrors((prev) => [err, ...prev].slice(0, 5));
    });
  }, []);
  const clearSyncErrors = () => setSyncErrors([]);

  const [syncState, setSyncState] = useState<SyncState>({ pending: 0, lastSyncAt: null });
  useEffect(() => {
    return onSyncState((s) => setSyncState(s));
  }, []);

  const currentAcademicYear = academicYears.find((y) => y.id === currentAcademicYearId) || academicYears[0] || { id: 'fallback', year: 'Memuat...', isCurrent: true, createdAt: new Date().toISOString() };

  const login = async (username: string, password: string) => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailFor(username),
      password,
    });
    if (error) {
      setAuthLoading(false);
      return { success: false, error: 'Username atau kata sandi salah.' };
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    // Clear cached business data so the next person to use this browser
    // (logout on a shared kiosk, a different Viewer logging in next) doesn't
    // briefly see the previous session's cached students/transactions/users
    // while fetchFromSupabase re-runs.
    setStudents([]);
    setTransactions([]);
    setBooks([]);
    setBookDistributions([]);
    setBookPayments([]);
    setSppPayments([]);
    setAuditLogs([]);
    setUsers([]);
    [
      'students', 'transactions', 'books', 'distributions',
      'book_payments', 'audit_logs', 'spp_payments', 'users',
    ].forEach((key) => localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${key}`));
  };

  // Auto-logout setelah IDLE_LOGOUT_MS tanpa aktivitas (mouse/keyboard/scroll/
  // sentuhan) — berlaku untuk semua role yang sedang login (staff & Viewer).
  useEffect(() => {
    if (!currentUser) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
      }, IDLE_LOGOUT_MS);
    };
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const callAdminUsers = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
    return json;
  };

  const addUser = async (data: { username: string; name: string; role: UserRole; password: string; accessLevel?: 'TK' | 'MI'; assignedClass?: ClassGrade }) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Developer yang dapat menambah user.' };
    }
    if (users.some((u) => u.username.toLowerCase() === data.username.trim().toLowerCase())) {
      return { success: false, error: `Username "${data.username}" sudah dipakai.` };
    }
    try {
      await callAdminUsers('create', {
        username: data.username.trim(),
        name: data.name.trim(),
        role: data.role,
        password: data.password,
        access_level: data.accessLevel ?? null,
        assigned_class: data.assignedClass ?? null,
      });
      // Re-fetch users from profiles table (fetchAll converts snake_case -> camelCase)
      const rows = await fetchAll<User>('profiles');
      if (rows && rows.length > 0) setUsers(rows);
      addAuditLog('Tambah User', '-', `User: ${data.username.trim()} (${data.role})`, `Menambahkan user baru ${data.name.trim()} dengan role ${data.role}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal membuat user.' };
    }
  };

  const updateUserRole = async (id: string, role: UserRole) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') return;
    const target = users.find((u) => u.id === id);
    if (!target || target.role === role) return;
    try {
      await callAdminUsers('update-role', { user_id: id, role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      addAuditLog('Ubah Role User', `User: ${target.username} (${target.role})`, `User: ${target.username} (${role})`, `Mengubah role user ${target.name} menjadi ${role}`);
    } catch (err) {
      console.error('updateUserRole failed:', err);
    }
  };

  const updateUserAccessLevel = async (id: string, accessLevel: 'TK' | 'MI' | undefined) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') return;
    const target = users.find((u) => u.id === id);
    if (!target || target.accessLevel === accessLevel) return;
    try {
      await callAdminUsers('update-access-level', { user_id: id, access_level: accessLevel ?? null });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, accessLevel } : u)));
      addAuditLog('Ubah Akses Level User', `User: ${target.username} (${target.accessLevel || 'Semua'})`, `User: ${target.username} (${accessLevel || 'Semua'})`, `Mengubah akses level user ${target.name} ke ${accessLevel || 'Semua'}`);
    } catch (err) {
      console.error('updateUserAccessLevel failed:', err);
    }
  };

  // Kelas spesifik Guru Kelas (Wali Kelas) — mengunci input Kegiatan &
  // laporan tunggakan ke satu kelas itu saja (lihat auth_assigned_class di
  // migration 012), beda dari accessLevel yang cuma level TK/MI umum.
  const updateUserAssignedClass = async (id: string, assignedClass: ClassGrade | undefined) => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') return;
    const target = users.find((u) => u.id === id);
    if (!target || target.assignedClass === assignedClass) return;
    try {
      await callAdminUsers('update-assigned-class', { user_id: id, assigned_class: assignedClass ?? null });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, assignedClass } : u)));
      addAuditLog('Ubah Kelas Guru', `User: ${target.username} (${target.assignedClass || 'Belum diatur'})`, `User: ${target.username} (${assignedClass || 'Belum diatur'})`, `Mengubah kelas yang dipegang ${target.name} ke ${assignedClass || 'Belum diatur'}`);
    } catch (err) {
      console.error('updateUserAssignedClass failed:', err);
    }
  };

  const canAccessStudent = (student?: Student): boolean => {
    if (!currentUser?.accessLevel) return true;
    return !!student && isClassInUserLevel(student.classGrade, currentUser);
  };

  const changeUserPassword = async (id: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Developer yang dapat mengubah password user lain.' };
    }
    if (newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    try {
      await callAdminUsers('reset-password', { user_id: id, new_password: newPassword });
      const target = users.find((u) => u.id === id);
      if (target) addAuditLog('Ganti Password User', `User: ${target.username}`, `User: ${target.username}`, `Password user ${target.name} diubah oleh Developer.`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal mengubah password.' };
    }
  };

  const deleteUser = async (id: string) => {
    if (!currentUser || currentUser.demoMode || (currentUser.role !== 'Developer' && currentUser.role !== 'Super Admin')) return;
    if (id === currentUser.id) return;
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (target.role === 'Developer' && !target.demoMode && currentUser.role !== 'Developer') {
      addAuditLog('Hapus User Ditolak', `User: ${target.username}`, '-', `Super Admin tidak memiliki wewenang menghapus user Developer.`);
      return;
    }
    const developerCount = users.filter((u) => u.role === 'Developer' && !u.demoMode).length;
    if (target.role === 'Developer' && !target.demoMode && developerCount <= 1) {
      addAuditLog('Hapus User Ditolak', `User: ${target.username}`, '-', `Percobaan menghapus Developer terakhir ditolak.`);
      return;
    }
    try {
      await callAdminUsers('delete', { user_id: id });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      addAuditLog('Hapus User', `User: ${target.username} (${target.role})`, '-', `Menghapus user ${target.name} (${target.username}) dari sistem.`);
    } catch (err) {
      console.error('deleteUser failed:', err);
    }
  };

  const findLinkedViewerUser = (studentId: string): User | undefined =>
    users.find((u) => u.role === 'Viewer' && u.studentId === studentId);

  const deleteLinkedViewerUser = async (studentId: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    const linked = findLinkedViewerUser(studentId);
    if (!linked) return { success: true };
    try {
      await callAdminUsers('delete', { user_id: linked.id });
      setUsers((prev) => prev.filter((u) => u.id !== linked.id));
      addAuditLog('Hapus User Viewer', `User: ${linked.username}`, '-', `User viewer ${linked.username} dihapus (${reason}).`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus akun viewer.';
      console.error('deleteLinkedViewerUser failed:', err);
      return { success: false, error: message };
    }
  };

  const changeViewerPassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.role !== 'Viewer') {
      return { success: false, error: 'Hanya Viewer yang dapat mengubah password sendiri.' };
    }
    if (newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    if (currentUser.mustChangePassword) {
      await updateRow('profiles', currentUser.id, { mustChangePassword: false });
      setCurrentUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
    }
    addAuditLog('Ubah Password Viewer', currentUser.username, currentUser.username, `Viewer ${currentUser.name} mengubah password sendiri.`);
    return { success: true };
  };

  const resetViewerPassword = async (studentId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'Password baru minimal 4 karakter.' };
    }
    const target = users.find((u) => u.role === 'Viewer' && u.studentId === studentId);
    if (!target) {
      return { success: false, error: 'Akun viewer tidak ditemukan.' };
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/viewer-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ action: 'reset-password', target_user_id: target.id, new_password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      addAuditLog('Reset Password Viewer', 'User: ' + target.username, 'User: ' + target.username, 'Password viewer ' + target.username + ' direset melalui admin.');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal mereset password viewer.' };
    }
  };

  const provisionViewerAccount = async (
    studentId: string
  ): Promise<{ success: boolean; username?: string; initialCode?: string; error?: string }> => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }
    if (users.some((u) => u.role === 'Viewer' && u.studentId === studentId)) {
      return { success: false, error: 'Siswa ini sudah punya akun ortu.' };
    }
    try {
      const data = await callAdminUsers('provision-viewer', { student_id: studentId });
      setUsers((prev) => [
        ...prev,
        {
          id: data.userId,
          username: data.username,
          name: student.parentName || `${student.name} (Orang Tua)`,
          role: 'Viewer' as UserRole,
          studentId,
          mustChangePassword: true,
        },
      ]);
      addAuditLog('Buat Akun Ortu', student.name, data.username, `Akun viewer ${data.username} dibuat untuk ${student.name}.`);
      return { success: true, username: data.username, initialCode: data.initialCode };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal membuat akun ortu.' };
    }
  };

  const provisionViewersBulk = async (
    studentIds: string[]
  ): Promise<{ studentId: string; success: boolean; username?: string; initialCode?: string; error?: string }[]> => {
    const results: { studentId: string; success: boolean; username?: string; initialCode?: string; error?: string }[] = [];
    for (const id of studentIds) {
      const res = await provisionViewerAccount(id);
      results.push({ studentId: id, ...res });
    }
    return results;
  };

  const resetStaffPassword = async (targetUserId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
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
    try {
      await callAdminUsers('reset-password', { user_id: targetUserId, new_password: newPassword });
      addAuditLog('Reset Password User', 'User: ' + target.username, 'User: ' + target.username, 'Password ' + target.username + ' direset oleh ' + currentUser.name + '.');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Gagal mereset password.' };
    }
  };

  const addAuditLog = async (action: string, valueBefore: string, valueAfter: string, details: string) => {
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
    const res = await insertRow('audit_logs', newLog);
    if (!res.success) {
      return;
    }
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const updateSchoolSettings = async (settings: Partial<SchoolSettings>) => {
    if (!currentUser || currentUser.demoMode || ROLE_RANK[currentUser.role] < 3) return;
    // logoUrl is a data: URI (tens of KB) — exclude it from the audit trail so
    // every settings save doesn't duplicate the whole logo into audit_logs.
    const { logoUrl: _beforeLogo, ...beforeForLog } = schoolSettings;
    const nextSettings = { ...schoolSettings, ...settings };
    const { logoUrl: _afterLogo, ...afterForLog } = nextSettings;
    const res = await upsertRow('school_settings', { id: 'singleton', ...nextSettings });
    if (!res.success) {
      return;
    }
    setSchoolSettings(nextSettings);
    await addAuditLog('Update Pengaturan Sekolah', JSON.stringify(beforeForLog), JSON.stringify(afterForLog), 'Mengubah nama, alamat, atau logo sekolah');
  };

  const addAcademicYear = async (yearStr: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.demoMode || currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Developer yang dapat membuka tahun ajaran baru.' };
    }
    const newYearId = `ay-${Date.now()}`;
    const newYear: AcademicYear = {
      id: newYearId,
      year: yearStr,
      isCurrent: true,
      createdAt: new Date().toISOString(),
    };
    const previousCurrent = academicYears.filter((y) => y.isCurrent);

    const insertRes = await insertRow('academic_years', newYear);
    if (!insertRes.success) {
      return { success: false, error: insertRes.error || 'Gagal menyimpan tahun ajaran baru ke database.' };
    }
    const demoteResults = await Promise.all(
      previousCurrent.map((y) => updateRow('academic_years', y.id, { isCurrent: false }))
    );
    if (demoteResults.some((r) => !r.success)) {
      return { success: false, error: 'Tahun ajaran baru tersimpan, tapi gagal mengarsipkan tahun sebelumnya.' };
    }

    setAcademicYears([...academicYears.map((y) => ({ ...y, isCurrent: false })), newYear]);
    setCurrentAcademicYearIdState(newYearId);
    addAuditLog('Tambah Tahun Ajaran', `Aktif: ${currentAcademicYear.year}`, `Aktif: ${yearStr}`, `Membuka tahun ajaran baru ${yearStr} dan mengarsip data sebelumnya.`);
    return { success: true };
  };

  const setCurrentAcademicYearId = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const target = academicYears.find((y) => y.id === id);
    if (!target || target.isCurrent) return { success: true };

    const toUpdate = academicYears.filter((y) => y.isCurrent || y.id === id);
    const results = await Promise.all(
      toUpdate.map((y) => updateRow('academic_years', y.id, { isCurrent: y.id === id }))
    );
    if (results.some((r) => !r.success)) {
      return { success: false, error: 'Gagal mengubah tahun ajaran aktif di database.' };
    }

    setAcademicYears((prev) => prev.map((y) => ({ ...y, isCurrent: y.id === id })));
    setCurrentAcademicYearIdState(id);
    addAuditLog('Ganti Tahun Ajaran Aktif', `Aktif: ${currentAcademicYear.year}`, `Aktif: ${target.year}`, `Mengubah tahun ajaran aktif menjadi ${target.year}`);
    return { success: true };
  };

  const deleteAcademicYear = (id: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Developer yang dapat menghapus tahun ajaran.' };
    }
    const target = academicYears.find((y) => y.id === id);
    if (!target) return { success: false, error: 'Tahun ajaran tidak ditemukan.' };
    if (target.isCurrent) return { success: false, error: 'Tahun ajaran aktif tidak dapat dihapus.' };

    setAcademicYears((prev) => prev.filter((y) => y.id !== id));
    deleteRow('academic_years', id);
    addAuditLog('Hapus Tahun Ajaran', `Hapus: ${target.year}`, '-', `Tahun ajaran ${target.year} dihapus dari database. Data siswa & transaksi terkait tetap tersimpan.`);
    return { success: true };
  };

  const bulkPromoteStudents = (fromClass: string, toClass: string, excludeIds: string[] = []) => {
    if (!currentUser || currentUser.demoMode) return;
    const excludeSet = new Set(excludeIds);
    const affected = students.filter(
      (s) => !s.isDeleted && s.classGrade === fromClass && !excludeSet.has(s.id)
    );
    setStudents((prev) =>
      prev.map((s) => {
        if (!s.isDeleted && s.classGrade === fromClass && !excludeSet.has(s.id)) {
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
      if (toClass === 'Lulus') {
        deleteLinkedViewerUser(s.id, 'naik ke Lulus').then((res) => {
          if (!res.success) {
            addAuditLog('Hapus User Viewer Gagal', `Siswa: ${s.name}`, '-', `Gagal menghapus akun viewer untuk ${s.name} saat kelulusan: ${res.error || 'unknown error'}.`);
          }
        });
      }
    });
    const skippedCount = excludeSet.size;
    addAuditLog(
      'Pindah Kelas Massal',
      `Kelas asal: ${fromClass}`,
      `Kelas tujuan: ${toClass}`,
      `Memindahkan ${affected.length} siswa dari kelas ${fromClass} ke ${toClass}` +
        (skippedCount > 0 ? ` (${skippedCount} siswa tetap tinggal di ${fromClass})` : '')
    );
  };

  const runYearEndClosure = async (
    decisions: YearEndDecision[],
    targetAcademicYearId: string
  ): Promise<{ success: boolean; moved: number; repeated: number; skipped: number; totalWithdrawn: number; errors: string[] }> => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, moved: 0, repeated: 0, skipped: 0, totalWithdrawn: 0, errors: ['Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.'] };
    }
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer' && currentUser.role !== 'Admin' && currentUser.role !== 'Wali Kelas') {
      return { success: false, moved: 0, repeated: 0, skipped: 0, totalWithdrawn: 0, errors: ['Anda tidak memiliki hak untuk menjalankan penutupan tahun.'] };
    }
    const targetYear = academicYears.find((y) => y.id === targetAcademicYearId);
    if (!targetYear) {
      return { success: false, moved: 0, repeated: 0, skipped: 0, totalWithdrawn: 0, errors: ['Tahun ajaran tujuan tidak ditemukan.'] };
    }

    const errors: string[] = [];
    let moved = 0;
    let repeated = 0;
    let skipped = 0;
    let totalWithdrawn = 0;

    decisions.forEach((d) => {
      const student = students.find((s) => s.id === d.studentId && !s.isDeleted);
      if (!student) {
        errors.push(`Siswa tidak ditemukan (ID: ${d.studentId}).`);
        return;
      }
      if (student.status !== 'Aktif' || student.academicYearId === targetAcademicYearId) {
        skipped++;
        return;
      }

      let newClass: ClassGrade;
      if (d.action === 'naik') {
        const next = nextClassFrom(student.classGrade);
        if (!next) {
          errors.push(`${student.name}: kelas ${student.classGrade} adalah kelas lulus, gunakan Tutup Tabungan.`);
          return;
        }
        newClass = next;
      } else {
        newClass = student.classGrade;
      }

      // Payout saldo PENUH ke wali; tunggakan pendingDebt TIDAK disentuh (tetap menempel, mekanisme penyelesaian dibahas terpisah).
      const cashToParent = student.balance;

      if (cashToParent > 0) {
        const newTx: Transaction = {
          id: `tr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          transactionNumber: generateTransactionNumber('PT', targetYear.year, transactions.length + decisions.length),
          studentId: student.id,
          studentName: student.name,
          studentNis: student.nis,
          classGrade: student.classGrade,
          type: 'Penarikan',
          amount: cashToParent,
          status: 'Disetujui',
          reason: `Penarikan Tabungan Akhir Tahun ${targetYear.year}`,
          approvedByAdmin: true,
          approvedByAdminName: currentUser.name,
          approvedBySuperAdmin: true,
          approvedBySuperAdminName: currentUser.name,
          createdById: currentUser.id,
          createdByName: currentUser.name,
          createdByRole: currentUser.role,
          academicYearId: targetAcademicYearId,
          createdAt: new Date().toISOString(),
        };
        setTransactions((prev) => [newTx, ...prev]);
        insertRow('transactions', newTx);
        totalWithdrawn += cashToParent;
      }

      setStudents((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, balance: 0, classGrade: newClass, academicYearId: targetAcademicYearId }
            : s
        )
      );
      updateRow('students', student.id, {
        balance: 0,
        class_grade: newClass,
        academic_year_id: targetAcademicYearId,
      });

      if (d.action === 'naik') moved++;
      else repeated++;
    });

    addAuditLog(
      'Penutupan Tahun Ajaran',
      `Tahun: ${currentAcademicYear.year}`,
      `Tahun: ${targetYear.year}`,
      `${moved} siswa naik, ${repeated} tinggal kelas, ${skipped} dilewati, ${errors.length} error. Penarikan akhir tahun total Rp ${totalWithdrawn.toLocaleString('id-ID')}.`
    );

    return { success: errors.length === 0, moved, repeated, skipped, totalWithdrawn, errors };
  };

  const addStudent = async (studentData: Omit<Student, 'id' | 'createdAt' | 'balance'> & { initialBalance?: number }) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser?.accessLevel && !isClassInUserLevel(studentData.classGrade, currentUser)) {
      return { success: false, error: 'Akses ditolak: kelas siswa berada di luar level Anda.' };
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

    const studentRes = await insertRow('students', newStudent);
    if (!studentRes.success) {
      return { success: false, error: `Gagal menyimpan siswa ke database: ${studentRes.error}` };
    }
    setStudents((prev) => [newStudent, ...prev]);
    saveSnapshot();

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
      const txRes = await insertRow('transactions', initialTx);
      if (!txRes.success) {
        // setoran awal gagal dicatat tapi siswa tersimpan — sukses, error via sync banner
        addAuditLog('Tambah Siswa Baru', '-', `Siswa: ${newStudent.name} (NIS: ${newStudent.nis})`, `Menambahkan siswa baru kelas ${newStudent.classGrade} dengan saldo awal Rp ${initialBal}`);
        return { success: true };
      }
      setTransactions((prev) => [initialTx, ...prev]);
    }

    addAuditLog('Tambah Siswa Baru', '-', `Siswa: ${newStudent.name} (NIS: ${newStudent.nis})`, `Menambahkan siswa baru kelas ${newStudent.classGrade} dengan saldo awal Rp ${initialBal}`);
    return { success: true };
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    if (!currentUser || currentUser.demoMode) return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    const student = students.find((s) => s.id === id);
    if (!student) return { success: false, error: 'Siswa tidak ditemukan.' };
    if (!canAccessStudent(student)) return { success: false, error: 'Akses ditolak: siswa berada di luar level Anda.' };
    if (data.classGrade && currentUser?.accessLevel && !isClassInUserLevel(data.classGrade, currentUser)) {
      return { success: false, error: 'Akses ditolak: kelas tujuan berada di luar level Anda.' };
    }

    const res = await updateRow('students', id, data);
    if (!res.success) {
      return { success: false, error: `Gagal menyimpan perubahan siswa ke database: ${res.error}` };
    }
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    addAuditLog('Edit Data Siswa', JSON.stringify(student), JSON.stringify({ ...student, ...data }), `Mengubah data siswa ${student.name} (NIS: ${student.nis})`);
    return { success: true };
  };

  const softDeleteStudent = async (id: string) => {
    if (!currentUser || currentUser.demoMode) return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    const student = students.find((s) => s.id === id);
    if (!student) return { success: false, error: 'Siswa tidak ditemukan.' };
    if (!canAccessStudent(student)) return { success: false, error: 'Akses ditolak: siswa berada di luar level Anda.' };

    const res = await updateRow('students', id, { isDeleted: true });
    if (!res.success) {
      return { success: false, error: `Gagal menghapus siswa di database: ${res.error}` };
    }
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, isDeleted: true } : s)));
    const linked = findLinkedViewerUser(id);
    if (linked) {
      setUsers((prev) => prev.filter((u) => u.id !== linked.id));
      await deleteRow('users', linked.id);
    }
    addAuditLog('Hapus Siswa (Soft Delete)', `Status: ${student.status}`, 'Status: Soft Deleted', `Menghapus siswa ${student.name} (NIS: ${student.nis}). Data histori tetap aman.`);
    return { success: true };
  };

  const importStudentsBulk = async (newStudentsList: Partial<Student>[]) => {
    if (!currentUser || currentUser.demoMode) {
      return { addedCount: 0, errors: ['Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.'] };
    }
    let addedCount = 0;
    const errors: string[] = [];
    const addedArray: Student[] = [];
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
      const studentResults = await Promise.all(addedArray.map((s) => insertRow('students', s)));
      const failedStudentIds = new Set(
        addedArray.filter((_, i) => !studentResults[i]?.success).map((s) => s.id)
      );
      const txResults = addedTransactions.length > 0 ? await Promise.all(addedTransactions.map((t) => insertRow('transactions', t))) : [];
      const failedTxIds = new Set(
        addedTransactions.filter((_, i) => !txResults[i]?.success).map((t) => t.id)
      );

      const keptStudents = addedArray.filter((s) => !failedStudentIds.has(s.id));
      addedCount = keptStudents.length;

      if (failedStudentIds.size > 0 || failedTxIds.size > 0) {
        errors.push(
          `${failedStudentIds.size} siswa, ${failedTxIds.size} transaksi awal gagal tersimpan ke database dan tidak dimasukkan.`
        );
      }

      setStudents((prev) => [...keptStudents, ...prev.filter((s) => !failedStudentIds.has(s.id))]);
      if (addedTransactions.length > 0) {
        setTransactions((prev) => [...addedTransactions.filter((t) => !failedTxIds.has(t.id)), ...prev]);
      }
      if (keptStudents.length > 0) {
        saveSnapshot();
        addAuditLog('Import Massal Siswa Excel', '-', `Total diimport: ${keptStudents.length}`, `Berhasil mengimport ${keptStudents.length} data siswa dari Excel.`);
      }
    }

    return { addedCount, errors };
  };

  const addDeposit = async (studentId: string, amount: number, reason: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId && !s.isDeleted);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }
    if (!canAccessStudent(student)) {
      return { success: false, error: 'Akses ditolak: siswa berada di luar level Anda.' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Nominal setoran harus lebih besar dari 0.' };
    }
    if (amount > 99999000) {
      return { success: false, error: 'Nominal melebihi batas maksimal transaksi (Rp 99.999.000).' };
    }

    // Balance + nomor transaksi digenerate atomik di DB (RPC deposit_savings,
    // 009_deposit_savings_atomic.sql) — row lock di sisi Postgres mencegah
    // lost-update kalau 2 staf setor ke siswa yang sama nyaris bersamaan, dan
    // sequence DB mencegah dua transaksi dapat nomor yang sama.
    const txId = `tr-${Date.now()}`;
    const debtTxId = `tr-auto-debt-${Date.now()}`;
    const { data, error } = await supabase.rpc('deposit_savings', {
      p_transaction_id: txId,
      p_student_id: studentId,
      p_amount: amount,
      p_reason: reason,
      p_academic_year_id: currentAcademicYear.id,
      p_academic_year_label: currentAcademicYear.year,
      p_created_by_id: currentUser.id,
      p_created_by_name: currentUser.name,
      p_created_by_role: currentUser.role,
      p_debt_transaction_id: debtTxId,
    });

    if (error) {
      return { success: false, error: `Gagal menyimpan setoran ke database: ${error.message}` };
    }

    const balanceBefore: number = data.balanceBefore;
    const balanceAfter: number = data.balanceAfter;
    const trNum: string = data.transactionNumber;

    const newTx: Transaction = {
      id: txId,
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

    const deductionTransactions: Transaction[] = [];
    if (data.debtTransaction) {
      const dt = data.debtTransaction;
      const debtTx: Transaction = {
        id: dt.id,
        transactionNumber: dt.transactionNumber,
        studentId,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        type: 'Potongan Bulanan',
        amount: dt.amount,
        status: 'Disetujui',
        reason: dt.reason,
        createdById: currentUser.id,
        createdByName: `${currentUser.name} (Sistem Otomatis)`,
        createdByRole: currentUser.role,
        academicYearId: currentAcademicYear.id,
        createdAt: new Date().toISOString(),
      };
      deductionTransactions.push(debtTx);
    }

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        if (data.debtTransaction) {
          const updated = { ...s, balance: balanceAfter };
          if (data.debtTransaction.remainingDebt > 0) {
            updated.pendingDebt = data.debtTransaction.remainingDebt;
          } else {
            delete updated.pendingDebt;
          }
          return updated;
        }
        return { ...s, balance: balanceAfter };
      })
    );
    setTransactions((prev) => [newTx, ...deductionTransactions, ...prev]);
    saveSnapshot();

    const existingDebt = student.pendingDebt || 0;
    const autoDeductedAmount = deductionTransactions.reduce((sum, t) => sum + t.amount, 0);
    addAuditLog(
      'Setoran Tabungan',
      `Saldo ${student.name}: Rp ${balanceBefore.toLocaleString('id-ID')}`,
      `Saldo ${student.name}: Rp ${balanceAfter.toLocaleString('id-ID')}${existingDebt > 0 ? ' (Ada potongan tunggakan)' : ''}`,
      `Setoran Rp ${amount.toLocaleString('id-ID')} (${trNum}) oleh ${currentUser.name}${autoDeductedAmount > 0 ? `. Tunggakan otomatis dipotong Rp ${autoDeductedAmount.toLocaleString('id-ID')}` : ''}`
    );

    return { success: true, transaction: newTx, autoDeducted: deductionTransactions.length > 0, deductionTransactions };
  };

  const requestWithdrawal = async (studentId: string, amount: number, reason: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId && !s.isDeleted);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }
    if (!canAccessStudent(student)) {
      return { success: false, error: 'Akses ditolak: siswa berada di luar level Anda.' };
    }
    if (amount <= 0) {
      return { success: false, error: 'Nominal potongan harus lebih besar dari 0.' };
    }
    // Saldo dicek + (kalau langsung "Disetujui" karena role Super Admin/Dev)
    // dipotong, atomik di DB (RPC request_withdrawal_atomic, migration 011)
    // — row lock siswa mencegah lost-update kalau 2 pengajuan nyaris
    // bersamaan buat siswa yang sama (pola sama dengan deposit_savings &
    // approve_withdrawal_final). Krusial di sini karena state lokal cuma
    // di-refresh tiap poll 20 detik, bukan cuma race antar-klik.
    const txId = `tr-${Date.now()}`;
    const { data, error: rpcError } = await supabase.rpc('request_withdrawal_atomic', {
      p_transaction_id: txId,
      p_student_id: studentId,
      p_amount: amount,
      p_reason: reason,
      p_academic_year_id: currentAcademicYear.id,
      p_academic_year_label: currentAcademicYear.year,
      p_created_by_id: currentUser.id,
      p_created_by_name: currentUser.name,
      p_created_by_role: currentUser.role,
    });
    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    const newTx: Transaction = {
      id: data.id,
      transactionNumber: data.transactionNumber,
      studentId,
      studentName: student.name,
      studentNis: student.nis,
      classGrade: student.classGrade,
      type: 'Penarikan',
      amount,
      status: data.status,
      reason,
      approvedByAdmin: data.approvedByAdmin,
      approvedByAdminName: data.approvedByAdminName,
      approvedBySuperAdmin: data.approvedBySuperAdmin,
      approvedBySuperAdminName: data.approvedBySuperAdminName,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
      academicYearId: currentAcademicYear.id,
      createdAt: data.createdAt,
    };

    if (data.status === 'Disetujui') {
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: data.balanceAfter } : s)));
    }
    setTransactions((prev) => [newTx, ...prev]);

    addAuditLog(
      'Pengajuan Penarikan',
      `Saldo ${student.name}: Rp ${data.balanceBefore.toLocaleString('id-ID')}`,
      `Status: ${data.status}`,
      `Pengajuan penarikan Rp ${amount.toLocaleString('id-ID')} untuk ${student.name} (${data.transactionNumber}). Status: ${data.status}`
    );

    return { success: true, transaction: newTx };
  };

  const approveWithdrawal = async (transactionId: string) => {
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

      const txRes = await updateRow('transactions', transactionId, {
        status: 'Menunggu Approval Super Admin',
        approvedByAdmin: true,
        approvedByAdminName: currentUser.name,
      });
      if (!txRes.success) {
        return { success: false, error: `Gagal menyimpan persetujuan ke database: ${txRes.error}` };
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

      const tier1Bp = bookPayments.find((bp) => bp.savingsTransactionId === transactionId);
      if (tier1Bp) {
        const bpRes = await updateRow('book_payments', tier1Bp.id, {
          status: 'Menunggu Approval Super Admin',
          approvedByAdmin: true,
          approvedByAdminName: currentUser.name,
        });
        if (bpRes.success) {
          setBookPayments((prev) =>
            prev.map((bp) =>
              bp.savingsTransactionId === transactionId
                ? { ...bp, status: 'Menunggu Approval Super Admin', approvedByAdmin: true, approvedByAdminName: currentUser.name }
                : bp
            )
          );
        }
      }

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
        let finalAmount: number;
        try {
          finalAmount = await executeCloseAccount(student);
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Gagal menutup tabungan.' };
        }

        const txRes = await updateRow('transactions', transactionId, {
          amount: finalAmount,
          status: 'Disetujui',
          approvedByAdmin: true,
          approvedBySuperAdmin: true,
          approvedBySuperAdminName: currentUser.name,
          approvedById: currentUser.id,
          approvedByName: currentUser.name,
          approvedByRole: currentUser.role,
        });
        if (!txRes.success) {
          return { success: false, error: `Akun ditutup, tapi status transaksi gagal diperbarui: ${txRes.error}` };
        }

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

        addAuditLog(
          'Approval Tutup Tabungan (Final)',
          `Saldo ${student.name}: Rp ${finalAmount.toLocaleString('id-ID')}`,
          'Saldo: 0 — data siswa dihapus',
          `Persetujuan final tutup tabungan ${student.name} (NIS: ${student.nis}). Seluruh saldo Rp ${finalAmount.toLocaleString('id-ID')} ditarik, data siswa dihapus permanen.`
        );
        saveSnapshot();

        return { success: true };
      }

      // Saldo dipotong + status disetujui atomik di DB (RPC approve_withdrawal_final,
      // 010_withdrawal_final_approval_atomic.sql) — row lock siswa+transaksi
      // mencegah lost-update kalau 2 Super Admin approve penarikan siswa yang
      // sama nyaris bersamaan (pola sama dengan deposit_savings untuk Setoran).
      const { data, error: rpcError } = await supabase.rpc('approve_withdrawal_final', {
        p_transaction_id: transactionId,
        p_approved_by_id: currentUser.id,
        p_approved_by_name: currentUser.name,
        p_approved_by_role: currentUser.role,
      });
      if (rpcError) {
        return { success: false, error: rpcError.message };
      }

      const balanceBefore: number = data.balanceBefore;
      const balanceAfter: number = data.balanceAfter;

      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: balanceAfter } : s)));
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

      // book_payments terkait (kalau ada) sudah ikut diupdate atomik di RPC
      // yang sama — di sini cukup sinkronkan state lokal, gak perlu DB call lagi.
      const tier2Bp = bookPayments.find((bp) => bp.savingsTransactionId === transactionId);
      if (tier2Bp) {
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
      }

      addAuditLog(
        'Approval Penarikan Final (Super Admin)',
        `Saldo ${student.name}: Rp ${balanceBefore.toLocaleString('id-ID')}`,
        `Saldo ${student.name}: Rp ${balanceAfter.toLocaleString('id-ID')}`,
        `Persetujuan final disetujui oleh Kepala Sekolah (${currentUser.name}). Saldo Rp ${tx.amount.toLocaleString('id-ID')} (${tx.transactionNumber}) resmi dipotong.`
      );
      saveSnapshot();

      return { success: true };
    }

    return { success: false, error: 'Akses ditolak. Anda tidak memiliki wewenang untuk menyetujui transaksi.' };
  };

  const rejectWithdrawal = async (transactionId: string, rejectionReason?: string) => {
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

    const reason = rejectionReason || 'Ditolak';
    const txRes = await updateRow('transactions', transactionId, { status: 'Ditolak', rejectionReason: reason });
    if (!txRes.success) {
      return { success: false, error: `Gagal menyimpan penolakan ke database: ${txRes.error}` };
    }

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              status: 'Ditolak',
              rejectionReason: reason,
              approvedById: currentUser.id,
              approvedByName: currentUser.name,
              approvedByRole: currentUser.role,
            }
          : t
      )
    );

    // Bagian yang harusnya dipotong dari tabungan gak pernah beneran
    // ke-deduct kalau ditolak (baru dipotong pas approve_withdrawal_final) —
    // jadi kembalikan tanggungan ke penuh, bukan cuma tandai 'Ditolak' tanpa
    // membalik amountPaid/outstandingAmount (kalau gak, sistem nganggep udah
    // sebagian lunas padahal saldonya gak pernah tersentuh).
    const rejectBp = bookPayments.find((bp) => bp.savingsTransactionId === transactionId);
    if (rejectBp) {
      const bpRes = await updateRow('book_payments', rejectBp.id, {
        status: 'Ditolak',
        rejectionReason: reason,
        amountPaid: 0,
        outstandingAmount: rejectBp.amount,
      });
      if (bpRes.success) {
        setBookPayments((prev) =>
          prev.map((bp) =>
            bp.savingsTransactionId === transactionId
              ? { ...bp, status: 'Ditolak', rejectionReason: reason, amountPaid: 0, outstandingAmount: bp.amount }
              : bp
          )
        );
      }
    }

    addAuditLog(
      'Approval Penarikan Ditolak',
      `Status: ${tx.status}`,
      'Status: Ditolak',
      `Pengajuan ${tx.transactionNumber} ditolak oleh ${currentUser.name} (${currentUser.role}). Alasan: ${reason}`
    );

    return { success: true };
  };

  const requestEditTransaction = async (transactionId: string, newAmount: number, newReason: string) => {
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

    const res = await updateRow('transactions', transactionId, { has_pending_edit: true, edit_request: editRequest });
    if (!res.success) {
      return { success: false, error: `Gagal mengajukan perbaikan ke database: ${res.error}` };
    }
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, hasPendingEdit: true, editRequest } : t))
    );

    addAuditLog(
      'Perbaikan Transaksi Diajukan',
      `${tx.transactionNumber}: Rp ${tx.amount.toLocaleString('id-ID')} / Ket: ${tx.reason}`,
      `${tx.transactionNumber}: Rp ${newAmount.toLocaleString('id-ID')} / Ket: ${newReason.trim()}`,
      `Permintaan perbaikan ${tx.type} ${tx.studentName} (${tx.transactionNumber}) diajukan oleh ${currentUser.name}. Menunggu persetujuan Super Admin.`
    );

    return { success: true };
  };

  const approveEditTransaction = async (transactionId: string) => {
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

    // Saldo baru dihitung, update balance dulu lalu transaksi — rollback jika gagal
    const balRes = await updateRow('students', student.id, { balance: newBalance });
    if (!balRes.success) {
      return { success: false, error: `Saldo gagal diperbarui: ${balRes.error}` };
    }
    const txRes = await updateRow('transactions', transactionId, {
      amount: newAmount,
      reason: newReason,
      has_pending_edit: false,
      edit_request: null,
    });
    if (!txRes.success) {
      await updateRow('students', student.id, { balance: student.balance });
      return { success: false, error: `Transaksi gagal diperbarui (${txRes.error}). Saldo dikembalikan.` };
    }

    setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: newBalance } : s)));

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

    addAuditLog(
      'Perbaikan Transaksi Disetujui',
      `${tx.transactionNumber}: Rp ${oldAmount.toLocaleString('id-ID')} / Ket: ${tx.editRequest.oldReason}`,
      `${tx.transactionNumber}: Rp ${newAmount.toLocaleString('id-ID')} / Ket: ${newReason}`,
      `Perbaikan ${tx.type} ${tx.studentName} (${tx.transactionNumber}) disetujui oleh ${currentUser.name}. Saldo ${student.name} diperbarui menjadi Rp ${newBalance.toLocaleString('id-ID')}.`
    );

    return { success: true };
  };

  const rejectEditTransaction = async (transactionId: string, rejectionReason?: string) => {
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

    const res = await updateRow('transactions', transactionId, { has_pending_edit: false, edit_request: null });
    if (!res.success) {
      return { success: false, error: `Gagal menyimpan penolakan ke database: ${res.error}` };
    }
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, hasPendingEdit: false, editRequest: undefined } : t))
    );

    addAuditLog(
      'Perbaikan Transaksi Ditolak',
      `${tx.transactionNumber}: Rp ${tx.editRequest.oldAmount.toLocaleString('id-ID')} → Rp ${tx.editRequest.newAmount.toLocaleString('id-ID')}`,
      `${tx.transactionNumber}: tetap Rp ${tx.amount.toLocaleString('id-ID')}`,
      `Permintaan perbaikan ${tx.transactionNumber} ditolak oleh ${currentUser.name}. Alasan: ${rejectionReason || 'Tidak ada alasan'}. Data asli dipertahankan.`
    );

    return { success: true };
  };

  const executeCloseAccount = async (student: Student) => {
    const finalAmount = student.balance;
    // Hapus akun ortu (auth.users) DULU dan WAJIB sukses sebelum lanjut hapus
    // apapun. Kalau ini dilewati diam-diam dan gagal, profiles ikut cascade-
    // delete bersama students, tapi auth.users tidak — akun ortu jadi orphan,
    // tetap bisa login (JWT valid) walau siswanya sudah tidak ada. Melempar di
    // sini aman: belum ada state/DB lain yang disentuh.
    const viewerDeleteRes = await deleteLinkedViewerUser(student.id, 'tutup tabungan');
    if (!viewerDeleteRes.success) {
      throw new Error(
        `Gagal menutup tabungan ${student.name}: akun ortu gagal dihapus (${viewerDeleteRes.error || 'unknown error'}). Data siswa TIDAK dihapus — coba lagi.`
      );
    }
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
    setBookDistributions((prev) => prev.filter((d) => d.studentId !== student.id));
    setBookPayments((prev) => prev.filter((p) => p.studentId !== student.id));
    setSppPayments((prev) => prev.filter((p) => p.studentId !== student.id));

    await Promise.all([
      deleteRow('students', student.id),
      deleteRowsBy('book_distributions', 'student_id', student.id),
      deleteRowsBy('book_payments', 'student_id', student.id),
      deleteRowsBy('spp_payments', 'student_id', student.id),
    ]);

    addAuditLog(
      'Tutup Tabungan',
      `Saldo ${student.name}: Rp ${finalAmount.toLocaleString('id-ID')}`,
      'Saldo: 0 (ditarik penuh) — data siswa dihapus',
      `Tabungan ${student.name} (NIS: ${student.nis}, ${student.classGrade}) ditutup. Seluruh saldo Rp ${finalAmount.toLocaleString('id-ID')} ditarik dan data siswa dihapus permanen dari database.`
    );

    return finalAmount;
  };

  const requestCloseSavings = async (studentIds: string[], reason: string) => {
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
      const results = await Promise.all(pendingTxs.map((tx) => insertRow('transactions', tx)));
      const failedCount = results.filter((r) => !r.success).length;
      if (failedCount > 0) {
        errors.push(`${failedCount} pengajuan tutup tabungan gagal tersimpan ke database.`);
      } else {
        setTransactions((prev) => [...pendingTxs, ...prev]);
      }
    }

    let totalWithdrawn = 0;
    const closedTxs: Transaction[] = [];
    for (const { student, tx } of immediateCloses) {
      const finalTx = { ...tx, amount: student.balance };
      const txRes = await insertRow('transactions', finalTx);
      if (!txRes.success) {
        errors.push(`Transaksi tutup ${student.name} gagal tersimpan — siswa tidak ditutup.`);
        continue;
      }
      // Transaksi tercatat dulu, baru data siswa dihapus
      try {
        const finalAmount = await executeCloseAccount(student);
        totalWithdrawn += finalAmount;
        closedTxs.push(finalTx);
      } catch (err) {
        // executeCloseAccount gagal (akun ortu gagal dihapus) sebelum menyentuh
        // apapun lagi — tapi transaksi "tutup" di atas sudah tercatat sebagai
        // Disetujui. Rollback biar gak ada transaksi tutup tabungan yang
        // "sukses" sementara siswanya sendiri masih utuh.
        await deleteRow('transactions', finalTx.id);
        errors.push(err instanceof Error ? err.message : `Gagal menutup tabungan ${student.name}.`);
      }
    }
    if (closedTxs.length > 0) {
      setTransactions((prev) => [...closedTxs, ...prev]);
    }
    if (closedTxs.length > 0 || pendingTxs.length > 0) {
      saveSnapshot();
    }

    addAuditLog(
      'Pengajuan Tutup Tabungan',
      `${studentIds.length} siswa diajukan`,
      pendingTxs.length > 0 ? `${pendingTxs.length} menunggu approval Super Admin` : 'Semua langsung disetujui',
      `Pengajuan tutup tabungan untuk ${studentIds.length} siswa. Alasan: ${reason}. ${pendingTxs.length > 0 ? `${pendingTxs.length} menunggu persetujuan Kepala Sekolah.` : ''}${immediateCloses.length > 0 ? ` ${immediateCloses.length} langsung ditutup, total ditarik Rp ${totalWithdrawn.toLocaleString('id-ID')}.` : ''}${errors.length > 0 ? ` Error: ${errors.join('; ')}` : ''}`
    );

    return { success: true, pendingCount: pendingTxs.length, closedCount: closedTxs.length, totalWithdrawn, errors };
  };

  const toggleMonthlyDeduction = (enabled: boolean) => {
    if (!currentUser || currentUser.demoMode || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer')) return;
    updateSchoolSettings({ monthlyDeductionEnabled: enabled });
  };

  const runMonthlyDeduction = async (force = false): Promise<MonthlyDeductionSummary> => {
    if (!currentUser || currentUser.demoMode) {
      return { runDate: new Date().toISOString(), totalStudentsDeducted: 0, totalAmountDeducted: 0, deductedStudents: [], skippedStudents: [], pendingDebtStudents: [] };
    }
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer') {
      return { runDate: new Date().toISOString(), totalStudentsDeducted: 0, totalAmountDeducted: 0, deductedStudents: [], skippedStudents: [], pendingDebtStudents: [] };
    }
    // Fitur ini TIDAK berjalan otomatis (tidak ada cron/scheduler) — hanya
    // eksekusi manual lewat tombol "Jalankan Sekarang". Toggle ON/OFF harus
    // benar-benar mencegah eksekusi, bukan sekadar dekorasi UI — tanpa cek ini
    // toggle OFF tetap bisa dijalankan penuh kalau tombolnya diklik.
    if (!schoolSettings.monthlyDeductionEnabled) {
      return {
        runDate: new Date().toISOString(),
        totalStudentsDeducted: 0,
        totalAmountDeducted: 0,
        deductedStudents: [],
        skippedStudents: [],
        pendingDebtStudents: [],
        blocked: true,
        blockedCode: 'disabled',
        blockedReason: 'Potongan bulanan sedang NON-AKTIF. Aktifkan toggle-nya dulu sebelum menjalankan.',
      };
    }
    // Guard anti-double-run: tanpa ini, klik "Jalankan Sekarang" 2x di bulan yang
    // sama akan memotong saldo SEMUA siswa aktif dua kali. Soft guard (client-side,
    // dilewati kalau force=true) — cukup untuk mencegah klik ganda yang tidak
    // disengaja, bukan proteksi keamanan.
    const lastRun = schoolSettings.lastMonthlyDeductionRun ? new Date(schoolSettings.lastMonthlyDeductionRun) : null;
    const now = new Date();
    const alreadyRanThisMonth = !!lastRun && lastRun.getFullYear() === now.getFullYear() && lastRun.getMonth() === now.getMonth();
    if (alreadyRanThisMonth && !force) {
      return {
        runDate: now.toISOString(),
        totalStudentsDeducted: 0,
        totalAmountDeducted: 0,
        deductedStudents: [],
        skippedStudents: [],
        pendingDebtStudents: [],
        blocked: true,
        blockedCode: 'already_ran',
        blockedReason: `Potongan bulanan sudah pernah dijalankan bulan ini (${formatDate(lastRun!.toISOString())}).`,
      };
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
      const updateResults = await Promise.all(
        Object.entries(updatedStudentsMap).map(([sid, bal]) =>
          updateRow('students', sid, { balance: bal, pendingDebt: updatedDebtMap[sid] || 0 })
        )
      );
      const txResults = newTransactions.length > 0
        ? await Promise.all(newTransactions.map((t) => insertRow('transactions', t)))
        : [];
      const failedUpdates = updateResults.filter((r) => !r.success).length;
      const failedTxs = txResults.filter((r) => !r.success).length;
      // Jika ada yang gagal: state tidak di-update, error muncul via sync banner
      if (failedUpdates === 0 && failedTxs === 0) {
        saveSnapshot();
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
        setTransactions((prev) => [...newTransactions, ...prev]);
      }
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

  // Koperasi & Kegiatan sekarang diproses atomik lewat satu RPC
  // (process_book_payment_atomic, migration 012) — server yang tentukan
  // available/outstanding, generate nomor transaksi, insert transaksi
  // Penarikan (kalau Potong Tabungan), potong saldo, dan insert book_payment,
  // semua di satu row-locked transaction DB. Ini gantiin logic lama yang
  // baca item/siswa dari state lokal (bisa stale, apalagi polling cuma tiap
  // 20 detik) lalu nulis manual — rawan race condition + gak bisa nyicil
  // (dulu Potong Tabungan cuma all-or-nothing, saldo kurang = ditolak total).
  // Potong Tabungan yang saldonya gak cukup sekarang motong sebisanya
  // (gak pernah sampai minus), sisanya jadi tanggungan (outstandingAmount)
  // yang melekat ke siswa sampai dilunasi — lihat settleBookPaymentDebt.
  const addBookPayment = async (bookId: string, studentId: string, paymentMethod: BookPaymentMethod) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const item = books.find((b) => b.id === bookId);
    const student = students.find((s) => s.id === studentId && !s.isDeleted);

    if (!item || !student) {
      return { success: false, error: 'Data item (Koperasi/Kegiatan) atau siswa tidak ditemukan.' };
    }
    if (!canAccessStudent(student)) {
      return { success: false, error: 'Akses ditolak: siswa berada di luar level Anda.' };
    }
    if (currentUser.role === 'Admin Koperasi' && item.type !== 'Koperasi') {
      return { success: false, error: 'Admin Koperasi hanya dapat memproses item Koperasi.' };
    }
    if (currentUser.role === 'Wali Kelas') {
      if (item.type !== 'Kegiatan') {
        return { success: false, error: 'Guru Kelas hanya dapat memproses item Kegiatan.' };
      }
      if (currentUser.assignedClass && student.classGrade !== currentUser.assignedClass) {
        return { success: false, error: 'Akses ditolak: siswa berada di luar kelas yang Anda pegang.' };
      }
    }

    const bpId = `bp-${Date.now()}`;
    const { data, error } = await supabase.rpc('process_book_payment_atomic', {
      p_book_payment_id: bpId,
      p_item_id: bookId,
      p_student_id: studentId,
      p_payment_method: paymentMethod,
      p_academic_year_id: currentAcademicYear.id,
      p_academic_year_label: currentAcademicYear.year,
      p_created_by_id: currentUser.id,
      p_created_by_name: currentUser.name,
      p_created_by_role: currentUser.role,
    });
    if (error) {
      return { success: false, error: error.message };
    }

    const newPayment: BookPayment = {
      id: data.id,
      transactionNumber: data.transactionNumber,
      itemId: item.id,
      bookId: item.id,
      itemTitle: data.itemTitle,
      bookTitle: data.itemTitle,
      itemType: data.itemType,
      category: data.category,
      studentId,
      studentName: data.studentName,
      studentNis: data.studentNis,
      classGrade: data.classGrade,
      amount: data.amount,
      amountPaid: data.amountPaid,
      outstandingAmount: data.outstandingAmount,
      paymentMethod,
      status: data.status,
      approvedByAdmin: data.approvedByAdmin,
      approvedByAdminName: data.approvedByAdminName,
      approvedBySuperAdmin: data.approvedBySuperAdmin,
      approvedBySuperAdminName: data.approvedBySuperAdminName,
      savingsTransactionId: data.savingsTransactionId || undefined,
      createdByName: currentUser.name,
      createdAt: data.createdAt,
      academicYearId: currentAcademicYear.id,
    };
    setBookPayments((prev) => [newPayment, ...prev]);

    // Potong Tabungan (penuh atau sebagian) bikin transaksi Penarikan terkait
    // — sinkronkan ke state lokal biar langsung muncul di antrean approval
    // tanpa nunggu poll 20 detik.
    if (data.savingsTransactionId && data.savingsTransactionNumber) {
      const linkedTx: Transaction = {
        id: data.savingsTransactionId,
        transactionNumber: data.savingsTransactionNumber,
        studentId,
        studentName: data.studentName,
        studentNis: data.studentNis,
        classGrade: data.classGrade,
        type: 'Penarikan',
        amount: data.amount - data.outstandingAmount,
        status: data.savingsTransactionStatus,
        reason: `Pembayaran ${data.itemType} (${data.itemTitle}) via Potong Tabungan`,
        approvedByAdmin: data.approvedByAdmin,
        approvedByAdminName: data.approvedByAdminName,
        approvedBySuperAdmin: data.approvedBySuperAdmin,
        approvedBySuperAdminName: data.approvedBySuperAdminName,
        createdById: currentUser.id,
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
        academicYearId: currentAcademicYear.id,
        createdAt: data.createdAt,
      };
      setTransactions((prev) => [linkedTx, ...prev]);
      if (data.savingsTransactionStatus === 'Disetujui') {
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, balance: data.balanceAfter } : s)));
      }
    }

    saveSnapshot();

    // Cuma tandai "sudah diterima/ikut" kalau beneran lunas — jangan auto-mark
    // untuk yang masih ada tanggungan (Belum Lunas / Lunas Sebagian).
    if (data.outstandingAmount === 0) {
      toggleBookDistribution(item.id, studentId);
    }

    addAuditLog(
      `Pembayaran ${data.itemType} (${paymentMethod})`,
      '-',
      `Status: ${data.status}${data.outstandingAmount > 0 ? ` — Tanggungan Rp ${data.outstandingAmount.toLocaleString('id-ID')}` : ''}`,
      `Pembayaran ${data.itemType} (${data.itemTitle}) oleh siswa ${data.studentName} via ${paymentMethod}. Status: ${data.status}.`
    );

    return { success: true };
  };

  // Melunasi (sebagian/seluruhnya) tanggungan Koperasi/Kegiatan yang masih
  // outstanding — atomik lewat settle_book_payment_atomic (migration 012),
  // sama pola row-lock-nya dengan addBookPayment.
  const settleBookPaymentDebt = async (bookPaymentId: string, method: 'Tunai' | 'Potong Tabungan') => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const bp = bookPayments.find((b) => b.id === bookPaymentId);
    if (!bp) {
      return { success: false, error: 'Data tanggungan tidak ditemukan.' };
    }
    if (currentUser.role === 'Admin Koperasi' && bp.itemType !== 'Koperasi') {
      return { success: false, error: 'Admin Koperasi hanya dapat memproses item Koperasi.' };
    }
    if (currentUser.role === 'Wali Kelas') {
      if (bp.itemType !== 'Kegiatan') {
        return { success: false, error: 'Guru Kelas hanya dapat memproses item Kegiatan.' };
      }
      if (currentUser.assignedClass && bp.classGrade !== currentUser.assignedClass) {
        return { success: false, error: 'Akses ditolak: siswa berada di luar kelas yang Anda pegang.' };
      }
    }

    const { data, error } = await supabase.rpc('settle_book_payment_atomic', {
      p_book_payment_id: bookPaymentId,
      p_payment_method: method,
      p_created_by_id: currentUser.id,
      p_created_by_name: currentUser.name,
      p_created_by_role: currentUser.role,
    });
    if (error) {
      return { success: false, error: error.message };
    }

    setBookPayments((prev) =>
      prev.map((b) =>
        b.id === bookPaymentId
          ? {
              ...b,
              status: data.status,
              amountPaid: data.amountPaid,
              outstandingAmount: data.outstandingAmount,
              settledAt: data.settled ? data.createdAt : b.settledAt,
              approvedByAdmin: data.approvedByAdmin ?? b.approvedByAdmin,
              approvedByAdminName: data.approvedByAdminName ?? b.approvedByAdminName,
              approvedBySuperAdmin: data.approvedBySuperAdmin ?? b.approvedBySuperAdmin,
              approvedBySuperAdminName: data.approvedBySuperAdminName ?? b.approvedBySuperAdminName,
              savingsTransactionId: data.savingsTransactionId || b.savingsTransactionId,
            }
          : b
      )
    );

    if (data.savingsTransactionId && data.savingsTransactionNumber) {
      const linkedTx: Transaction = {
        id: data.savingsTransactionId,
        transactionNumber: data.savingsTransactionNumber,
        studentId: data.studentId,
        studentName: bp.studentName,
        studentNis: bp.studentNis,
        classGrade: data.classGrade,
        type: 'Penarikan',
        amount: (data.amountPaid ?? 0) - (bp.amount - bp.outstandingAmount),
        status: data.savingsTransactionStatus,
        reason: `Pelunasan tanggungan ${bp.itemType} (${bp.itemTitle})`,
        approvedByAdmin: data.approvedByAdmin,
        approvedByAdminName: data.approvedByAdminName,
        approvedBySuperAdmin: data.approvedBySuperAdmin,
        approvedBySuperAdminName: data.approvedBySuperAdminName,
        createdById: currentUser.id,
        createdByName: currentUser.name,
        createdByRole: currentUser.role,
        academicYearId: bp.academicYearId,
        createdAt: data.createdAt,
      };
      setTransactions((prev) => [linkedTx, ...prev]);
      if (data.savingsTransactionStatus === 'Disetujui') {
        setStudents((prev) => prev.map((s) => (s.id === data.studentId ? { ...s, balance: data.balanceAfter } : s)));
      }
    }

    if (data.settled) {
      toggleBookDistribution(bp.itemId, bp.studentId);
    }

    saveSnapshot();

    addAuditLog(
      `Pelunasan Tanggungan ${bp.itemType}`,
      `Tanggungan: Rp ${bp.outstandingAmount.toLocaleString('id-ID')}`,
      `Status: ${data.status}${data.outstandingAmount > 0 ? ` — Sisa Rp ${data.outstandingAmount.toLocaleString('id-ID')}` : ' — Lunas'}`,
      `Pelunasan tanggungan ${bp.itemType.toLowerCase()} (${bp.itemTitle}) siswa ${bp.studentName} via ${method}.`
    );

    return { success: true };
  };

  const addSppPayment = async (studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan', period: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    const student = students.find((s) => s.id === studentId && !s.isDeleted);
    if (!student) {
      return { success: false, error: 'Siswa tidak ditemukan.' };
    }
    if (!canAccessStudent(student)) {
      return { success: false, error: 'Akses ditolak: siswa berada di luar level Anda.' };
    }

    const sppAmount = student.classGrade.startsWith('TK') ? (schoolSettings.sppTKAmount || 50000) : (schoolSettings.sppSDAmount || 0);
    if (sppAmount <= 0) {
      return { success: false, error: 'SPP untuk siswa ini gratis (Rp 0). Tidak perlu melakukan pembayaran.' };
    }
    const trNum = generateTransactionNumber('SP', currentAcademicYear.year, sppPayments.length);

    let potongTxId: string | undefined;
    let balanceBefore: number | undefined;

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
      const txRes = await insertRow('transactions', newTx);
      const balanceAfter = student.balance - sppAmount;
      const balRes = await updateRow('students', studentId, { balance: balanceAfter });
      if (!txRes.success || !balRes.success) {
        return { success: false, error: `Gagal menyimpan potongan tabungan ke database: ${txRes.error || balRes.error}` };
      }
      potongTxId = newTx.id;
      balanceBefore = student.balance;
      setTransactions((prev) => [newTx, ...prev]);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, balance: balanceAfter } : s))
      );
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

    const sppRes = await insertRow('spp_payments', newPayment);
    if (!sppRes.success) {
      // Rollback potongan tabungan agar saldo tidak hilang tanpa catatan SPP
      if (potongTxId && balanceBefore !== undefined) {
        await deleteRow('transactions', potongTxId);
        setTransactions((prev) => prev.filter((t) => t.id !== potongTxId));
        await updateRow('students', studentId, { balance: balanceBefore });
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, balance: balanceBefore } : s)));
      }
      return { success: false, error: `Gagal menyimpan pembayaran SPP ke database: ${sppRes.error}` };
    }
    setSppPayments((prev) => [newPayment, ...prev]);
    saveSnapshot();

    addAuditLog(
      'Pembayaran SPP',
      '-',
      `${student.name}: Rp ${sppAmount.toLocaleString('id-ID')} (${period})`,
      `Pembayaran SPP ${student.name} (${student.nis}) - ${period} via ${paymentMethod} oleh ${currentUser.name}`
    );

    return { success: true };
  };

  const exportBackupData = (): { success: boolean; data?: string; error?: string } => {
    if (!currentUser || ROLE_RANK[currentUser.role] < 3) {
      return { success: false, error: 'Hanya Super Admin/Developer yang dapat mengekspor cadangan database.' };
    }
    addAuditLog('Backup Database JSON', '-', `Versi 1.0`, `Ekspor cadangan data sistem oleh ${currentUser.name}`);
    return { success: true, data: JSON.stringify(buildBackupPayload(), null, 2) };
  };

  const restoreBackupData = async (jsonString: string) => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Developer') {
      return { success: false, error: 'Fitur restore database hanya dapat diakses oleh role Developer.' };
    }

    try {
      const data = JSON.parse(jsonString);
      const preview = inspectBackupPayload(data);
      if (!preview.valid) {
        return { success: false, error: preview.error || 'Format file cadangan tidak valid!' };
      }

      // Safety net: snapshot paksa kondisi sebelum restore (untuk rollback manual)
      await saveSnapshot(true);

      // restore_backup() runs as one Postgres transaction (007_restore_rpc.sql):
      // any failure rolls back everything, so this either fully applies or the
      // database is genuinely untouched — no more partial-restore state.
      const restorePayload = {
        school_settings: data.schoolSettings ? toDbRow(data.schoolSettings) : null,
        academic_years: (data.academicYears || []).map(toDbRow),
        students: (data.students || []).map(toDbRow),
        transactions: (data.transactions || []).map(toDbRow),
        books: (data.books || []).map(toDbRow),
        book_distributions: (data.bookDistributions || []).map(toDbRow),
        book_payments: (data.bookPayments || []).map(toDbRow),
        spp_payments: (data.sppPayments || []).map(toDbRow),
        audit_logs: (data.auditLogs || []).map(toDbRow),
      };
      const { error: rpcError } = await supabase.rpc('restore_backup', { payload: restorePayload });
      if (rpcError) {
        return { success: false, error: `Restore gagal, database TIDAK diubah (transaksi di-rollback): ${rpcError.message}` };
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
      saveSnapshot();

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

  const restoreLastSnapshot = async () => {
    if (!currentUser || currentUser.demoMode) {
      return { success: false, error: 'Mode Demo: Akun ini hanya untuk melihat, tidak dapat melakukan perubahan.' };
    }
    if (currentUser.role !== 'Developer') {
      return { success: false, error: 'Fitur restore hanya dapat diakses oleh role Developer.' };
    }
    try {
      const { data, error } = await supabase
        .from('snapshots')
        .select('payload')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        return { success: false, error: 'Belum ada snapshot tersimpan.' };
      }
      return await restoreBackupData(JSON.stringify(data.payload));
    } catch {
      return { success: false, error: 'Gagal membaca snapshot.' };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        login,
        logout,
        schoolSettings,
        updateSchoolSettings,
        academicYears,
        currentAcademicYear,
        addAcademicYear,
        deleteAcademicYear,
        setCurrentAcademicYearId,
        bulkPromoteStudents,
  runYearEndClosure,
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
        settleBookPaymentDebt,
        auditLogs,
        addAuditLog,
        sppPayments,
        addSppPayment,
        exportBackupData,
        restoreBackupData,
        lastSnapshotTime,
        restoreLastSnapshot,
         syncErrors,
         clearSyncErrors,
         syncState,
         authLoading,
         users,
    addUser,
    updateUserRole,
    updateUserAccessLevel,
    updateUserAssignedClass,

        changeUserPassword,
        changeViewerPassword,
        resetViewerPassword,
        provisionViewerAccount,
        provisionViewersBulk,
        resetStaffPassword,
        deleteUser,
      }}
    >
      {syncErrors.length > 0 && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-medium shadow-lg relative z-50">
          <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
            <span className="leading-snug">
              Peringatan: Gagal menyimpan data ke cloud ({syncErrors[0].table} — {syncErrors[0].message.slice(0, 150)}, {new Date(syncErrors[0].timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}). Data hanya tersimpan sementara di perangkat Anda. Periksa koneksi internet; jika masalah berlanjut, hubungi segera developer.
              {syncErrors.length > 1 && ` (+${syncErrors.length - 1} operasi gagal lainnya)`}
            </span>
            <button onClick={clearSyncErrors} className="shrink-0 bg-white/20 hover:bg-white/30 rounded px-2 py-1 cursor-pointer">
              Tutup
            </button>
          </div>
        </div>
      )}
      {authLoading || (currentUser && !dbLoaded) ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white">
          <div className="w-8 h-8 border-2 border-slate-300/30 border-t-white rounded-full animate-spin"></div>
          <span className="mt-3 text-sm font-medium">Memuat Simu...</span>
        </div>
      ) : (
        children
      )}
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
