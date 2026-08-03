# Nookly Driver Screen Cache v1

This patch extends the existing persistent account-scoped `profilePageCache`
to Driver Home/Dashboard and Active Ride.

Driver Profile was already using the same persistent cache and is validated by
the installer.

## Behaviour

- Home/Dashboard shows the last successful dashboard immediately.
- Active Ride restores the last ride, route/map data, passengers, and location.
- Profile restores its dashboard and onboarding form.
- Each screen quietly refreshes from the working Driver API.
- Cached data stays visible during temporary network failures.
- Cache entries are separated by signed-in account ID.
- Active Ride writes changing location state at most once every 30 seconds.
- Pull-to-refresh still requests fresh data.

## Apply

Extract this ZIP into the Nookly project root, then run:

```powershell
node .\apply-driver-screen-cache-v1.mjs
npx tsc --noEmit
```

No new package and no APK rebuild are required.
