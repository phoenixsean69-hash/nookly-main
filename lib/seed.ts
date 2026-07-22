import { ID, Query } from "react-native-appwrite";
import { config, databases } from "./appwrite";
import {
  agentImages,
  galleryImages,
  propertiesImages,
  reviewImages,
} from "./data";

// =============================
// SAMPLE DATA
// =============================

const reviewTexts = [
  "Amazing property, highly recommended!",
  "The agent was very professional and helpful.",
  "Loved the facilities, especially the gym and pool.",
  "Great value for the price, would rent again.",
  "The location could be better, but overall satisfied.",
  "Spacious rooms and modern design, really impressed.",
  "Had some issues with maintenance, but service was responsive.",
  "Perfect for families, safe neighborhood and good schools nearby.",
  "Stylish interiors and well-kept amenities.",
  "Affordable and convenient, exceeded expectations.",
  "Smooth rental process, everything was handled quickly.",
  "The property was spotless and well-maintained.",
  "Excellent communication from the agent throughout.",
  "Quiet neighborhood, ideal for working from home.",
  "Loved the natural lighting in the living room.",
  "The kitchen was modern and fully equipped.",
  "Parking space was a huge plus.",
  "Felt safe and secure, great security features.",
  "The garden was beautiful and well-kept.",
  "Would definitely recommend to friends and family.",
];

const COLLECTIONS = {
  AGENT: config.landlordsCollectionId,
  REVIEWS: config.reviewsCollectionId,
  GALLERY: config.galleriesCollectionId,
  PROPERTY: config.propertiesCollectionId,
};

const propertyTypes = [
  "House",
  "Cottage",
  "Duplex",
  "Luxury",
  "Studio",
  "Land",
  "Apartment",
  "Workplace",
  "Other",
];

const facilities = [
  "Laundry",
  "Car Parking",
  "Sports Center",
  "Cutlery",
  "Gym",
  "Swimming pool",
  "Wifi",
  "Pet Center",
];

// =============================
// HELPERS
// =============================

function getRandomSubset<T>(
  array: T[],
  minItems: number,
  maxItems: number,
): T[] {
  const subsetSize =
    Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;

  const shuffled = [...array].sort(() => 0.5 - Math.random());

  return shuffled.slice(0, subsetSize);
}

// =============================
// SEED FUNCTION
// =============================

async function seed() {
  try {
    // =============================
    // CLEAR EXISTING DATA
    // =============================

    async function clearCollection(collectionId: string) {
      let hasMore = true;

      while (hasMore) {
        const documents = await databases.listDocuments(
          config.databaseId!,
          collectionId,
          [Query.limit(100)],
        );

        if (documents.documents.length === 0) {
          hasMore = false;
          break;
        }

        await Promise.all(
          documents.documents.map((doc) =>
            databases.deleteDocument(config.databaseId!, collectionId, doc.$id),
          ),
        );
      }
    }

    for (const key in COLLECTIONS) {
      const collectionId = COLLECTIONS[key as keyof typeof COLLECTIONS];
      await clearCollection(collectionId!);
    }

    console.log("Cleared all existing data.");

    // =============================
    // SEED landlords
    // =============================

    const landlords = [];

    for (let i = 1; i <= 5; i++) {
      const agent = await databases.createDocument(
        config.databaseId!,
        COLLECTIONS.AGENT!,
        ID.unique(),
        {
          name: `Agent ${i}`,
          email: `agent${i}@example.com`,
          avatar: agentImages[Math.floor(Math.random() * agentImages.length)],
        },
      );

      landlords.push(agent);
    }

    console.log(`Seeded ${landlords.length} landlords.`);

    // =============================
    // SEED REVIEWS
    // =============================

    const reviews = [];

    for (let i = 1; i <= 20; i++) {
      const review = await databases.createDocument(
        config.databaseId!,
        COLLECTIONS.REVIEWS!,
        ID.unique(),
        {
          name: `Reviewer ${i}`,
          avatar: reviewImages[Math.floor(Math.random() * reviewImages.length)],
          review: reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
          rating: parseFloat((Math.random() * 4 + 1).toFixed(1)), // 1.0 - 5.0
        },
      );

      reviews.push(review);
    }

    console.log(`Seeded ${reviews.length} reviews.`);

    // =============================
    // SEED GALLERY IMAGES
    // =============================

    const galleries = [];

    for (const image of galleryImages) {
      const gallery = await databases.createDocument(
        config.databaseId!,
        COLLECTIONS.GALLERY!,
        ID.unique(),
        {
          image1: image,
          image2:
            galleryImages[Math.floor(Math.random() * galleryImages.length)],
          image3:
            galleryImages[Math.floor(Math.random() * galleryImages.length)],
          property: null, // relationship field (Many → One)
        },
      );

      galleries.push(gallery);
    }

    console.log(`Seeded ${galleries.length} galleries.`);

    // =============================
    // SEED PROPERTIES
    // =============================

    for (let i = 1; i <= 20; i++) {
      const assignedAgent =
        landlords[Math.floor(Math.random() * landlords.length)];

      const assignedReviews = getRandomSubset(reviews, 5, 7);

      const selectedFacilities = getRandomSubset(
        facilities,
        2,
        facilities.length,
      ).join(", ");

      // Pick multiple images for property
      const property = await databases.createDocument(
        config.databaseId!,
        COLLECTIONS.PROPERTY!,
        ID.unique(),
        {
          name: `Property ${i}`,
          type: propertyTypes[Math.floor(Math.random() * propertyTypes.length)],
          description:
            reviewTexts[Math.floor(Math.random() * reviewTexts.length)],
          address: `123 Property Street, City ${i}`,

          price: Math.floor(Math.random() * 9000) + 1000,
          area: parseFloat((Math.random() * 3000 + 500).toFixed(2)),
          bedrooms: Math.floor(Math.random() * 5) + 1,
          bathrooms: Math.floor(Math.random() * 5) + 1,
          rating: parseFloat((Math.random() * 4 + 1).toFixed(1)),

          facilities: selectedFacilities,

          image1:
            propertiesImages[
              Math.floor(Math.random() * propertiesImages.length)
            ],
          image2:
            propertiesImages[
              Math.floor(Math.random() * propertiesImages.length)
            ],
          image3:
            propertiesImages[
              Math.floor(Math.random() * propertiesImages.length)
            ],
          agent: assignedAgent.$id,
          reviews: assignedReviews.map((r) => r.$id),
        },
      );

      // ✅ ASSIGN GALLERIES TO THIS PROPERTY
      const assignedGalleries = getRandomSubset(
        galleries,
        3,
        Math.min(6, galleries.length),
      );

      for (const gallery of assignedGalleries) {
        await databases.updateDocument(
          config.databaseId!,
          COLLECTIONS.GALLERY!,
          gallery.$id,
          {
            property: property.$id,
          },
        );
      }

      console.log(`Seeded property: ${property.name}`);
    }

    console.log("Data seeding completed successfully.");
  } catch (error: any) {
    console.error("Error seeding data:", error?.message ?? error);
  }
}

export default seed;
