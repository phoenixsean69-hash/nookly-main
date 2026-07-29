// context/AuthContext.ts
//
// Compatibility facade over the central Zustand auth store.
// This keeps older useAuth() consumers on the same user, mode and cache state
// used by the rest of Nookly instead of creating a second auth session.

import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from "react";

import useAuthStore, {
  type SignUpData,
  type User,
} from "@/store/auth.store";

export type { SignUpData, User } from "@/store/auth.store";

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useStoreAuth = (): AuthContextType => {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const storeSignIn = useAuthStore((state) => state.signIn);
  const storeSignUp = useAuthStore((state) => state.signUp);
  const storeSignOut = useAuthStore((state) => state.signOut);

  return useMemo(
    () => ({
      user,
      isLoading,
      signIn: storeSignIn,
      signUp: async (userData: SignUpData) => {
        const result = await storeSignUp(userData);

        return {
          ...result,
          user: result.success
            ? useAuthStore.getState().user ?? undefined
            : undefined,
        };
      },
      signOut: storeSignOut,
    }),
    [isLoading, storeSignIn, storeSignOut, storeSignUp, user],
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  const storeAuth = useStoreAuth();

  return context ?? storeAuth;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const value = useStoreAuth();

  return React.createElement(AuthContext.Provider, { value }, children);
};
