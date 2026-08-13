"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface Participant {
  id: number;
  conversation_id: number;
  user_id: number;
  role: "member" | "admin";
  joined_at: string;
  user: User;
}

interface Contact {
  id: number;
  owner_id: number;
  contact_user_id: number;
  contact_user: User;
}

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
}

export default function GroupMembersModal({ isOpen, onClose, conversationId }: GroupMembersModalProps) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Participant[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchMembers();
      fetchContacts();
      setShowAddList(false);
      setError(null);
    }
  }, [isOpen, conversationId]);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Participant[]>(`/groups/${conversationId}/members`);
      setMembers(data);
    } catch (err: any) {
      console.error("Failed to fetch group members:", err);
      setError(err.message || "Failed to load members list");
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const data = await apiFetch<Contact[]>("/contacts");
      setContacts(data);
    } catch (err) {
      console.error("Failed to load contacts for group management:", err);
    }
  };

  // Determine if logged-in user is admin of the current group
  const currentUserParticipant = members.find((m) => m.user_id === currentUser?.id);
  const isAdmin = currentUserParticipant?.role === "admin";

  const handleAddMember = async (targetUserId: number) => {
    setError(null);
    setActionLoadingId(targetUserId);
    try {
      await apiFetch(`/groups/${conversationId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: targetUserId }),
      });
      showToast("Group member added successfully!", "success");
      // Refresh roster
      await fetchMembers();
      setShowAddList(false);
    } catch (err: any) {
      setError(err.message || "Failed to add member");
      showToast(err.message || "Failed to add member", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (targetUserId: number) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setError(null);
    setActionLoadingId(targetUserId);
    try {
      await apiFetch(`/groups/${conversationId}/members/${targetUserId}`, {
        method: "DELETE",
      });
      showToast("Group member removed successfully!", "success");
      // Refresh roster
      await fetchMembers();
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
      showToast(err.message || "Failed to remove member", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  // Filter contacts who are not already in the group
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const addableContacts = contacts.filter((c) => c.contact_user && !memberUserIds.has(c.contact_user.id));

  const filteredAddableContacts = addableContacts.filter((c) => {
    const u = c.contact_user;
    const q = searchQuery.toLowerCase();
    return u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <h3 className="text-md font-bold text-slate-900 dark:text-white">
            {showAddList ? "Add Member" : "Group Members"}
          </h3>
          <div className="flex gap-2">
            {isAdmin && !showAddList && (
              <button
                onClick={() => setShowAddList(true)}
                className="flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold px-2.5 py-1.5 transition-colors active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Member
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-lg border bg-red-950/30 border-red-500/30 text-red-400 p-2.5 text-xs text-center flex-shrink-0">
            {error}
          </div>
        )}

        {/* Add members panel view */}
        {showAddList ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filter Search */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex-shrink-0">
              <div className="relative flex items-center rounded-lg bg-slate-100 dark:bg-slate-950 px-3 py-1.5 border border-slate-200 dark:border-slate-800 focus-within:border-blue-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="mr-2 h-3.5 w-3.5 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts to add"
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAddableContacts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  {addableContacts.length === 0 ? "All of your contacts are already in this group." : "No matching contacts found."}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredAddableContacts.map((c) => {
                    const u = c.contact_user;
                    const isProcessing = actionLoadingId === u.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => !isProcessing && handleAddMember(u.id)}
                        className={`flex items-center justify-between rounded-lg p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border border-transparent transition-all ${
                          isProcessing ? "opacity-55 pointer-events-none" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-9 w-9 overflow-hidden rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
                            {u.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.avatar_url} alt={u.display_name} className="h-full w-full object-cover" />
                            ) : (
                              u.display_name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">{u.display_name}</h4>
                            <p className="text-[10px] text-slate-500 truncate">@{u.username}</p>
                          </div>
                        </div>

                        <button
                          disabled={isProcessing}
                          className="rounded-lg bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40"
                        >
                          {isProcessing ? "Adding..." : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowAddList(false)}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 transition-colors"
              >
                Back to Members
              </button>
            </div>
          </div>
        ) : (
          /* Members list panel view */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {members.map((member) => {
                    const memberUser = member.user;
                    if (!memberUser) return null;
                    const isMemberAdmin = member.role === "admin";
                    const isMe = memberUser.id === currentUser?.id;
                    const isProcessing = actionLoadingId === memberUser.id;
                    
                    return (
                      <div
                        key={member.id}
                        className={`flex items-center justify-between rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800/40 border border-transparent transition-all ${
                          isProcessing ? "opacity-55" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-9 w-9 overflow-hidden rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white">
                            {memberUser.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={memberUser.avatar_url}
                                alt={memberUser.display_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              memberUser.display_name.substring(0, 2).toUpperCase()
                            )}
                            {memberUser.is_online && (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-green-500"></span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate flex items-center gap-1.5">
                              <span>{memberUser.display_name}</span>
                              {isMe && <span className="text-[9px] text-slate-500 font-semibold">(You)</span>}
                            </h4>
                            <p className="text-[10px] text-slate-500 truncate">
                              @{memberUser.username}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isMemberAdmin ? (
                            <span className="rounded-full bg-blue-950/50 border border-blue-500/30 px-2.5 py-0.5 text-[9px] font-bold text-blue-400 select-none">
                              Admin
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 px-2.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400 select-none">
                              Member
                            </span>
                          )}

                          {/* Show remove option if current user is admin and target member is not admin */}
                          {isAdmin && !isMemberAdmin && (
                            <button
                              onClick={() => !isProcessing && handleRemoveMember(memberUser.id)}
                              disabled={isProcessing}
                              title="Remove member"
                              className="rounded-full p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-all active:scale-95 disabled:opacity-40"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end flex-shrink-0">
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 transition-colors animate-fade-in"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
