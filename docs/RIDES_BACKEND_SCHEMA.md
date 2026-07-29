# Nookly Rides backend schema

## Collections

| Collection ID | Purpose | Client access |
|---|---|---|
| `ride_drivers` | Verified driver profiles and private compliance data | Server only |
| `ride_vehicles` | Registered vehicles and private compliance data | Server only |
| `ride_routes` | Institution-specific transport routes | Authenticated read; server writes |
| `ride_stops` | Ordered pickup/drop-off points | Authenticated read; server writes |
| `rides` | Scheduled and active trip records plus latest location | Authenticated read; server writes |
| `ride_bookings` | Student seat reservations | Document-level access added by backend functions |
| `ride_locations` | Historical GPS trail | Server only |
| `ride_incidents` | Student/driver incident reports | Document-level access added by backend functions |
| `ride_events` | Status and notification audit history | Server only |

## Security model

The setup script deliberately prevents direct client writes to every rides
collection. Mobile applications may read public route, stop, and scheduled ride
data. Sensitive driver, vehicle compliance, booking, GPS history, incident, and
audit records remain server-only. All mutations must go through trusted Appwrite
Functions.

This prevents a student from:

- increasing a ride's available seats;
- booking as another student;
- changing a driver's location;
- marking themselves as boarded;
- creating a fake verified driver or vehicle;
- completing or cancelling an organization ride.

Private collections have collection-level reads disabled. Mobile and organization
clients access them through backend functions that validate the authenticated
student, driver, or organization before returning any data. Safe driver and
vehicle display fields are copied onto the public `rides` document.

## Allowed status values

### Driver

- `active`
- `inactive`
- `suspended`

### Driver verification

- `pending`
- `verified`
- `rejected`
- `expired`

### Vehicle

- `active`
- `maintenance`
- `inactive`
- `suspended`

### Ride

- `scheduled`
- `boarding`
- `active`
- `delayed`
- `completed`
- `cancelled`

### Booking

- `reserved`
- `confirmed`
- `boarded`
- `completed`
- `cancelled`
- `missed`

### Payment

- `unpaid`
- `paid`
- `waived`
- `refunded`

### Incident

- `open`
- `acknowledged`
- `investigating`
- `resolved`
- `dismissed`

## Backend functions to build next

1. `rides-create-booking`
2. `rides-cancel-booking`
3. `rides-list-my-bookings`
4. `rides-driver-access`
5. `rides-start-trip`
6. `rides-update-location`
7. `rides-update-status`
8. `rides-report-incident`
9. `rides-organization-admin`

The booking function must validate capacity and update `bookedSeats` and
`availableSeats` on the server. The location function must authenticate the
assigned driver, reject impossible coordinates, update the latest location on
the `rides` document, and append a historical record to `ride_locations`.
