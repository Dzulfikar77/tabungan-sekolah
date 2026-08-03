# transaction-edit-approval - Work Plan

## TL;DR (For humans)

**What you'll get:** Fitur edit transaksi Setoran atau Penarikan yang sudah Disetujui, dengan persetujuan Super Admin. Field yang bisa diedit: nominal dan keterangan saja. Setelah edit di-approve, saldo siswa otomatis dihitung ulang sesuai selisih.

**Why this approach:** Memanfaatkan pola approval 2-tier yang sudah ada di WithdrawalForm, sehingga Super Admin tidak perlu belajar UI baru. Penambahan kolom `hasPendingEdit` + `editRequest` pada Transaction (bukan tabel terpisah) sesuai arahan "hanya update" dan menjaga kesederhanaan.

**What it will NOT do:**
- Tidak bisa mengubah tanggal/jam transaksi (sesuai permintaan)
- Tidak ada tabel riwayat edit terpisah (update-in-place saja)
- Tidak ada fitur edit bulk (satu per satu)

**Effort:** Medium
**Risk:** Medium - Perhitungan saldo saat approve edit kritis; bug bisa merusak data keuangan
**Decisions to sanity-check:** (none — semua sudah dikonfirmasi)

Your next move: Execute the plan via `$start-work transaction-edit-approval`. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, Medium risk — Add edit-with-approval for approved Setoran/Penarikan transactions; fields editable: amount + reason only; auto-balance-recalc on approve; audit-logged; no new deps.

## Scope
### Must have
- Extend `Transaction` interface with `hasPendingEdit?: boolean` and `editRequest?` fields
- Supabase migration adding `has_pending_edit` + `edit_request` columns to transactions table
- 3 new `AppContext` functions: `requestEditTransaction`, `approveEditTransaction`, `rejectEditTransaction`
- `TransactionEditModal` shared component (edit form for amount + reason)
- `PendingEditApprovals` shared component (approval panel for Super Admin/Developer)
- Edit button in DepositForm + WithdrawalForm history tables (only on `Disetujui` rows without pending edit)
- Pending edit badge in table rows
- PendingEditApprovals panel wired into both forms
- Balance auto-recalculation on approve (Setoran: += diff, Penarikan: -= diff)
- Audit log entries for request, approve, and reject actions
- `AppContextType` interface updated with 3 new function signatures

### Must NOT have (guardrails, anti-slop, scope boundaries)
- NO editing of transaction `createdAt` date/time
- NO editing of `studentId`, `studentName`, `type`, `transactionNumber`
- NO separate edit-history table (update-in-place only)
- NO new npm dependencies or test frameworks
- NO changes to existing new-transaction approval flow
- NO bulk edit
- NO edit for auto-generated `Potongan Bulanan` transactions (only manual Setoran + Penarikan)

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none + tsc --noEmit (no test runner installed; package.json has only "lint": "tsc --noEmit")
- Evidence: .omo/evidence/task-N-transaction-edit-approval.<ext>

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.
- Wave 1: todos 1, 2 (types + migration — independent, parallel)
- Wave 2: todos 3, 4, 5 (context functions + 2 components — parallel after 1)
- Wave 3: todo 6 (wiring — after 1,2,3,4,5)

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | - | 3,4,5,6 | 2 |
| 2 | - | 6 | 1 |
| 3 | 1 | 6 | 4,5 |
| 4 | 1 | 6 | 3,5 |
| 5 | 1 | 6 | 3,4 |
| 6 | 1,2,3,4,5 | - | - |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Extend Transaction type with edit fields
  What to do / Must NOT do: In src/types.ts add to `Transaction` interface: `hasPendingEdit?: boolean;` and `editRequest?: TransactionEditRequest;`. Add new exported interface `TransactionEditRequest` above Transaction (or right after TransactionStatus) with fields: `requestedById: string; requestedByName: string; requestedByRole: UserRole; requestedAt: string; oldAmount: number; newAmount: number; oldReason: string; newReason: string;`. Do NOT modify BookPayment/SppPayment interfaces. Do NOT add fields for date editing.
  Parallelization: Wave 1 | Blocked by: - | Blocks: 3,4,5,6
  References (executor has NO interview context - be exhaustive): src/types.ts:62-87 (Transaction interface), src/types.ts:55-60 (TransactionStatus), src/types.ts:6 (UserRole)
  Acceptance criteria (agent-executable): `grep -c 'hasPendingEdit' src/types.ts` ≥ 1; `grep -c 'editRequest' src/types.ts` ≥ 2 (field + interface); `npx tsc --noEmit` exit code 0
  QA scenarios (name the exact tool + invocation): happy: `npx tsc --noEmit` passes, grep finds fields; failure: temporarily set `hasPendingEdit: 'wrong'` in interface → `npx tsc --noEmit` reports error; Evidence .omo/evidence/task-1-transaction-edit-approval.types.log
  Commit: Y | feat(types): add hasPendingEdit and editRequest to Transaction

- [ ] 2. Create Supabase migration 003 for edit columns
  What to do / Must NOT do: Create `supabase/migrations/003_add_transaction_edit_columns.sql`. Content: `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_pending_edit BOOLEAN DEFAULT FALSE;` and `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS edit_request JSONB;`. Match existing migration style (numbered comments header). Do NOT drop/recreate the transactions table. Do NOT add columns to other tables.
  Parallelization: Wave 1 | Blocked by: - | Blocks: 6
  References (executor has NO interview context - be exhaustive): supabase/migrations/001_initial_schema.sql:84-109 (transactions table), supabase/migrations/001_initial_schema.sql:1-3 (file header style)
  Acceptance criteria (agent-executable): `test -f supabase/migrations/003_add_transaction_edit_columns.sql`; `grep -q 'has_pending_edit BOOLEAN DEFAULT FALSE' supabase/migrations/003_add_transaction_edit_columns.sql`; `grep -q 'edit_request JSONB' supabase/migrations/003_add_transaction_edit_columns.sql`
  QA scenarios (name the exact tool + invocation): happy: both grep matches found; failure: file missing → `test -f` fails; Evidence .omo/evidence/task-2-transaction-edit-approval.migration.sql
  Commit: Y | feat(db): migration 003 add has_pending_edit + edit_request columns

- [ ] 3. Add 3 edit functions to AppContext
  What to do / Must NOT do: In src/context/AppContext.tsx add three functions and expose them in AppContextType (interface lines 40-106) and the Provider value object (lines 1722-1777). Signatures: `requestEditTransaction(transactionId: string, newAmount: number, newReason: string): { success: boolean; error?: string }` — guard: only currentUser non-demo; find tx by id; reject if tx.status !== 'Disetujui'; reject if tx.hasPendingEdit already true; reject if tx.type === 'Potongan Bulanan'; validate newAmount > 0 and ≤ 99999000; set hasPendingEdit=true + editRequest={requestedById/Name/Role: currentUser, requestedAt: new Date().toISOString(), oldAmount: tx.amount, newAmount, oldReason: tx.reason, newReason}; do NOT change amount/reason/balance yet; updateRow('transactions', tx.id, {...}); addAuditLog('Edit Transaksi Diajukan', `Nominal ${tx.amount} / Ket: ${tx.reason}`, `Nominal ${newAmount} / Ket: ${newReason}`, ...). `approveEditTransaction(transactionId: string): { success: boolean; error?: string }` — guard: currentUser role Super Admin/Developer only; find tx + student; if tx.type==='Setoran' newBalance = student.balance + (newAmount - oldAmount); if tx.type==='Penarikan' newBalance = student.balance - (newAmount - oldAmount); guard newBalance ≥ 0 else return error; update student balance (setStudents + updateRow('students', ...)), update tx amount=editRequest.newAmount, reason=editRequest.newReason, clear hasPendingEdit + editRequest (delete keys or set undefined), updateRow('transactions', ...); addAuditLog('Edit Transaksi Disetujui', before, after, ...). `rejectEditTransaction(transactionId: string, rejectionReason?: string): { success: boolean; error?: string }` — guard Super Admin/Developer; clear hasPendingEdit + editRequest, keep original amount/reason; updateRow; addAuditLog('Edit Transaksi Ditolak', ...). Must NOT touch bookPayments linking (savingsTransactionId) — out of scope. Must NOT alter existing addDeposit/requestWithdrawal/approveWithdrawal/rejectWithdrawal.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 6
  References (executor has NO interview context - be exhaustive): src/context/AppContext.tsx:40-106 (AppContextType), 680-801 (addDeposit pattern: validation + insertRow + addAuditLog + setStudents), 883-1067 (approveWithdrawal: role guard + balance update + updateRow), 1069-1116 (rejectWithdrawal: rejectionReason + updateRow), 423-438 (addAuditLog), 1722-1777 (Provider value), src/lib/db.ts:59-62 (updateRow signature), src/types.ts:62-87 (Transaction fields)
  Acceptance criteria (agent-executable): `grep -c 'requestEditTransaction' src/context/AppContext.tsx` ≥ 3 (interface + impl + value); `grep -c 'approveEditTransaction' src/context/AppContext.tsx` ≥ 3; `grep -c 'rejectEditTransaction' src/context/AppContext.tsx` ≥ 3; `npx tsc --noEmit` exit 0
  QA scenarios (name the exact tool + invocation): happy: `npx tsc --noEmit` passes; logic smoke: `grep -A5 'const approveEditTransaction' src/context/AppContext.tsx` shows newBalance guard `>= 0`; failure: remove one function from Provider value → tsc error "missing property"; Evidence .omo/evidence/task-3-transaction-edit-approval.context.log
  Commit: Y | feat(context): add requestEditTransaction, approveEditTransaction, rejectEditTransaction

- [ ] 4. Create TransactionEditModal component
  What to do / Must NOT do: Create `src/components/TransactionEditModal.tsx`. Props: `{ transaction: Transaction; onClose: () => void; onRequestEdit: (newAmount: number, newReason: string) => void; }`. Render fixed-position overlay modal (mirror reject modal style in WithdrawalForm lines 761-789). Show transaction info (student, no transaksi, current nominal, current keterangan) read-only. Two inputs: nominal (use formatNumberInput/parseFormattedNumber, preset buttons optional), keterangan (text input). Validation: newAmount > 0 and ≤ 99999000 (mirror DepositForm handleAmountChange lines 58-76). NO date input. On submit call onRequestEdit then onClose. Must NOT import useApp directly (receive via props for testability) — actually simpler: import useApp, call requestEditTransaction inside. Choose: import useApp + call requestEditTransaction(t.id, amount, reason) directly, show error inline. Do NOT add delete/close-account logic.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 6
  References (executor has NO interview context - be exhaustive): src/components/WithdrawalForm.tsx:761-789 (reject modal overlay pattern), src/components/DepositForm.tsx:58-76 (amount validation), src/utils/format.ts:40-51 (formatNumberInput/parseFormattedNumber), src/types.ts:62-87 (Transaction)
  Acceptance criteria (agent-executable): `test -f src/components/TransactionEditModal.tsx`; `grep -q 'requestEditTransaction' src/components/TransactionEditModal.tsx`; `npx tsc --noEmit` exit 0
  QA scenarios (name the exact tool + invocation): happy: `npx tsc --noEmit` passes; failure: omit required prop in usage → tsc error; Evidence .omo/evidence/task-4-transaction-edit-approval.modal.log
  Commit: Y | feat(components): add TransactionEditModal

- [ ] 5. Create PendingEditApprovals component
  What to do / Must NOT do: Create `src/components/PendingEditApprovals.tsx`. Uses useApp: transactions, currentUser, approveEditTransaction, rejectEditTransaction. Filter `transactions.filter(t => t.hasPendingEdit)`. Render panel (mirror approval queue style WithdrawalForm lines 598-681): for each pending-edit tx show student, no transaksi, current amount→new amount, current reason→new reason, requestedBy + requestedAt; if currentUser.role is Super Admin/Developer show Setujui/Tolak buttons (Tolak opens inline textarea for rejection reason, mirror lines 761-789). If role below, show "Menunggu persetujuan Super Admin" note. Must NOT auto-approve anything. Must NOT modify status of tx, only hasPendingEdit + editRequest via context functions.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 6
  References (executor has NO interview context - be exhaustive): src/components/WithdrawalForm.tsx:598-681 (approval queue panel), 652-671 (approve/reject buttons role-gated), 761-789 (reject modal), src/context/AppContext.tsx:883-1067 (approveWithdrawal role guard pattern)
  Acceptance criteria (agent-executable): `test -f src/components/PendingEditApprovals.tsx`; `grep -q 'hasPendingEdit' src/components/PendingEditApprovals.tsx`; `grep -q "role === 'Super Admin'" src/components/PendingEditApprovals.tsx`; `npx tsc --noEmit` exit 0
  QA scenarios (name the exact tool + invocation): happy: `npx tsc --noEmit` passes; failure: missing reject reason handler → tsc error; Evidence .omo/evidence/task-5-transaction-edit-approval.approvals.log
  Commit: Y | feat(components): add PendingEditApprovals panel

- [ ] 6. Wire components into DepositForm and WithdrawalForm
  What to do / Must NOT do: In `src/components/DepositForm.tsx`: import TransactionEditModal + PendingEditApprovals; add state `editingTx: Transaction | null`; in the right-column card (near lastSuccessTransaction) render `<PendingEditApprovals />`; in history section add an "Edit" button (Pencil icon from lucide) on each row where `t.status === 'Disetujui' && !t.hasPendingEdit`; clicking sets editingTx; render `<TransactionEditModal transaction={editingTx} onClose={() => setEditingTx(null)} />` when editingTx non-null; add amber badge "Menunggu Approve Edit" on rows where `t.hasPendingEdit`. In `src/components/WithdrawalForm.tsx`: same wiring — PendingEditApprovals panel below the existing approval queue card; Edit button + badge in history table (lines 684-759); modal render. Must NOT remove existing approval queue for penarikan baru. Must NOT break the existing Cetak button.
  Parallelization: Wave 3 | Blocked by: 1,2,3,4,5 | Blocks: -
  References (executor has NO interview context - be exhaustive): src/components/DepositForm.tsx:117-119 (depositTransactions filter), 380-382 (right column card), src/components/WithdrawalForm.tsx:598-681 (approval queue), 684-759 (history table), 742-751 (Cetak button), src/components/WithdrawalForm.tsx:1-27 (import style), lucide icons available: src/components/WithdrawalForm.tsx:12-27
  Acceptance criteria (agent-executable): `grep -q 'TransactionEditModal' src/components/DepositForm.tsx`; `grep -q 'PendingEditApprovals' src/components/DepositForm.tsx`; `grep -q 'TransactionEditModal' src/components/WithdrawalForm.tsx`; `grep -q 'PendingEditApprovals' src/components/WithdrawalForm.tsx`; `grep -q 'hasPendingEdit' src/components/WithdrawalForm.tsx`; `grep -q 'hasPendingEdit' src/components/DepositForm.tsx`; `npx tsc --noEmit` exit 0
  QA scenarios (name the exact tool + invocation): happy: all greps pass + tsc 0; failure: remove one import → tsc error; Evidence .omo/evidence/task-6-transaction-edit-approval.wiring.log
  Commit: Y | feat(ui): wire TransactionEditModal + PendingEditApprovals into DepositForm and WithdrawalForm

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — verify all 6 todos done, every Acceptance criterion's grep/tsc command re-run and green, no Must-NOT-have violated
- [ ] F2. Code quality review — npx tsc --noEmit clean; new code follows existing style (functional components, useApp, addAuditLog, updateRow pattern); no duplicated logic beyond what plan states
- [ ] F3. Real manual QA — via playwright: login as Admin (bendahara), input Setoran Rp 5.000, verify Disetujui + balance +5.000; click Edit → change to 10.000; verify hasPendingEdit badge; login as Super Admin (kepsek), approve edit; verify balance +10.000 total and badge gone; test Penarikan edit downward (balance decrease) and negative-balance guard rejection; test reject flow keeps original amount
- [ ] F4. Scope fidelity — confirm date/time never editable, no separate history table added, no bulk edit, no Potongan Bulanan edit, no new deps, existing new-transaction approval flow untouched

## Commit strategy
One commit per todo, conventional messages:
1. `feat(types): add hasPendingEdit and editRequest to Transaction`
2. `feat(db): migration 003 add has_pending_edit + edit_request columns`
3. `feat(context): add requestEditTransaction, approveEditTransaction, rejectEditTransaction`
4. `feat(components): add TransactionEditModal`
5. `feat(components): add PendingEditApprovals panel`
6. `feat(ui): wire TransactionEditModal + PendingEditApprovals into DepositForm and WithdrawalForm`

## Success criteria
- [ ] Transaction type extended with hasPendingEdit and editRequest fields
- [ ] Supabase migration 003 exists and can be applied
- [ ] requestEditTransaction allows any non-demo staff to request edit for Setoran/Penarikan
- [ ] approveEditTransaction allows only Super Admin/Developer to approve + recalculate balance
- [ ] rejectEditTransaction allows only Super Admin/Developer to reject with reason
- [ ] TransactionEditModal renders edit form with amount + reason fields only (no date)
- [ ] PendingEditApprovals renders list of pending edits with approve/reject buttons
- [ ] DepositForm and WithdrawalForm show edit button on Disetujui rows without pending edit
- [ ] Pending edit badge shown on rows with hasPendingEdit===true
- [ ] PendingEditApprovals panel visible in both DepositForm and WithdrawalForm
- [ ] Audit log entries created for request, approve, and reject actions
- [ ] Balance recalculation correct: Setoran diff added, Penarikan diff subtracted
- [ ] Guard: Penarikan edit resulting in negative balance → approve returns error, no change
- [ ] TypeScript compiles without errors (tsc --noEmit)
- [ ] No new npm dependencies added
- [ ] All existing functionality (create, approve new transactions) remains intact
