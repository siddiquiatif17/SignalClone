"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/utils/api";
import { useToast } from "@/context/ToastContext";

interface User {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface Contact {
  id: number;
  owner_id: number;
  contact_user_id: number;
  contact_user: User;
}

interface ContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: number) => void;
}

export default function ContactsModal({ isOpen, onClose, onSelectConversation }: ContactsModalProps) {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newContactIdentifier, setNewContactIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Fetch contacts on modal open
  useEffect(() => {
    if (isOpen) {
      fetchContacts();
      setMessage(null);
      setNewContactIdentifier("");
      setSearchQuery("");
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

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const identifier = newContactIdentifier.trim();
    if (!identifier) return;

    setAddLoading(true);
    try {
      await apiFetch("/contacts", {
        method: "POST",
        body: JSON.stringify({ contact_identifier: identifier }),
      });
      setMessage({ text: "Contact added successfully!", isError: false });
      showToast(`Contact "${identifier}" added successfully!`, "success");
      setNewContactIdentifier("");
      fetchContacts(); // Reload contacts list
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to add contact", isError: true });
      showToast(err.message || "Failed to add contact", "error");
    } finally {
      setAddLoading(false);
    }
  };

  const handleSelectContact = async (contactUserId: number) => {
    try {
      const conv = await apiFetch<{ id: number }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ contact_user_id: contactUserId }),
      });
      onSelectConversation(conv.id);
      onClose();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to start conversation", isError: true });
      showToast(err.message || "Failed to start conversation", "error");
    }
  };

  if (!isOpen) return null;

  // Filter contacts locally
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
          <h3 className="text-md font-bold text-slate-900 dark:text-white">Start a Chat</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add Contact Input */}
        <form onSubmit={handleAddContact} className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Add Contact
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newContactIdentifier}
              onChange={(e) => setNewContactIdentifier(e.target.value)}
              placeholder="e.g. +1234567890 or username"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-600 transition-colors"
            />
            <button
              type="submit"
              disabled={addLoading || !newContactIdentifier.trim()}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-blue-500 active:scale-95 disabled:bg-blue-800 disabled:opacity-50"
            >
              {addLoading ? "Adding..." : "Add"}
            </button>
          </div>
        </form>

        {/* Success/Error Feedback */}
        {message && (
          <div
            className={`mx-4 mt-3 rounded-lg border p-2.5 text-xs ${
              message.isError
                ? "bg-red-950/30 border-red-500/30 text-red-400"
                : "bg-green-950/30 border-green-500/30 text-green-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Search Contacts */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative flex items-center rounded-lg bg-slate-100 dark:bg-slate-950 px-3 py-1.5 border border-slate-200 dark:border-slate-800 focus-within:border-blue-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="mr-2 h-3.5 w-3.5 text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your contacts"
              className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4">
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Contacts List
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
              {contacts.length === 0 ? "No contacts added yet." : "No matching contacts found."}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((c) => {
                const contactUser = c.contact_user;
                if (!contactUser) return null;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectContact(contactUser.id)}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border border-transparent transition-all active:scale-[0.99]"
                  >
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
                      {contactUser.is_online && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-green-500"></span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">
                        {contactUser.display_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate">
                        @{contactUser.username}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
