// context/AuthContext.tsx
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { ID, Query } from "react-native-appwrite";
import {
  account,
  config,
  databases,
  getDefaultAvatarUrl,
} from "../lib/appwrite";

const createValidAppwriteId = (): string => {
  let id = ID.unique();
  // Keep only valid Appwrite characters and max 36.
  id = id.replace(/[^a-zA-Z0-9\-_]/g, "");
  if (!id) id = "u" + Date.now().toString(36);
  if (!/^[a-zA-Z0-9]/.test(id)) id = "u" + id;
  return id.slice(0, 36);
};

// Define types
export interface User {
  $id: string;
  accountId: string;
  name: string;
  userMode: "tenant" | "landlord";
  email: string;
  phone: string;
  avatar?: string;
  expoPushToken?: string;
}

export interface SignUpData {
  name: string;
  userMode: "tenant" | "landlord";
  email: string;
  phone: string;
  password: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    userData: SignUpData,
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
}

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async (): Promise<void> => {
    try {
      const currentAccount = await account.get();
      if (currentAccount) {
        // Get user details from database
        const userDetails = await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [Query.equal("accountId", currentAccount.$id)],
        );

        if (userDetails.documents.length > 0) {
          setUser(userDetails.documents[0] as unknown as User);
        }
      }
    } catch (error) {
      console.log("No user logged in");
    } finally {
      setIsLoading(false);
    }
  };

  // context/AuthContext.tsx (updated signUp with better error handling)
  const signUp = async (
    userData: SignUpData,
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      console.log("Starting signup process for:", userData.email);
      const avatarUrl = userData.avatar?.trim() || getDefaultAvatarUrl(userData.name);

      // Validate inputs
      if (
        !userData.email ||
        !userData.password ||
        !userData.name ||
        !userData.phone
      ) {
        return { success: false, error: "Please fill in all required fields" };
      }

      // Create account in Appwrite Auth
      const accountId = createValidAppwriteId();
      console.log("Creating Appwrite account with ID:", accountId);

      let newAccount;
      try {
        newAccount = await account.create(
          accountId,
          userData.email,
          userData.password,
          userData.name,
        );
        console.log("Account created successfully:", newAccount.$id);
      } catch (authError: any) {
        console.error("Auth creation error:", authError);

        // Handle specific Appwrite errors
        if (authError.code === 409) {
          return {
            success: false,
            error:
              "Email already exists. Please use a different email or sign in.",
          };
        } else if (authError.code === 400) {
          return {
            success: false,
            error:
              "Invalid email or password format. Password must be at least 8 characters.",
          };
        } else {
          return {
            success: false,
            error:
              authError.message || "Failed to create authentication account",
          };
        }
      }

      if (!newAccount) {
        return {
          success: false,
          error: "Failed to create account - no response from server",
        };
      }

      // Create user document in database
      try {
        const documentId = createValidAppwriteId();
        console.log("Creating user document with ID:", documentId);

        const userDocument = await databases.createDocument(
          config.databaseId!,
          config.usersCollectionId!,
          documentId,
          {
            accountId: newAccount.$id,
            name: userData.name,
            userMode: userData.userMode,
            email: userData.email,
            avatar: avatarUrl,
            phone: userData.phone,
          },
        );

        console.log("User document created successfully");

        // Sign in the user immediately after signup
        try {
          await account.createEmailPasswordSession(
            userData.email,
            userData.password,
          );
          console.log("Session created successfully");
        } catch (sessionError) {
          console.error("Session creation error:", sessionError);
          // Continue anyway - user can sign in manually
        }

        // Cast and set the user
        const newUser = userDocument as unknown as User;
        setUser(newUser);

        return {
          success: true,
          user: newUser,
        };
      } catch (dbError: any) {
        console.error("Database creation error:", dbError);

        // Clean up: delete the auth account if database creation fails
        try {
          await account.deleteSession("current");
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }

        return {
          success: false,
          error:
            dbError.message ||
            "Failed to create user profile. Please try again.",
        };
      }
    } catch (error: unknown) {
      console.error("Unexpected signup error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during sign up";
      return { success: false, error: errorMessage };
    }
  };

  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await account.createEmailPasswordSession(email, password);
      const currentAccount = await account.get();

      // Get user details from database
      const userDetails = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", currentAccount.$id)],
      );

      if (userDetails.documents.length > 0) {
        setUser(userDetails.documents[0] as unknown as User);
      }

      return { success: true };
    } catch (error: unknown) {
      // Properly type the error
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during sign in";
      return { success: false, error: errorMessage };
    }
  };

  const signOut = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await account.deleteSession("current");
      setUser(null);
      return { success: true };
    } catch (error: unknown) {
      // Properly type the error
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during sign out";
      return { success: false, error: errorMessage };
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};
