// hooks/useSearch.ts
import { useState, useEffect } from "react";
import { databases, config } from "@/lib/appwrite";
import { Query } from "react-native-appwrite";

export const useSearch = (searchQuery: string) => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery || searchQuery.trim() === "") {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queries = [
          Query.search("title", searchQuery),
          Query.equal("isAvailable", true),
          Query.limit(20),
        ];

        const result = await databases.listDocuments(
          config.databaseId!,
          config.propertiesCollectionId!,
          queries
        );

        setResults(result.documents);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search properties");
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return { results, loading, error };
};