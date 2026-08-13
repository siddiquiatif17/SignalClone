"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const { registerUser, loginUser } = useAuth();
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [phoneOrUsername, setPhoneOrUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!phoneOrUsername.trim()) {
      setError("Phone number or username is required");
      return;
    }
    
    if (!isLoginMode && !displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        // Login flow
        await loginUser(phoneOrUsername.trim());
        router.push(`/auth/verify?username=${encodeURIComponent(phoneOrUsername.trim())}`);
      } else {
        // Register flow
        await registerUser(phoneOrUsername.trim(), displayName.trim());
        router.push(`/auth/verify?username=${encodeURIComponent(phoneOrUsername.trim())}`);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        {/* Header Icon */}
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/10 text-blue-500 shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
            {isLoginMode ? "Sign in to Signal" : "Create your account"}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            {isLoginMode ? "Enter your phone or username to continue" : "Join the secure messaging network"}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="phoneOrUsername" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Phone Number or Username
              </label>
              <input
                id="phoneOrUsername"
                name="phoneOrUsername"
                type="text"
                required
                value={phoneOrUsername}
                onChange={(e) => setPhoneOrUsername(e.target.value)}
                placeholder="e.g. +1234567890 or alice"
                className="relative block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 outline-none focus:border-blue-600 transition-colors text-sm"
              />
            </div>

            {!isLoginMode && (
              <div>
                <label htmlFor="displayName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required={!isLoginMode}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alice Smith"
                  className="relative block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 outline-none focus:border-blue-600 transition-colors text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500 active:scale-95 disabled:bg-blue-800 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                isLoginMode ? "Send Verification Code" : "Register & Continue"
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError("");
            }}
            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isLoginMode ? "Need an account? Register instead" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
