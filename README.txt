NOOKLY APPWRITE OPTIMISATION — STEP 3

RUN FROM THE PROJECT ROOT:

powershell -ExecutionPolicy Bypass -File .\apply-step-3.ps1

THE SCRIPT UPDATES:
- app/(root)/(tabs)/tenantHome.tsx
- app/(root)/(tabs)/explore.tsx

IT CREATES BACKUPS:
- tenantHome.tsx.step3.bak
- explore.tsx.step3.bak

CHANGES

TENANT HOME
- Removes the forced second property request after a filter/cache-key change.
- useAppwrite now loads the matching persistent cache automatically.
- A database request occurs only when that query has no cache or the watched
  properties collection changed.

EXPLORE
- Removes the forced request that ran on the initial mount.
- Removes the forced request that ran after every filter change.
- Removes the separate lightweight map-pin query.
- Uses the already-loaded full map property data for the map count.
- Keeps the full map fallback load when map data genuinely does not exist.

EXPECTED CALL REDUCTION
- Tenant filter change: from as many as 2 property requests to at most 1.
- Explore initial load: removes the second forced filtered-properties request.
- Explore filter change: from as many as 2 requests to at most 1.
- Explore map data: removes one complete Appwrite property query.

PUSH NOTIFICATIONS
- No push registration, token, notification API, function or navigation file
  is changed.

AFTER THE SCRIPT FINISHES:

npx tsc --noEmit
