import icons from "./icons";
import images from "./images";

// constants/avatars.ts
export const avatarImages = [
  { id: "human-1", source: require("@/assets/images/human-1.jpg") },
];

// Helper function to get avatar source by ID
export const getAvatarSource = (avatarId: string | null) => {
  if (!avatarId) return avatarImages[0].source;
  const avatar = avatarImages.find((a) => a.id === avatarId);
  return avatar?.source || avatarImages[0].source;
};

export const cards = [
  {
    title: "Card 1",
    location: "Location 1",
    price: "$100",
    rating: 4.8,
    category: "house",
    image: images.dayHouse,
  },
  {
    title: "Card 2",
    location: "Location 2",
    price: "$200",
    rating: 3,
    category: "house",
    image: images.dayHouse,
  },
  {
    title: "Card 3",
    location: "Location 3",
    price: "$300",
    rating: 2,
    category: "flat",
    image: images.dayHouse,
  },
  {
    title: "Card 4",
    location: "Location 4",
    price: "$400",
    rating: 5,
    category: "villa",
    image: images.dayHouse,
  },
];

export const featuredCards = [
  {
    title: "Featured 1",
    location: "Location 1",
    price: "$100",
    rating: 4.8,
    image: images.dayHouse,
    category: "house",
  },
  {
    title: "Featured 2",
    location: "Location 2",
    price: "$200",
    rating: 3,
    image: images.dayHouse,
    category: "flat",
  },
];

export const categories = [
  { title: "All", category: "All" },
  { title: "House", category: "House" },
  { title: "Cottage", category: "Cottage" },
  { title: "Duplex", category: "Duplex" },
  { title: "Luxury", category: "Luxury" },
  { title: "Studio", category: "Studio" },
  { title: "Land", category: "Land" },
  { title: "Apartment", category: "Apartment" },
  { title: "Workplace", category: "Workplace" },
  { title: "Other", category: "Other" },
  { title: "Boarding House", category: "Boarding" },
];

export const facilities = [
  {
    title: "cctv",
    icon: icons.cctv,
  },
  {
    title: "Car Parking",
    icon: icons.carPark,
  },
  {
    title: "Sports Center",
    icon: icons.run,
  },
  {
    title: "B.I.Cs",
    icon: icons.furniture,
  },
  {
    title: "Gym",
    icon: icons.dumbell,
  },
  {
    title: "Swimming pool",
    icon: icons.swim,
  },
  {
    title: "Wifi",
    icon: icons.wifi,
  },
  {
    title: "Pet Center",
    icon: icons.dog,
  },
  {
    title: "Gated",
    icon: icons.walled,
  },
  {
    title: "Solar back Up",
    icon: icons.solar,
  },
  {
    title: "Borehole",
    icon: icons.borehole,
  },
  {
    title: "Tiled",
    icon: icons.tiled,
  },
  {
    title: "Painted",
    icon: icons.painted,
  },
];

export const gallery = [
  {
    id: 1,
    image: images.dayHouse,
  },
  {
    id: 2,
    image: images.dayHouse,
  },
  {
    id: 3,
    image: images.dayHouse,
  },
  {
    id: 4,
    image: images.dayHouse,
  },
  {
    id: 5,
    image: images.dayHouse,
  },
  {
    id: 6,
    image: images.dayHouse,
  },

  {
    id: 7,
    image: images.dayHouse,
  },
  {
    id: 8,
    image: images.dayHouse,
  },
  {
    id: 9,
    image: images.dayHouse,
  },
  {
    id: 10,
    image: images.dayHouse,
  },
  {
    id: 11,
    image: images.dayHouse,
  },
  {
    id: 12,
    image: images.dayHouse,
  },
  {
    id: 13,
    image: images.dayHouse,
  },
  {
    id: 14,
    image: images.dayHouse,
  },
  {
    id: 15,
    image: images.dayHouse,
  },
  {
    id: 16,
    image: images.dayHouse,
  },
  { id: 17, image: images.nightHouse2 },
  {
    id: 18,
    image: images.nightHouse2,
  },
  {
    id: 19,
    image: images.nightHouse2,
  },
  { id: 20, image: images.dayHouse },
  {
    id: 21,
    image: images.dayHouse,
  },
  { id: 22, image: images.dayHouse },
  { id: 23, image: images.dayHouse },
  {
    id: 24,
    image: images.dayHouse,
  },
  {
    id: 25,
    image: images.dayHouse,
  },
  {
    id: 26,
    image: images.dayHouse,
  },
  {
    id: 27,
    image: images.dayHouse,
  },
  {
    id: 28,
    image: images.dayHouse,
  },
  {
    id: 29,
    image: images.dayHouse,
  },
  {
    id: 30,
    image: images.dayHouse,
  },
  {
    id: 31,
    image: images.dayHouse,
  },
  {
    id: 32,
    image: images.dayHouse,
  },
  {
    id: 33,
    image: images.dayHouse,
  },
  {
    id: 34,
    image: images.dayHouse,
  },
];
