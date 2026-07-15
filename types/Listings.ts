// types/Listing.ts
export interface Listing {
  name: string;
  type: string;
  description: string;
  address: string;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  geolocation: string;
  facilities: string;
  images: string[]; // up to 3 image URLs
}
