// types.ts or lib/types.ts
export interface Property {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  name: string;
  address: string;
  price: number;
  rating: number;
  image: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  type: string;
  description: string;
  facilities: string[];
  gallery?: any[];
  agent?: any;
  reviews?: any[];
}

export interface Agent {
  $id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Review {
  $id: string;
  rating: number;
  review: string;
  user?: any;
}
