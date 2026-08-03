/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { formatRupiah, formatNumberInput, parseFormattedNumber } from '../utils/format';
import { Pencil, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TransactionEditModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export const TransactionEditModal: React.FC<TransactionEditModalProps> = ({ transaction, onClose }) => {
  const { requestEditTransaction } = useApp();
  const [formattedAmountInput, setFormattedAmountInput] = useState(formatNumberInput(transaction.amount.toString()));
  const [reason, setReason] = useState(transaction.reason);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNumberInput(e.target.value);
    setFormattedAmountInput(formatted);
    setErrorMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const numAmount = parseFormattedNumber(formattedAmountInput);
    if (numAmount <= 0) {
      setErrorMessage('Nominal baru harus lebih besar dari Rp 0.');
      return;
    }
    if (numAmount > 99999000) {
      setErrorMessage('Nominal melebihi batas maksimal transaksi (Rp 99.999.000).');
      return;
    }

    const res = requestEditTransaction(transaction.id, numAmount, reason || transaction.reason);
    if (!res.success) {
      setErrorMessage(res.error || 'Gagal mengajukan perbaikan.');
      return;
    }
    setSuccessMessage('Permintaan perbaikan berhasil diajukan. Menunggu persetujuan Super Admin (Kepala Sekolah).');
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-600" />
            Perbaiki Transaksi
          </h3>
          <button onClick={onClose} type="button" className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Tutup">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">No Transaksi:</span>
            <span className="font-mono font-bold text-slate-800">{transaction.transactionNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Siswa:</span>
            <span className="font-bold text-slate-900">{transaction.studentName} ({transaction.studentNis})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Jenis:</span>
            <span className="font-semibold">{transaction.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Nominal Saat Ini:</span>
            <span className="font-extrabold text-slate-900">{formatRupiah(transaction.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Keterangan Saat Ini:</span>
            <span className="font-medium text-slate-700 text-right">{transaction.reason}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="edit-amount" className="block font-semibold text-slate-700 mb-1">Nominal Baru *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 font-bold text-slate-500">Rp</span>
              <input
                id="edit-amount"
                type="text"
                required
                value={formattedAmountInput}
                onChange={handleAmountChange}
                className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-reason" className="block font-semibold text-slate-700 mb-1">Keterangan Baru *</label>
            <input
              id="edit-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
            Perubahan baru diterapkan setelah disetujui oleh <strong>Super Admin (Kepala Sekolah)</strong>. Tanggal &amp;
            jam transaksi tidak dapat diubah.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Ajukan Perbaikan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
