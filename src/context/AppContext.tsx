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
  Book,
  BookDistribution,
  BookPayment,
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
  initialAuditLogs,
} from '../utils/initialData';
import { generateTransactionNumber } from '../utils/format';

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
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

  exportBackupData: () => string;
  restoreBackupData: (jsonString: string) => { success: boolean; error?: string };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tabungan_sekolah_v1_data';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    return initialUsers.find((u) => u.role === 'Super Admin') || initialUsers[0];
  });

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
  }, [schoolSettings, academicYears, students, transactions, books, bookDistributions, bookPayments, auditLogs]);

  const currentAcademicYear = academicYears.find((y) => y.id === currentAcademicYearId) || academicYears[0];

  const switchRole = (role: UserRole) => {
    const found = initialUsers.find((u) => u.role === role);
    if (found) {
      setCurrentUser(found);
      addAuditLog('Ganti Role Demo', `User: ${currentUser.name}`, `User: ${found.name}`, `Beralih tampilan ke role ${role}`);
    }
  };

  const addAuditLog = (action: string, valueBefore: string, valueAfter: string, details: string) => {
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
  };

  const updateSchoolSettings = (settings: Partial<SchoolSettings>) => {
    const before = JSON.stringify(schoolSettings);
    setSchoolSettings((prev) => ({ ...prev, ...settings }));
    addAuditLog('Update Pengaturan Sekolah', before, JSON.stringify({ ...schoolSettings, ...settings }), 'Mengubah nama, alamat, atau logo sekolah');
  };

  const addAcademicYear = (yearStr: string) => {
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
    addAuditLog('Tambah Tahun Ajaran', `Aktif: ${currentAcademicYear.year}`, `Aktif: ${yearStr}`, `Membuka tahun ajaran baru ${yearStr} dan mengarsip data sebelumnya.`);
  };

  const setCurrentAcademicYearId = (id: string) => {
    setCurrentAcademicYearIdState(id);
  };

  const bulkPromoteStudents = (fromClass: string, toClass: string) => {
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
    addAuditLog('Pindah Kelas Massal', `Kelas asal: ${fromClass}`, `Kelas tujuan: ${toClass}`, `Memindahkan ${affected.length} siswa dari kelas ${fromClass} ke ${toClass}`);
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'createdAt' | 'balance'> & { initialBalance?: number }) => {
    // Validate NIS uniqueness
    const exists = students.find((s) => s.nis === studentData.nis && !s.isDeleted);
    if (exists) {
      return { success: false, error: `NIS ${studentData.nis} sudah terdaftar atas nama ${exists.name}!` };
    }

    const newId = `st-${Date.now()}`;
    const initialBal = studentData.initialBalance || 0;
    const newStudent: Student = {
      ...studentData,
      id: newId,
      balance: initialBal,
      createdAt: new Date().toISOString(),
    };

    setStudents((prev) => [newStudent, ...prev]);

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
    }

    addAuditLog('Tambah Siswa Baru', '-', `Siswa: ${newStudent.name} (NIS: ${newStudent.nis})`, `Menambahkan siswa baru kelas ${newStudent.classGrade} dengan saldo awal Rp ${initialBal}`);
    return { success: true };
  };

  const updateStudent = (id: string, data: Partial<Student>) => {
    const student = students.find((s) => s.id === id);
    if (!student) return;

    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    addAuditLog('Edit Data Siswa', JSON.stringify(student), JSON.stringify({ ...student, ...data }), `Mengubah data siswa ${student.name} (NIS: ${student.nis})`);
  };

  const softDeleteStudent = (id: string) => {
    const student = students.find((s) => s.id === id);
    if (!student) return;

    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, isDeleted: true } : s)));
    addAuditLog('Hapus Siswa (Soft Delete)', `Status: ${student.status}`, 'Status: Soft Deleted', `Menghapus siswa ${student.name} (NIS: ${student.nis}). Data histori tetap aman.`);
  };

  const importStudentsBulk = (newStudentsList: Partial<Student>[]) => {
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
      setStudents((prev) => [...addedArray, ...prev]);
      if (addedTransactions.length > 0) {
        setTransactions((prev) => [...addedTransactions, ...prev]);
      }
      addAuditLog('Import Massal Siswa Excel', '-', `Total diimport: ${addedCount}`, `Berhasil mengimport ${addedCount} data siswa dari Excel.`);
    }

    return { addedCount, errors };
  };

  const addDeposit = (studentId: string, amount: number, reason: string) => {
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

    addAuditLog(
      'Setoran Tabungan',
      `Saldo ${student.name}: Rp ${balanceBefore.toLocaleString('id-ID')}`,
      `Saldo ${student.name}: Rp ${balanceAfter.toLocaleString('id-ID')}`,
      `Setoran Rp ${amount.toLocaleString('id-ID')} (${trNum}) oleh ${currentUser.name}`
    );

    return { success: true, transaction: newTx };
  };

  const requestWithdrawal = (studentId: string, amount: number, reason: string) => {
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

    const trNum = generateTransactionNumber('ST', currentAcademicYear.year, transactions.length);

    // CRITICAL: Status = Menunggu Persetujuan. Saldo siswa BELUM BERUBAH sama sekali!
    const newTx: Transaction = {
      id: `tr-${Date.now()}`,
      transactionNumber: trNum,
      studentId,
      studentName: student.name,
      studentNis: student.nis,
      classGrade: student.classGrade,
      type: 'Penarikan',
      amount,
      status: 'Menunggu Persetujuan',
      reason,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
      academicYearId: currentAcademicYear.id,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    addAuditLog(
      'Pengajuan Penarikan',
      'Status: Menunggu Persetujuan',
      'Status: Menunggu Persetujuan',
      `Pengajuan penarikan Rp ${amount.toLocaleString('id-ID')} untuk ${student.name} (${trNum}). Saldo siswa tetap Rp ${student.balance.toLocaleString('id-ID')} hingga disetujui.`
    );

    return { success: true, transaction: newTx };
  };

  const approveWithdrawal = (transactionId: string) => {
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Super Admin & Developer yang memiliki akses persetujuan (approval).' };
    }

    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) {
      return { success: false, error: 'Transaksi tidak ditemukan.' };
    }
    if (tx.status !== 'Menunggu Persetujuan') {
      return { success: false, error: 'Transaksi ini sudah diproses sebelumnya.' };
    }

    const student = students.find((s) => s.id === tx.studentId);
    if (!student) {
      return { success: false, error: 'Data siswa tidak ditemukan.' };
    }

    if (student.balance < tx.amount) {
      return {
        success: false,
        error: `Saldo siswa saat ini (Rp ${student.balance.toLocaleString('id-ID')}) tidak mencukupi nominal potongan (Rp ${tx.amount.toLocaleString('id-ID')}).`,
      };
    }

    const balanceBefore = student.balance;
    const balanceAfter = balanceBefore - tx.amount;

    // Deduct student balance and update transaction status to Disetujui
    setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, balance: balanceAfter } : s)));
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? {
              ...t,
              status: 'Disetujui',
              approvedById: currentUser.id,
              approvedByName: currentUser.name,
              approvedByRole: currentUser.role,
            }
          : t
      )
    );

    // If this withdrawal was linked to a book payment, update book payment status as well
    setBookPayments((prev) =>
      prev.map((bp) =>
        bp.savingsTransactionId === transactionId ? { ...bp, status: 'Disetujui' } : bp
      )
    );

    addAuditLog(
      'Approval Penarikan Disetujui',
      `Saldo ${student.name}: Rp ${balanceBefore.toLocaleString('id-ID')}`,
      `Saldo ${student.name}: Rp ${balanceAfter.toLocaleString('id-ID')}`,
      `Disetujui oleh ${currentUser.name} (${currentUser.role}). Potongan Rp ${tx.amount.toLocaleString('id-ID')} (${tx.transactionNumber}) berhasil dipotong.`
    );

    return { success: true };
  };

  const rejectWithdrawal = (transactionId: string, rejectionReason?: string) => {
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Developer') {
      return { success: false, error: 'Hanya Super Admin & Developer yang bisa menolak pengajuan.' };
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
              rejectionReason: rejectionReason || 'Ditolak oleh pimpinan',
              approvedById: currentUser.id,
              approvedByName: currentUser.name,
              approvedByRole: currentUser.role,
            }
          : t
      )
    );

    // If linked to book payment, update book payment status to Ditolak
    setBookPayments((prev) =>
      prev.map((bp) =>
        bp.savingsTransactionId === transactionId ? { ...bp, status: 'Ditolak' } : bp
      )
    );

    addAuditLog(
      'Approval Penarikan Ditolak',
      'Status: Menunggu Persetujuan',
      'Status: Ditolak',
      `Penarikan ${tx.transactionNumber} ditolak oleh ${currentUser.name}. Saldo siswa tidak berkurang.`
    );

    return { success: true };
  };

  const toggleMonthlyDeduction = (enabled: boolean) => {
    updateSchoolSettings({ monthlyDeductionEnabled: enabled });
  };

  const runMonthlyDeduction = (): MonthlyDeductionSummary => {
    const activeStudents = students.filter(
      (s) => !s.isDeleted && s.status === 'Aktif' && s.academicYearId === currentAcademicYear.id
    );

    const minBalance = schoolSettings.monthlyDeductionMinBalance || 5000;
    const amountToDeduct = schoolSettings.monthlyDeductionAmount || 1000;

    const deductedList: { id: string; name: string; nis: string; balanceBefore: number; balanceAfter: number }[] = [];
    const skippedList: { id: string; name: string; nis: string; balance: number; reason: string }[] = [];

    const newTransactions: Transaction[] = [];
    const updatedStudentsMap: Record<string, number> = {};

    activeStudents.forEach((student) => {
      if (student.balance >= minBalance) {
        const balBefore = student.balance;
        const balAfter = balBefore - amountToDeduct;
        updatedStudentsMap[student.id] = balAfter;

        deductedList.push({
          id: student.id,
          name: student.name,
          nis: student.nis,
          balanceBefore: balBefore,
          balanceAfter: balAfter,
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
          amount: amountToDeduct,
          status: 'Disetujui',
          reason: `Potongan Otomatis Bulanan Administrasi (Saldo >= Rp ${minBalance.toLocaleString('id-ID')})`,
          createdById: currentUser.id,
          createdByName: `${currentUser.name} (Sistem Potongan Bulanan)`,
          createdByRole: currentUser.role,
          academicYearId: currentAcademicYear.id,
          createdAt: new Date().toISOString(),
        });
      } else {
        skippedList.push({
          id: student.id,
          name: student.name,
          nis: student.nis,
          balance: student.balance,
          reason: `Saldo Rp ${student.balance.toLocaleString('id-ID')} kurang dari batas minimal Rp ${minBalance.toLocaleString('id-ID')}`,
        });
      }
    });

    // Apply balance updates
    if (deductedList.length > 0) {
      setStudents((prev) =>
        prev.map((s) => (updatedStudentsMap[s.id] !== undefined ? { ...s, balance: updatedStudentsMap[s.id] } : s))
      );
      setTransactions((prev) => [...newTransactions, ...prev]);
    }

    const summary: MonthlyDeductionSummary = {
      runDate: new Date().toISOString(),
      totalStudentsDeducted: deductedList.length,
      totalAmountDeducted: deductedList.length * amountToDeduct,
      deductedStudents: deductedList,
      skippedStudents: skippedList,
    };

    updateSchoolSettings({ lastMonthlyDeductionRun: new Date().toISOString() });

    addAuditLog(
      'Eksekusi Potongan Bulanan Otomatis',
      '-',
      `Total Terpotong: ${deductedList.length} siswa (Rp ${(deductedList.length * amountToDeduct).toLocaleString('id-ID')})`,
      `Potongan bulanan Rp ${amountToDeduct} dijalankan. ${deductedList.length} siswa dipotong, ${skippedList.length} siswa dilewati karena saldo < Rp ${minBalance.toLocaleString('id-ID')}.`
    );

    return summary;
  };

  const addBook = (bookData: Omit<Book, 'id'>) => {
    const newBook: Book = {
      ...bookData,
      id: `bk-${Date.now()}`,
    };
    setBooks((prev) => [...prev, newBook]);
    addAuditLog('Tambah Data Buku', '-', `Buku: ${newBook.title}`, `Menambahkan buku baru ${newBook.title} kelas ${newBook.classGrade} harga Rp ${newBook.price}`);
  };

  const updateBook = (id: string, bookData: Partial<Book>) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...bookData } : b)));
    addAuditLog('Edit Data Buku', '-', JSON.stringify(bookData), `Mengubah informasi data buku ID ${id}`);
  };

  const deleteBook = (id: string) => {
    const book = books.find((b) => b.id === id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    addAuditLog('Hapus Buku', `Buku: ${book?.title}`, '-', `Menghapus buku ${book?.title} dari sistem`);
  };

  const toggleBookDistribution = (bookId: string, studentId: string) => {
    const existing = bookDistributions.find((bd) => bd.bookId === bookId && bd.studentId === studentId);
    if (existing) {
      setBookDistributions((prev) =>
        prev.map((bd) => (bd.id === existing.id ? { ...bd, received: !bd.received, receivedAt: !bd.received ? new Date().toISOString() : undefined } : bd))
      );
    } else {
      const newBd: BookDistribution = {
        id: `bd-${Date.now()}`,
        bookId,
        studentId,
        received: true,
        receivedAt: new Date().toISOString(),
      };
      setBookDistributions((prev) => [...prev, newBd]);
    }
  };

  const addBookPayment = (bookId: string, studentId: string, paymentMethod: 'Tunai' | 'Potong Tabungan') => {
    const book = books.find((b) => b.id === bookId);
    const student = students.find((s) => s.id === studentId && !s.isDeleted);

    if (!book || !student) {
      return { success: false, error: 'Data buku atau siswa tidak ditemukan.' };
    }

    const trNum = generateTransactionNumber('BK', currentAcademicYear.year, bookPayments.length);

    if (paymentMethod === 'Tunai') {
      const newPayment: BookPayment = {
        id: `bp-${Date.now()}`,
        transactionNumber: trNum,
        bookId,
        bookTitle: book.title,
        studentId,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        amount: book.price,
        paymentMethod: 'Tunai',
        status: 'Disetujui',
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        academicYearId: currentAcademicYear.id,
      };

      setBookPayments((prev) => [newPayment, ...prev]);

      // Automatically mark book distribution as received
      toggleBookDistribution(bookId, studentId);

      addAuditLog(
        'Pembayaran Buku Tunai',
        '-',
        `Lunas Tunai: Rp ${book.price.toLocaleString('id-ID')}`,
        `Pembayaran buku ${book.title} oleh siswa ${student.name} secara tunai.`
      );

      return { success: true };
    } else {
      // Potong Tabungan -> must request withdrawal & go through approval!
      if (student.balance < book.price) {
        return {
          success: false,
          error: `Saldo tabungan siswa (Rp ${student.balance.toLocaleString('id-ID')}) tidak mencukupi harga buku (Rp ${book.price.toLocaleString('id-ID')}).`,
        };
      }

      // 1. Generate savings withdrawal transaction with status Menunggu Persetujuan
      const withdrawalRes = requestWithdrawal(
        studentId,
        book.price,
        `Pembayaran Buku (${book.title}) via Potong Tabungan`
      );

      if (!withdrawalRes.success || !withdrawalRes.transaction) {
        return { success: false, error: withdrawalRes.error || 'Gagal mengajukan potongan tabungan.' };
      }

      // 2. Generate BookPayment linked to withdrawal transaction ID
      const newPayment: BookPayment = {
        id: `bp-${Date.now()}`,
        transactionNumber: trNum,
        bookId,
        bookTitle: book.title,
        studentId,
        studentName: student.name,
        studentNis: student.nis,
        classGrade: student.classGrade,
        amount: book.price,
        paymentMethod: 'Potong Tabungan',
        status: 'Menunggu Persetujuan',
        savingsTransactionId: withdrawalRes.transaction.id,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
        academicYearId: currentAcademicYear.id,
      };

      setBookPayments((prev) => [newPayment, ...prev]);

      addAuditLog(
        'Pengajuan Pembayaran Buku Potong Tabungan',
        'Status: Menunggu Persetujuan',
        'Status: Menunggu Persetujuan',
        `Pengajuan pembayaran buku ${book.title} via potong tabungan. Menunggu approval Super Admin.`
      );

      return { success: true };
    }
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
      auditLogs,
    };
    addAuditLog('Backup Database JSON', '-', `Versi 1.0`, `Ekspor cadangan data sistem oleh ${currentUser.name}`);
    return JSON.stringify(backupObj, null, 2);
  };

  const restoreBackupData = (jsonString: string) => {
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
      setAuditLogs(data.auditLogs || []);

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
        exportBackupData,
        restoreBackupData,
      }}
    >
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
