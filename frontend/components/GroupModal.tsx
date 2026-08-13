"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/utils/api";
import { useToast } from "@/context/ToastContext";

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface Contact {
  id: number;
  owner_id: number;
  contact_user_id: number;
  contact_user: User;
}

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: number) => void;
}

export default function GroupModal({ isOpen, onClose, onSelectConversation }: GroupModalProps) {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
      setGroupName("");
      setSelectedIds([]);
      setSearchQuery("");
      setError(null);
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Contact[]>("/contacts");
      setContacts(data);
    } catch (err: any) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContact = (userId: number) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = groupName.trim();
    if (!name) {
      setError("Group name is required");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Please select at least one contact to add to the group");
      return;
    }

    setSubmitLoading(true);
    try {
      const groupConv = await apiFetch<{ id: number }>("/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          member_ids: selectedIds,
        }),
      });
      showToast(`Group "${name}" created successfully!`, "success");
      onSelectConversation(groupConv.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create group");
      showToast(err.message || "Failed to create group", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    const user = c.contact_user;
    if (!user) return false;
    const query = searchQuery.toLowerCase();
    return (
      user.display_name.toLowerCase().includes(query) ||
      user.username.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-md font-bold text-slate-900 dark:text-white">Create Group</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Group Details */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3 flex-shrink-0">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 transition-colors"
              />
            </div>
            
            {error && (
              <div className="rounded-lg border bg-red-950/30 border-red-500/30 text-red-400 p-2.5 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Search Contacts
              </label>
              <div className="relative flex items-center rounded-lg bg-slate-100 dark:bg-slate-950 px-3 py-1.5 border border-slate-200 dark:border-slate-800 focus-within:border-blue-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="mr-2 h-3.5 w-3.5 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter contact selection"
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Members Multi-select List */}
          <div className="flex-1 overflow-y-auto p-4">
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Members ({selectedIds.length} selected)
            </span>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {contacts.length === 0 ? "Add contacts first to start a group." : "No matching contacts found."}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredContacts.map((c) => {
                  const contactUser = c.contact_user;
                  if (!contactUser) return null;
                  const isChecked = selectedIds.includes(contactUser.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleToggleContact(contactUser.id)}
                      className={`flex items-center justify-between rounded-lg p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border transition-all ${
                        isChecked ? "border-blue-500/40 bg-blue-500/5 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-9 w-9 overflow-hidden rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
                          {contactUser.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={contactUser.avatar_url}
                              alt={contactUser.display_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            contactUser.display_name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">
                            {contactUser.display_name}
                          </h4>
                          <p className="text-[10px] text-slate-500 truncate">
                            @{contactUser.username}
                          </p>
                        </div>
                      </div>
                      
                      {/* Checkbox circle styling */}
                      <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center transition-all ${
                        isChecked ? "border-blue-500 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"
                      }`}>
                        {isChecked && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2.5 h-2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading || !groupName.trim() || selectedIds.length === 0}
              className="rounded-lg bg-blue-600 px-4.5 py-2 text-xs font-bold text-white transition-all hover:bg-blue-500 active:scale-95 disabled:bg-blue-800 disabled:opacity-50"
            >
              {submitLoading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
