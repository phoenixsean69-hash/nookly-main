# Nookly Driver Realtime Sync v1

This adds a central Driver TablesDB realtime bridge.

## Watched tables

```text
ride_drivers
ride_driver_institutions
ride_vehicles
rides
ride_bookings
```

The active Driver screen refreshes through the existing `/dashboard` API when
a readable row changes. This keeps the API as the source of truth instead of
trusting a raw realtime payload.

It also refreshes when:

- A push notification arrives while Nookly is open
- A push notification is opened
- Nookly returns to the foreground
- The internet reconnects

This push fallback is important when Appwrite row permissions intentionally
allow only the server Function to read Driver tables.

## Apply

Extract into the project root and run:

```powershell
node .\apply-driver-realtime-sync-v1.mjs
npx tsc --noEmit
```

No package, Function deployment, or APK rebuild is required.
