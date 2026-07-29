# Nookly Driver Mode lint hotfix

Fixes:

- `no-unused-expressions` in `driver-home.tsx`
- `no-unused-expressions` in `driver-rides.tsx`
- missing `loadRide` dependency in `driver-ride-details.tsx`

Extract into the project root and run:

```powershell
node apply-nookly-driver-lint-hotfix.mjs
```
