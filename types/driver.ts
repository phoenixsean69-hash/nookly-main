export type DriverVerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "expired";

export type DriverStatus = "active" | "inactive" | "suspended";

export type DriverRideStatus =
  | "scheduled"
  | "boarding"
  | "active"
  | "delayed"
  | "completed"
  | "cancelled";

export interface DriverProfile {
  $id: string;
  organizationId: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  licenceNumber: string;
  licenceExpiry?: string;
  verificationStatus: DriverVerificationStatus;
  rating?: number;
  completedTrips?: number;
  status: DriverStatus;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  isOnline?: boolean;
  currentRideId?: string;
  lastSeenAt?: string;
}

export interface DriverVehicle {
  $id: string;
  organizationId: string;
  driverId?: string;
  registrationNumber: string;
  make: string;
  model: string;
  color: string;
  capacity: number;
  image?: string;
  status: "active" | "maintenance" | "inactive" | "suspended";
  insuranceExpiry?: string;
  fitnessExpiry?: string;
}

export interface DriverRoute {
  $id: string;
  organizationId: string;
  schoolLocation: string;
  institutionId?: string;
  name: string;
  originName: string;
  originLatitude: number;
  originLongitude: number;
  destinationName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  estimatedDurationMinutes: number;
  estimatedDistanceKm: number;
  defaultFare: number;
  currency: string;
  description?: string;
  isActive: boolean;
}

export interface DriverStop {
  $id: string;
  routeId: string;
  organizationId: string;
  name: string;
  latitude: number;
  longitude: number;
  stopOrder: number;
  estimatedArrivalOffsetMinutes: number;
  isPickup: boolean;
  isDropoff: boolean;
  isActive: boolean;
}

export interface DriverRide {
  $id: string;
  organizationId: string;
  schoolLocation: string;
  institutionId?: string;
  routeId: string;
  driverId: string;
  vehicleId: string;
  driverName: string;
  driverAvatar?: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleCapacity: number;
  departureTime: string;
  estimatedArrivalTime: string;
  fare: number;
  currency: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  status: DriverRideStatus;
  bookingOpen: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  currentHeading?: number;
  currentSpeedKph?: number;
  currentAccuracyMeters?: number;
  lastLocationAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  route?: DriverRoute | null;
}

export interface DriverBooking {
  $id: string;
  rideId: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  pickupStopId: string;
  dropoffStopId: string;
  seatCount: number;
  paymentStatus: string;
  status: string;
  bookingReference: string;
  bookedAt: string;
  boardedAt?: string;
}

export interface DriverRideDetails extends DriverRide {
  route: DriverRoute | null;
  stops: DriverStop[];
  bookings: DriverBooking[];
}

export interface DriverDashboard {
  profile: DriverProfile;
  vehicles: DriverVehicle[];
  activeRide: DriverRide | null;
  upcomingRides: DriverRide[];
  completedTrips: number;
}

export interface DriverLocationInput {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speedKph?: number | null;
  accuracyMeters?: number | null;
  batteryLevel?: number | null;
  networkType?: string | null;
  isMocked?: boolean;
}

export interface DriverIncidentInput {
  category: string;
  description: string;
  latitude?: number;
  longitude?: number;
  priority?: "low" | "medium" | "high" | "critical";
}
