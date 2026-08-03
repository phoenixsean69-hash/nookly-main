# Nookly Driver Ride Push Notifications v1

This package integrates Driver Rides with the existing Nookly Push API.

## Notifications added

### New ride request

Recipients:

- Drivers linked to the request's organization
- Driver status is `active`
- Verification status is `verified`
- Institution relationship is `active`, `approved`, `acknowledged`, or `verified`

Push action:

```text
Tap -> open the ride-request quotation screen
```

### Driver offer accepted

Recipient:

- The driver whose offer was accepted

Push action:

```text
Tap -> Driver Rides -> Confirmed
```

### Ride request cancelled

Recipients:

- Drivers who submitted an offer for the request

Push action:

```text
Tap -> Driver Rides -> Offers -> Closed
```

## Security and reliability

- The mobile client does not choose push recipients.
- The Rides Function queues an asynchronous Push API execution.
- A shared secret protects the internal `/rides/event` route.
- Push API rereads and verifies the ride request, offer, ride, driver, and institution rows.
- In-app notification row IDs are deterministic, preventing duplicate pushes.
- A push failure does not roll back a successfully created request, cancellation, or accepted offer.
- Existing Driver Realtime refresh continues updating visible screens.

## Files changed by the installer

```text
functions/rides-driver-api/src/ride-push-events.js
functions/rides-driver-api/src/marketplace-handler.js
functions/rides-driver-api/package.json
app/_layout.tsx
app/(root)/(driver)/driver-rides.tsx
```

## Step 1 — Apply the repository patch

Extract this package into the Nookly project root, then run:

```powershell
node .\apply-driver-rides-push-v1.mjs
```

Validate:

```powershell
npx tsc --noEmit
```

## Step 2 — Create one shared secret

Run in PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
$rng.Dispose()
$secret
```

Keep the generated value private. Do not commit it.

## Step 3 — Configure Nookly Push API

Function:

```text
6a31d988001bf962fb57
```

Add this secret environment variable:

```text
NOOKLY_RIDES_PUSH_SECRET=<the generated secret>
```

The following table variables have working defaults, but may be set explicitly:

```text
NOOKLY_RIDE_DRIVERS_TABLE_ID=ride_drivers
NOOKLY_RIDE_DRIVER_INSTITUTIONS_TABLE_ID=ride_driver_institutions
NOOKLY_RIDE_REQUESTS_TABLE_ID=ride_requests
NOOKLY_RIDE_OFFERS_TABLE_ID=ride_offers
NOOKLY_RIDES_TABLE_ID=rides
```

Deploy:

```text
nookly-push-api-v1.5.0.tar.gz
```

Entrypoint:

```text
src/main.js
```

Build command:

```text
npm install
```

## Step 4 — Configure the Rides Function

Add:

```text
NOOKLY_PUSH_FUNCTION_ID=6a31d988001bf962fb57
NOOKLY_RIDES_PUSH_SECRET=<the same generated secret>
```

Under the Rides Function's dynamic API-key scopes, enable:

```text
execution.write
```

Redeploy the Rides Function after changing variables or scopes.

## Step 5 — Runtime test

With the driver signed in and push token registered:

1. Student creates a ride request.
2. Eligible driver receives **New Ride Request**.
3. Tap it and confirm the quotation screen opens.
4. Driver submits an offer.
5. Student accepts the offer.
6. Driver receives **Your Ride Offer Was Accepted**.
7. Tap it and confirm Driver Rides opens on **Confirmed**.
8. Create another request and offer, then cancel it.
9. Driver receives **Ride Request Cancelled**.
10. Tap it and confirm **Offers → Closed** opens.

No mobile APK rebuild is required.
