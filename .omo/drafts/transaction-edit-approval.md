---
slug: transaction-edit-approval
status: approved
intent: clear
review_required: false
pending-action: write .omo/plans/transaction-edit-approval.md
approach: Extend Transaction type with hasPendingEdit + editRequest fields; add 3 context functions (requestEditTransaction, approveEditTransaction, rejectEditTransaction); add TransactionEditModal + PendingEditApprovals shared components used in both DepositForm and WithdrawalForm; balance auto-recalculate on approve; audit trail for all 3 actions.
---

# Draft: transaction-edit-approval

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
C1 | Transaction type + Supabase schema extended with edit fields | active | src/types.ts:62, supabase/migrations/001_initial_schema.sql:84
C2 | AppContext: 3 new functions for request/approve/reject edit | active | src/context/AppContext.tsx:680,883,1069,1722
C3 | TransactionEditModal shared component | active | src/components/DepositForm.tsx:23, src/components/WithdrawalForm.tsx:29
C4 | PendingEditApprovals shared component | active | src/components/WithdrawalForm.tsx:598
C5 | Wire edit buttons + approval panels into DepositForm + WithdrawalForm | active | src/components/DepositForm.tsx, src/components/WithdrawalForm.tsx

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
Edit request scope = amount + reason only (not student, not type, not date) | User confirmed: keterangan bisa di-edit, tanggal/jam tidak | User decision | Yes
Status stays 'Disetujui' with hasPendingEdit flag | User confirmed: "has pending edit" | User decision | Yes
Super Admin approve/reject in same UI | User confirmed: "super admin approve di ui yang sama dan ada reject dengan alasan" | User decision | Yes
Audit trail via existing addAuditLog (update only, no separate edit-history table) | User confirmed: "hanya update" | User decision | Yes
Balance auto-recalculate on approve | User confirmed: "saldo siswa auto berubah dan recalculate" | User decision | Yes
No test runner installed | QA via tsc --noEmit + browser verification | package.json has no vitest/jest | Yes
editRequest stored as JSONB column | Supabase handles nested JSON; db.ts auto-converts keys | Existing pattern | Yes

## Findings (cited - path:lines)
- Transaction interface: src/types.ts:62-87 — has amount, reason, status, approvedByAdmin, etc. No edit fields.
- TransactionStatus: src/types.ts:55-60 — 'Disetujui' | 'Menunggu Persetujuan' | 'Menunggu Approval Admin' | 'Menunggu Approval Super Admin' | 'Ditolak'
- addDeposit: src/context/AppContext.tsx:680-801 — Setoran auto-approved, balance immediately updated (line 718)
- requestWithdrawal: src/context/AppContext.tsx:803-881 — 2-tier approval, balance NOT deducted until approved
- approveWithdrawal: src/context/AppContext.tsx:883-1067 — balance deducted on final approval (line 1003)
- rejectWithdrawal: src/context/AppContext.tsx:1069-1116 — sets status 'Ditolak' + rejectionReason
- addAuditLog: src/context/AppContext.tsx:423-438 — creates AuditLogItem + insertRow
- Context value object: src/context/AppContext.tsx:1722-1777 — where new functions must be added
- DepositForm: src/components/DepositForm.tsx:23-381 — form + lastSuccessTransaction card, no history table for deposits
- WithdrawalForm: src/components/WithdrawalForm.tsx:29-792 — form + approval queue (598-681) + history table (684-759) + reject modal (761-789)
- db.ts toDbRow/fromDbRow: src/lib/db.ts:24-43 — auto camelCase↔snake_case conversion
- Supabase transactions table: supabase/migrations/001_initial_schema.sql:84-109 — no edit columns
- No test runner: package.json — only "lint": "tsc --noEmit"

## Decisions (with rationale)
1. New fields on Transaction: hasPendingEdit?: boolean + editRequest?: object — minimal extension, no separate table
2. editRequest shape: { requestedById, requestedByName, requestedByRole, requestedAt, oldAmount, newAmount, oldReason, newReason, rejectionReason? } — captures who/when/what for audit
3. Supabase: add has_pending_edit BOOLEAN + edit_request JSONB columns via migration 003
4. requestEditTransaction: any non-demo staff role can request. Sets hasPendingEdit=true + editRequest. Does NOT change amount/reason/balance yet.
5. approveEditTransaction: only Super Admin/Developer. Applies diff to balance. Setoran: balance += (new-old). Penarikan: balance -= (new-old). Guard: Penarikan resulting balance < 0 → reject.
6. rejectEditTransaction: only Super Admin/Developer. Clears hasPendingEdit + editRequest. Original amount/reason untouched.
7. Shared components: TransactionEditModal (edit form) + PendingEditApprovals (approval panel) — used in both DepositForm and WithdrawalForm
8. Edit button: pencil icon in history table rows where status==='Disetujui' && !hasPendingEdit
9. Pending edit badge: amber badge in row where hasPendingEdit===true
10. No test framework — QA via tsc --noEmit + Playwright browser verification

## Scope IN
- Extend Transaction interface with hasPendingEdit + editRequest fields
- Supabase migration 003 for new columns
- 3 new AppContext functions: requestEditTransaction, approveEditTransaction, rejectEditTransaction
- TransactionEditModal shared component
- PendingEditApprovals shared component
- Wire edit buttons into DepositForm history + WithdrawalForm history tables
- Wire PendingEditApprovals panel into both forms
- Balance recalculation on approve
- Audit log entries for all 3 actions
- AppContextType interface update

## Scope OUT (Must NOT have)
- No editing of transaction date/time (user: "tanggal dan jam tidak bisa")
- No editing of student, type, or transactionNumber
- No separate edit-history table (user: "hanya update")
- No new dependencies/test frameworks
- No changes to existing approval flow for new transactions
- No bulk edit functionality
- No edit for 'Potongan Bulanan' auto-transactions (only Setoran + Penarikan manual)

## Open questions
(none — all resolved by user answers)

## Approval gate
status: approved
<!-- User approved on 2026-08-03 with "approve lakukan plannya" -->
