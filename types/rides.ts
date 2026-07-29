export type RideStatus =
  | "scheduled"
  | "boarding"
  | "in_progress"
  | "completed"
  | "cancelled"
  | string;

export interface AppwriteDocumentBase {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
  $databaseId?: string;
  $collectionId?: string;
}

export interface RideRoute extends AppwriteDocumentBase {
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
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RideStop extends AppwriteDocumentBase {
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
  createdAt: string;
  updatedAt: string;
}

export interface Ride extends AppwriteDocumentBase {
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
  externalReference?: string;
  departureTime: string;
  estimatedArrivalTime: string;
  fare: number;
  currency: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  status: RideStatus;
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
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RideListItem extends Ride {
  route: RideRoute | null;
}

export interface RideDetails extends RideListItem {
  stops: RideStop[];
}

export interface RideListResult {
  rides: RideListItem[];
  fromCache: boolean;
}

export interface RideDetailsResult {
  ride: RideDetails;
  fromCache: boolean;
}
