/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TransactionType } from '../types';
import { formatRupiah, formatDate } from '../utils/format';
import { Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface PendingEditApprovalsProps {
  type?: TransactionType;
}

export const PendingEditApprovals: React.FC<PendingEditApprovalsProps> = ({ type }) => {
  const { transactions, currentUser, approveEditTransaction, rejectEditTransaction } = useApp();
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [message, setMessage] = useState('');

  const pendingEdits = transactions.filter(
    (t) => t.hasPendingEdit && (!type || t.type === type)
  );

  const canApprove = currentUser.role === 'Super Admin' || currentUser.role === 'Developer';

  const handleApprove = async (txId: string) => {
    const res = await approveEditTransaction(txId);
    if (!res.success) {
      setMessage(`Gagal menyetujui: ${res.error}`);
      return;
    }
    setMessage('Perbaikan transaksi disetujui. Saldo siswa diperbarui.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleConfirmReject = async () => {
    if (!rejectingTxId) return;
    const res = await rejectEditTransaction(rejectingTxId, rejectReasonText || 'Ditolak');
    if (!res.success) {
      setMessage(`Gagal menolak: ${res.error}`);
    } else {
      setMessage('Permintaan perbaikan ditolak. Data asli dipertahankan.');
      setTimeout(() => setMessage(''), 3000);
    }
    setRejectingTxId(null);
    setRejectReasonText('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Antrean Perbaikan Transaksi
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            {pendingEdits.length}
          </span>
        </div>

        {message && (
          <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-semibold">
            {message}
          </div>
        )}

        {pendingEdits.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            Tidak ada permintaan perbaikan transaksi.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {pendingEdits.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-900">{tx.studentName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {tx.transactionNumber} · {tx.studentNis} ({tx.classGrade})
                    </div>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                      {tx.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-amber-700">
                      {formatRupiah(tx.amount)}
                      {tx.editRequest && tx.editRequest.newAmount !== tx.amount && (
                        <span className="text-slate-500 font-bold"> → {formatRupiah(tx.editRequest.newAmount)}</span>
                      )}
                    </div>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                      Pending Approve
                    </span>
                  </div>
                </div>

                {tx.editRequest && (
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Keterangan:</span>
                      <span className="text-right font-medium">
                        {tx.editRequest.oldReason} → {tx.editRequest.newReason}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Diajukan oleh:</span>
                      <span className="text-right font-semibold">{tx.editRequest.requestedByName}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Waktu:</span>
                      <span className="text-right">{formatDate(tx.editRequest.requestedAt)}</span>
                    </div>
                  </div>
                )}

                {canApprove ? (
                  <div className="pt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(tx.id)}
                      className="w-1/2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingTxId(tx.id)}
                      className="w-1/2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Tolak
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-700 font-medium italic text-center pt-1">
                    Menunggu persetujuan Super Admin / Kepala Sekolah
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5" />
        Persetujuan perbaikan hanya dimiliki oleh Kepala Sekolah &amp; Developer.
      </div>

      {rejectingTxId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-100 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Alasan Penolakan Perbaikan</h3>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              placeholder="Masukkan alasan penolakan..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingTxId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
