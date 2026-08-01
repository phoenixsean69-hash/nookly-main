// services/location.service.ts
import { config, databases } from "@/lib/appwrite";
import { Query } from "react-native-appwrite";

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#6366F1"];

export interface PopularLocation {
  id: string;
  name: string;
  propertyCount: number;
  color: string;
}

function extractCity(address: string): string {
  if (!address) return "Other";
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return "Other";
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

export const locationService = {
  async getPopularLocations(limit = 4): Promise<PopularLocation[]> {
    const res = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.equal("isAvailable", true), Query.limit(100), Query.select(["$id", "address"])]
    );

    const counts: Record<string, { count: number; originalName: string }> = {};
    res.documents.forEach((doc: any) => {
      const city = extractCity(doc.address || "");
      const key = city.toLowerCase();
      if (!counts[key]) counts[key] = { count: 0, originalName: city };
      counts[key].count += 1;
    });

    return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item, i) => ({
        id: `loc-${i}`,
        name: item.originalName,
        propertyCount: item.count,
        color: COLORS[i % COLORS.length],
      }));
  },

  // THIS WAS MISSING / BROKEN
  async getPropertiesByCity(city: string) {
    if (!city) return [];
    try {
      // search in address field - "Harare" matches "19887, Damofalls, Ruwa, Harare"
      const res = await databases.listDocuments(
        config.databaseId!,
        config.propertiesCollectionId!,
        [Query.equal("isAvailable", true), Query.search("address", city), Query.limit(50)]
      );
      return res.documents;
    } catch (e: any) {
      // If you didn't create fulltext index yet, fallback to fetching and filtering client-side
      console.log("Search failed, using fallback filter", e.message);
      const res = await databases.listDocuments(
        config.databaseId!,
        config.propertiesCollectionId!,
        [Query.equal("isAvailable", true), Query.limit(100), Query.select(["$id", "address", "propertyName", "type", "price", "image1"])]
      );
      return res.documents.filter((doc: any) => {
        const addr = (doc.address || "").toLowerCase();
        return addr.includes(city.toLowerCase());
      });
    }
  },
};

export default locationService;