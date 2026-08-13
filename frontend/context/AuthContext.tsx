"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/utils/api";

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  registerUser: (phoneOrUsername: string, displayName: string) => Promise<void>;
  loginUser: (phoneOrUsername: string) => Promise<void>;
  verifyOtp: (phoneOrUsername: string, otp: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  updateUser: (displayName?: string, avatarUrl?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load user session on boot
  useEffect(() => {
    async function loadSession() {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        setToken(storedToken);
        try {
          // Validate token with GET /users/me
          const userData = await apiFetch<User>("/auth/users/me", {
            method: "GET",
          });
          setUser(userData);
        } catch (error) {
          console.error("Session verification failed:", error);
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadSession();
  }, []);

  // Protect routes based on authentication state
  useEffect(() => {
    if (loading) return;

    const isAuthRoute = pathname?.startsWith("/auth");

    if (!user && !isAuthRoute) {
      // Not logged in, accessing dashboard -> redirect to register
      router.push("/auth/register");
    } else if (user && isAuthRoute) {
      // Logged in, accessing auth screens -> check if avatar exists
      if (!user.avatar_url || user.avatar_url.includes("dicebear.com/7.x/avataaars/svg?seed=")) {
        // Let them optionally pick an avatar, or redirect to dashboard
        router.push("/");
      } else {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  const registerUser = async (phoneOrUsername: string, displayName: string) => {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone_or_username: phoneOrUsername,
        display_name: displayName,
      }),
    });
  };

  const loginUser = async (phoneOrUsername: string) => {
    await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        phone_or_username: phoneOrUsername,
      }),
    });
  };

  const verifyOtp = async (phoneOrUsername: string, otp: string) => {
    const data = await apiFetch<{ token: string; user: User }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        phone_or_username: phoneOrUsername,
        otp,
      }),
    });
    
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
    
    // Redirect to profile setup or home dashboard
    router.push("/auth/profile-setup");
  };

  const logoutUser = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/auth/register");
  };

  const updateUser = async (displayName?: string, avatarUrl?: string) => {
    const updatedUser = await apiFetch<User>("/auth/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        display_name: displayName,
        avatar_url: avatarUrl,
      }),
    });
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        registerUser,
        loginUser,
        verifyOtp,
        logoutUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
