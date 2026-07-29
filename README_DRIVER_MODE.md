# Nookly Driver Mode — Batch 1

This batch introduces `driver` as a first-class Nookly user mode.

## Included

### Mobile
- Driver-only protected tab group
- Driver dashboard
- Assigned rides
- Active trip controls
- Foreground live-location publishing
- Passenger manifest
- Driver profile and vehicle details
- Incident reporting
- Correct sign-in routing to `/driver-home`

### Backend
- Driver profile migration fields:
  - `isOnline`
  - `currentRideId`
  - `lastSeenAt`
- Secure `rides-driver-api` Appwrite Function source
- Trusted driver-account provisioning script
- Existing Rides status reader updated to accept backend status `active`

## Security model

Drivers do not self-register from the public sign-up page.

A trusted administrator or organization provisions the account using:

```powershell
node scripts/create-driver-account.mjs
```

The function verifies all three conditions before returning private ride data or
accepting mutations:

1. Authenticated Appwrite user
2. `users.userMode === "driver"`
3. Linked, active and verified `ride_drivers` profile

## Install

Extract the ZIP into the Nookly project root, then run:

```powershell
node apply-nookly-driver-mode.mjs
```

Do not open Expo Go before running the verification command printed by the
installer.

## Deployment sequence after local installation

1. Run `scripts/setup-driver-mode-backend.mjs`.
2. Create and deploy the `rides-driver-api` Appwrite Function.
3. Add the function ID to `.env`.
4. Provision the first driver account.
5. Assign the driver profile ID to a vehicle and ride.
6. Test driver sign-in and active-trip location sharing.
