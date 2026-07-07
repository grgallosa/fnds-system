import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken, setOnUnauthorized } from "../api/client";

export interface AuthUser {
  userId: string;
  username: string;
  role: "ADMIN" | "TECHNICIAN";
  technicianId?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // If any request comes back 401 mid-session (expired token, JWT secret
  // rotated, account deactivated, etc.), drop back to the login screen
  // immediately instead of leaving the shell rendered while every request
  // silently fails.
  useEffect(() => {
    setOnUnauthorized(() => setUser(null));
    return () => setOnUnauthorized(null);
  }, []);

  // Restore session on refresh by asking the server to verify the stored token.
  useEffect(() => {
    let active = true;
    async function restore() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get<{ user: AuthUser }>("/auth/me");
        if (active) setUser(res.user);
      } catch {
        clearToken();
      } finally {
        if (active) setIsLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      username,
      password,
    });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
