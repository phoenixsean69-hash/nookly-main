// types/location.ts
export interface Location {
  id: string;
  name: string;
  propertyCount: number;
  image?: string;
  color?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PopularLocation extends Location {
  color: string; // For UI display
}
