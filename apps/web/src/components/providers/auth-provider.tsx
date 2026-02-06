"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type AuthSession, useAuthSessionQuery } from "@/lib/auth-queries";

interface AuthContextType {
  session: AuthSession | null;
  isPending: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, error } = useAuthSessionQuery();
  const router = useRouter();
  const resolvedSession = session ?? null;

  // Refresh router when auth state changes
  useEffect(() => {
    if (!isPending) {
      router.refresh();
    }
  }, [resolvedSession, isPending, router]);

  return (
    <AuthContext.Provider value={{ session: resolvedSession, isPending, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
