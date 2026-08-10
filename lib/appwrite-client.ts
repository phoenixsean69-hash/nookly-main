import { Client } from "react-native-appwrite";

export const APPWRITE_PLATFORM = "com.shon1123.Nookly";

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.trim();
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID?.trim();

if (!endpoint) {
  throw new Error("Missing EXPO_PUBLIC_APPWRITE_ENDPOINT in the environment.");
}

if (!projectId) {
  throw new Error("Missing EXPO_PUBLIC_APPWRITE_PROJECT_ID in the environment.");
}

/**
 * Single Appwrite Client instance for the mobile application.
 *
 * Authentication sessions belong to this client. Services that need to act
 * as the signed-in user must reuse this instance rather than constructing
 * another Client independently.
 */
export const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setPlatform(APPWRITE_PLATFORM);
