"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "privacy" | "notifications">("profile");
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial settings
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setAvatarUrl(user.avatar_url || "");
    }
    // Load theme from localStorage
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    if (savedTheme) {
      setThemeState(savedTheme);
    } else {
      setThemeState("dark");
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await updateUser(displayName.trim(), avatarUrl.trim());
      showToast("Profile settings updated successfully!", "success");
      onClose();
    } catch (err: any) {
      showToast(err.message || "Error saving profile", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThemeChange = (newTheme: "dark" | "light") => {
    setThemeState(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    showToast(`Switched to ${newTheme} mode!`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl h-[500px] flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden animate-scale-in">
        
        {/* Navigation Sidebar */}
        <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 flex flex-col gap-1">
          <h2 className="text-sm font-bold tracking-tight text-slate-400 px-2 mb-2 uppercase">Settings</h2>
          
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "profile"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Profile
          </button>
          
          <button
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "appearance"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Appearance
          </button>
          
          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "privacy"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Privacy
          </button>
          
          <button
            onClick={() => setActiveTab("notifications")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "notifications"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Notifications
          </button>

          <div className="mt-auto p-2">
            <button
              onClick={onClose}
              className="w-full text-center px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all text-slate-500 dark:text-slate-400"
            >
              Close Drawer
            </button>
          </div>
        </div>

        {/* Dynamic Panels */}
        <div className="w-2/3 p-6 flex flex-col justify-between overflow-y-auto">
          
          {activeTab === "profile" && (
            <form onSubmit={handleProfileSave} className="flex flex-col gap-4 flex-1">
              <div>
                <h3 className="text-md font-bold text-slate-900 dark:text-slate-100">Edit Profile</h3>
                <p className="text-slate-400 text-xs">Update your display name and avatar details.</p>
              </div>

              <div className="flex items-center gap-4 py-2">
                <img
                  src={avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=placeholder"}
                  alt="Avatar preview"
                  className="w-14 h-14 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/avataaars/svg?seed=placeholder";
                  }}
                />
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Avatar URL</label>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://api.dicebear.com/7.x/avataaars/svg..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-auto w-full py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs font-bold rounded-lg transition-all shadow-md shadow-blue-500/10"
              >
                {isSubmitting ? "Saving changes..." : "Save Settings"}
              </button>
            </form>
          )}

          {activeTab === "appearance" && (
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <h3 className="text-md font-bold text-slate-900 dark:text-slate-100">Appearance Mode</h3>
                <p className="text-slate-400 text-xs">Choose the theme setting for your messaging window.</p>
              </div>

              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => handleThemeChange("dark")}
                  className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    theme === "dark"
                      ? "border-blue-500 bg-blue-500/5 text-blue-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <span className="text-xl">🌙</span>
                  <span className="text-xs font-bold">Dark Theme</span>
                </button>
                <button
                  onClick={() => handleThemeChange("light")}
                  className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    theme === "light"
                      ? "border-blue-500 bg-blue-500/5 text-blue-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <span className="text-xl">☀️</span>
                  <span className="text-xs font-bold">Light Theme</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <h3 className="text-md font-bold text-slate-900 dark:text-slate-100">Privacy (Mocked)</h3>
                <p className="text-slate-400 text-xs">Control your end-to-end security settings.</p>
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <div className="font-bold">Read Receipts</div>
                    <div className="text-[10px] text-slate-400">Show others when you have read their messages.</div>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <div className="font-bold">Screen Lock</div>
                    <div className="text-[10px] text-slate-400">Lock the window access using biometrics or PIN.</div>
                  </div>
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <div className="font-bold">Block List</div>
                    <div className="text-[10px] text-slate-400">Manage contacts you blocked. (0 users)</div>
                  </div>
                  <button className="text-blue-500 font-bold hover:underline">Edit</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <h3 className="text-md font-bold text-slate-900 dark:text-slate-100">Notifications (Mocked)</h3>
                <p className="text-slate-400 text-xs">Configure alerts and message indicators.</p>
              </div>

              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <div className="font-bold">Sound Effects</div>
                    <div className="text-[10px] text-slate-400">Play standard alerts on receiving new messages.</div>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <div className="font-bold">Show Preview Text</div>
                    <div className="text-[10px] text-slate-400">Display name and message snippet in push notifications.</div>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
