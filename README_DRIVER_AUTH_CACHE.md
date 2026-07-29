# Nookly Driver Auth + Cache Hotfix

This batch adds `driver` consistently to the user identity layer.

## Included changes

- Adds Driver to the public account-mode selector.
- Stores `tenantType` and `schoolLocation` during the original sign-up write instead of a second update.
- Adds Driver to the legacy `createUser` helper.
- Replaces the duplicate `AuthContext` implementation with a compatibility facade over Zustand.
- Preserves Driver during AsyncStorage and general cache hydration.
- Adds Driver to the legacy local-database user type.
- Adds Driver to offline user-mode types.
- Prevents stale tenant fields from leaking into Driver or Landlord cache records.

Driver ride profiles remain controlled separately by `ride_drivers`. Selecting Driver during public sign-up creates the Appwrite Auth account and `users` document with `userMode: "driver"`; ride access still requires a verified driver profile and assignments.

## Install

Extract this ZIP into the Nookly project root and run:

```powershell
node apply-nookly-driver-auth-cache-hotfix.mjs
```

Then run the ESLint command printed by the installer.
