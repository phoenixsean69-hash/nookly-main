# Nookly Rides — backend setup

This package targets the existing Nookly mobile repository and its existing
Appwrite database.

## 1. Copy the files

Copy these files into the project without changing their paths:

```text
scripts/setup-rides-backend.mjs
scripts/seed-rides-backend.mjs
docs/RIDES_BACKEND_SCHEMA.md
.env.rides.example
```

## 2. Create a server API key

In Appwrite Console, create an API key for the setup scripts. Give it database
read and write scopes. Keep this key only on your computer or deployment server.
Never use an `EXPO_PUBLIC_` prefix for the key.

## 3. Set terminal environment variables

PowerShell example:

```powershell
$env:EXPO_PUBLIC_APPWRITE_ENDPOINT="https://<REGION>.cloud.appwrite.io/v1"
$env:EXPO_PUBLIC_APPWRITE_PROJECT_ID="YOUR_PROJECT_ID"
$env:EXPO_PUBLIC_APPWRITE_DATABASE_ID="YOUR_DATABASE_ID"
$env:APPWRITE_API_KEY="YOUR_SERVER_API_KEY"
```

The project already contains `node-appwrite`, so no new package is required.

## 4. Create the backend

From the Nookly mobile project root:

```powershell
node scripts/setup-rides-backend.mjs
```

The script is rerunnable. Existing collections, attributes, and indexes are
kept; missing resources are created.

## 5. Add collection IDs to `.env`

```env
EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID=ride_drivers
EXPO_PUBLIC_APPWRITE_RIDE_VEHICLES_COLLECTION_ID=ride_vehicles
EXPO_PUBLIC_APPWRITE_RIDE_ROUTES_COLLECTION_ID=ride_routes
EXPO_PUBLIC_APPWRITE_RIDE_STOPS_COLLECTION_ID=ride_stops
EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID=rides
EXPO_PUBLIC_APPWRITE_RIDE_BOOKINGS_COLLECTION_ID=ride_bookings
EXPO_PUBLIC_APPWRITE_RIDE_LOCATIONS_COLLECTION_ID=ride_locations
EXPO_PUBLIC_APPWRITE_RIDE_INCIDENTS_COLLECTION_ID=ride_incidents
EXPO_PUBLIC_APPWRITE_RIDE_EVENTS_COLLECTION_ID=ride_events
```

Use the same collection IDs in Nookly for Organizations.

## 6. Optional demo data

```powershell
$env:NOOKLY_SEED_ORGANIZATION_ID="YOUR_ORGANIZATION_DOCUMENT_ID"
$env:NOOKLY_SEED_CREATED_BY="YOUR_ACCOUNT_ID"
$env:NOOKLY_SEED_SCHOOL_LOCATION="bindura university of science education"
node scripts/seed-rides-backend.mjs
```

The seed script creates one driver, one vehicle, one route, three stops, one
scheduled ride, and one ride event. Its coordinates and identities are demo
data and should be replaced before production.

## What comes next

After verifying these collections in Appwrite Console, the next backend step is
the trusted booking and driver-location Appwrite Functions. The mobile UI should
not be connected directly to write operations before those functions exist.
