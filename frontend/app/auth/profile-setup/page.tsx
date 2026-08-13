"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const AVATAR_PRESETS = [
  "Felix",
  "Aneka",
  "Jack",
  "Midnight",
  "Buster",
  "Toby",
  "Bella",
  "Coco",
];

export default function ProfileSetup() {
  const { user, updateUser, loading } = useAuth();
  const router = useRouter();
  
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/auth/register");
      } else {
        setDisplayName(user.display_name || "");
        // Set default selected avatar
        if (user.avatar_url) {
          setSelectedAvatar(user.avatar_url);
        } else {
          setSelectedAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`);
        }
      }
    }
  }, [user, loading, router]);

  const handleAvatarSelect = (seed: string) => {
    setSelectedAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!displayName.trim()) {
      setError("Display name cannot be empty");
      return;
    }

    setUpdating(true);
    try {
      await updateUser(displayName.trim(), selectedAvatar);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to update profile settings");
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Set Up Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Choose how you appear to others on Signal
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="flex flex-col items-center gap-4">
            {/* Selected Avatar Preview */}
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-blue-500 bg-slate-950 shadow-inner flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                alt="Selected Avatar"
                className="h-20 w-20 object-cover"
              />
            </div>
            
            <div className="w-full">
              <label htmlFor="displayName" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alice Smith"
                className="relative block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder-slate-500 outline-none focus:border-blue-600 transition-colors text-sm"
              />
            </div>
          </div>

          {/* Avatar Presets Selection */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Choose an Avatar Preset
            </span>
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_PRESETS.map((seed) => {
                const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                const isSelected = selectedAvatar === url;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => handleAvatarSelect(seed)}
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 hover:bg-slate-800 transition-all border-2 ${
                      isSelected ? "border-blue-500 scale-105" : "border-slate-800"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={seed}
                      className="h-10 w-10 object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={updating}
            className="group relative flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500 active:scale-95 disabled:bg-blue-800 disabled:opacity-50"
          >
            {updating ? "Saving..." : "Finish Profile Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
