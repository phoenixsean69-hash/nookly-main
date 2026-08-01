export type RideRequestStatus =
  | "pending"
  | "quoted"
  | "confirming"
  | "confirmed"
  | "cancelled"
  | "expired"
  | string;

export type RideOfferStatus =
  | "submitted"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired"
  | string;

export type RequestedRideType =
  | "requested_private"
  | "requested_shared";

export interface MarketplaceDocumentBase {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface RideRequest extends MarketplaceDocumentBase {
  organizationId: string;
  studentId: string;
  studentName: string;
  studentPhone?: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  passengerCount: number;
  requestedDepartureTime: string;
  ridePreference: RequestedRideType | string;
  proposedBudget?: number;
  currency: string;
  notes?: string;
  status: RideRequestStatus;
  selectedDriverId?: string;
  selectedOfferId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  offerCount?: number;
}

export interface MarketplaceDriverSummary {
  $id: string;
  name: string;
  avatar?: string;
  rating?: number;
  completedTrips?: number;
  verificationStatus?: string;
}

export interface MarketplaceVehicleSummary {
  $id: string;
  registrationNumber: string;
  make: string;
  model: string;
  color: string;
  capacity: number;
  passengerCapacity?: number;
  availableSeats?: number;
  vehicleType?: string;
  hasAirConditioning?: boolean;
  hasSeatbelts?: boolean;
  allowsLuggage?: boolean;
}

export interface NearbyDriverLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  updatedAt?: string;
  ageSeconds: number;
}

export interface NearbyDriverPricing {
  model?: string;
  baseFare?: number;
  pricePerKm?: number;
}

export interface NearbyDriver extends MarketplaceDriverSummary {
  isOnline: true;
  isDemo: boolean;
  distanceKm: number;
  distanceMeters: number;
  estimatedPickupMinutes: number;
  location: NearbyDriverLocation;
  pricing: NearbyDriverPricing;
  vehicle: MarketplaceVehicleSummary;
}

export interface NearbyDriversResponse {
  radiusKm: number;
  organizationId: string;
  origin: {
    latitude: number;
    longitude: number;
  };
  count: number;
  generatedAt: string;
  drivers: NearbyDriver[];
}

export interface FindNearbyDriversInput {
  latitude: number;
  longitude: number;
}

export interface RideOffer extends MarketplaceDocumentBase {
  requestId: string;
  organizationId: string;
  driverId: string;
  vehicleId: string;
  quotedFare: number;
  currency: string;
  estimatedPickupMinutes: number;
  estimatedJourneyMinutes: number;
  availableSeats: number;
  message?: string;
  status: RideOfferStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  driver?: MarketplaceDriverSummary | null;
  vehicle?: MarketplaceVehicleSummary | null;
  request?: RideRequest | null;
}

export interface StudentRideRequestDetails {
  request: RideRequest;
  offers: RideOffer[];
  confirmedRideId?: string | null;
  bookingId?: string | null;
}

export interface DriverRideRequestDetails {
  request: RideRequest;
  myOffer: RideOffer | null;
  vehicles: MarketplaceVehicleSummary[];
}

export interface CreateRideRequestInput {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  passengerCount: number;
  requestedDepartureTime: string;
  ridePreference: RequestedRideType;
  proposedBudget?: number;
  currency: string;
  notes?: string;
}

export interface SubmitRideOfferInput {
  vehicleId: string;
  quotedFare: number;
  currency: string;
  estimatedPickupMinutes: number;
  estimatedJourneyMinutes: number;
  availableSeats: number;
  message?: string;
}

export interface AcceptRideOfferResult {
  requestId: string;
  offerId: string;
  rideId: string;
  bookingId: string;
}

export interface DriverMarketplaceOverview {
  requests: RideRequest[];
  offers: RideOffer[];
}
