NOOKLY STEP 7 — TENANT TYPESCRIPT FIX

Run from the project root:

node .\apply-step7-tenant-types-fix.mjs

FIXED ERRORS
- TS2322: null values not assignable to TenantWithProfile[]
- TS2677: invalid type predicate for TenantWithProfile

CAUSE
The Step 7 code used map(...), returned null for missing users, then used a
custom type predicate. TypeScript inferred required fields such as phone,
which conflicted with the optional fields in TenantWithProfile.

FIX
- Replaces map(...).filter(...) with reduce<TenantWithProfile[]>.
- Missing user records are skipped without returning null.
- Optional fields explicitly use undefined.
- The returned array is always TenantWithProfile[].

UPDATED
- app/(root)/properties/[id].tsx

BACKUP
- app/(root)/properties/[id].tsx.step7-types-fix.bak

After applying:

npx tsc --noEmit
