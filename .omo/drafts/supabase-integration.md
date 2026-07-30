---
slug: supabase-integration
status: awaiting-approval
intent: clear
review_required: false
pending-action: write .omo/plans/supabase-integration.md
approach: Full Supabase migration - database, auth, RLS, business logic refactor, data seed/migration, deployment to Netlify + Viewer feature for parents
---

# Draft: supabase-integration

## Components (topology ledger)
| id | outcome | status | evidence |
|----|---------|--------|----------|
| C1 | Supabase project + client setup | active | src/lib/supabase.ts, .env config |
| C2 | Database schema (10 tables + migrations) | active | src/types.ts:1-196, all entities |
| C3 | Row Level Security (5 roles × 10 tables) | active | types.ts:6 UserRole, initialUsers:41-50 |
| C4 | Auth migration (Supabase Auth) | active | initialUsers:41-50, AppContext.tsx:169-178 |
| C5 | Business logic refactor (AppContext → Supabase) | active | AppContext.tsx:1-1228, 20+ functions |
| C6 | Data seed/migration + backup/restore | active | initialData.ts:1-283, AppContext.tsx:1118-1172 |
| C7 | Deployment config (Netlify) | active | vite.config.ts, package.json |
| C8 | Viewer feature (parent portal) | active | ViewerPage.tsx:1-277, new auth flow |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|-----------|----------------|-----------|-------------|
| ID strategy | Keep existing format (st-xxx, tr-xxx) | User decision #3 | Yes |
| Auth approach | Supabase Auth (email+password) for admin | User decision #1 | Yes |
| Viewer auth | Custom auth (not Supabase Auth) | Too many parent users | Yes |
| Scope | Full - all 10 tables + viewer feature | User decision #2 + new feature | Yes |
| Deployment | Netlify | User decision #4 | Yes |
| Transaction number generation | DB function with counter table | Standard pattern for sequential numbering | Yes |
| Demo mode | Keep as-is, check `demoMode` flag in auth | Preserves existing UX | Yes |

## Findings (cited - path:lines)
- AppContext.tsx:1228 lines - ALL business logic in single file
- types.ts:196 lines - 15 type definitions, 10 entities
- initialData.ts:283 lines - mock data for 10 entities
- ViewerPage.tsx:277 lines - existing viewer (needs enhancement)
- No backend/server exists - pure SPA
- localStorage: 9 keys for persistence
- Auth: hardcoded initialUsers array, plaintext passwords
- Gemini AI: imported but unused in App.tsx
- 5 roles: Developer, Super Admin, Admin, Wali Kelas, Viewer
- 2-tier approval workflow for withdrawals
- Auto-deduction with debt accumulation logic
- Cross-entity updates (transactions ↔ book_payments)

## Decisions (with rationale)
1. **Supabase Auth over custom auth** - Built-in session management, JWT, RLS integration
2. **Custom auth for viewer** - Too many parent users, simpler to manage
3. **Keep existing ID formats** - Avoid breaking changes in historical data
4. **Full migration scope** - All 10 tables, not phased
5. **Netlify deployment** - User preference, works with Vite
6. **DB function for transaction numbers** - Atomic sequence generation
7. **Edge Functions for complex logic** - runMonthlyDeduction, approveWithdrawal need atomic multi-table operations

## Scope IN
- Supabase project setup + client initialization
- 10 database tables with proper schema
- Row Level Security policies for 5 roles
- Supabase Auth (email+password) replacing mock auth
- AppContext refactor: 20+ functions → Supabase calls
- Seed data migration (initialUsers, initialStudents, etc.)
- Backup/restore adapted to Supabase
- Netlify deployment configuration
- **Viewer feature**: Login parent, change password, view tunggakan buku/SPP, SPP history

## Scope OUT (Must NOT have)
- NO realtime subscriptions (not requested)
- NO Edge Functions for new features (only for migrated logic)
- NO changes to pdfGenerator.ts or excelHandler.ts (they only read state)
- NO changes to admin UI components (only data layer)
- NO new features beyond existing + viewer
- NO database schema changes beyond what types.ts defines + viewer fields
- NO Supabase Auth for viewer (custom auth instead)

## Open questions
None - all owner decisions answered.

## Approval gate
status: awaiting-approval
<!-- Exploration complete. All unknowns resolved. Ready to write plan after explicit okay. -->
