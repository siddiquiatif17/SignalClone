"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWebSocket } from "@/context/WebSocketContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/utils/api";
import ContactsModal from "@/components/ContactsModal";
import GroupModal from "@/components/GroupModal";
import GroupMembersModal from "@/components/GroupMembersModal";
import { SettingsModal } from "@/components/SettingsModal";
import { CallsPlaceholder, StoriesPlaceholder, DevicesPlaceholder } from "@/components/Placeholders";

interface MessageReceiptRead {
  id: number;
  message_id: number;
  user_id: number;
  status: "sent" | "delivered" | "read";
  updated_at: string;
}

interface UserRead {
  id: number;
  phone_number: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

interface MessageRead {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: string;
  reply_to_id: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  receipts: MessageReceiptRead[];
  sender: UserRead | null;
}

interface ParticipantRead {
  id: number;
  conversation_id: number;
  user_id: number;
  role: string;
  joined_at: string;
  last_read_message_id: number | null;
  user: UserRead;
}

interface ConversationResponseRead {
  id: number;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  sort_timestamp: string;
  unread_count: number;
  last_message: MessageRead | null;
  participants: ParticipantRead[];
}

export default function Home() {
  const { user, logoutUser, loading } = useAuth();
  const { isConnected, presenceMap, subscribe, unsubscribe, sendEvent } = useWebSocket();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState<ConversationResponseRead[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageRead[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "calls" | "stories" | "devices">("chats");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isMobile, setIsMobile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageRead | null>(null);

  // Typing indicators state
  const [typingUsers, setTypingUsers] = useState<Record<number, { is_typing: boolean; name: string }>>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // References for keeping socket listeners in sync without resubscribe
  const selectedConvIdRef = useRef(selectedConvId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
  }, [selectedConvId]);

  // Fetch conversations list
  const fetchConversations = async () => {
    try {
      const data = await apiFetch<ConversationResponseRead[]>("/conversations");
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId: number) => {
    setMessagesLoading(true);
    try {
      const data = await apiFetch<MessageRead[]>(`/conversations/${convId}/messages`);
      setMessages(data);
      
      // Trigger mark as read if there are messages
      if (data.length > 0) {
        const latestMsg = data[data.length - 1];
        markConversationRead(convId, latestMsg.id);
      }
    } catch (err) {
      console.error(`Failed to load messages for conversation ${convId}:`, err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Mark conversation messages as read
  const markConversationRead = async (convId: number, messageId: number) => {
    try {
      await apiFetch(`/conversations/${convId}/read`, {
        method: "POST",
        body: JSON.stringify({ message_id: messageId }),
      });
      
      sendEvent("read", {
        conversation_id: convId,
        message_id: messageId,
      });

      // Clear unread badge in frontend layout
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
    } catch (err) {
      console.error("Failed to mark conversation as read:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Load and apply theme and handle mobile viewports
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Monitor WebSocket connection changes for Toasts
  const prevConnectedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevConnectedRef.current !== null) {
      if (isConnected) {
        showToast("Connected to Signal server", "success");
      } else {
        showToast("Connection lost. Reconnecting...", "warning");
      }
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, showToast]);

  // Load chat logs when active chat switches
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      setTypingUsers({});
    } else {
      setMessages([]);
    }
    
    setNewMessage("");
    if (isTypingRef.current) {
      sendTypingEvent(false);
    }
  }, [selectedConvId]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Emit typing statuses
  const sendTypingEvent = (isTyping: boolean) => {
    if (!selectedConvId) return;
    isTypingRef.current = isTyping;
    sendEvent("typing", {
      conversation_id: selectedConvId,
      is_typing: isTyping,
    });
  };

  const handleComposeChange = (text: string) => {
    setNewMessage(text);
    if (!selectedConvId) return;

    if (!isTypingRef.current) {
      sendTypingEvent(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingEvent(false);
    }, 2500);
  };

  // Setup WS subscribers
  useEffect(() => {
    const handleNewMessage = (event: any) => {
      const msg = event.message as MessageRead;
      
      // If it belongs to the active conversation, append it
      if (msg.conversation_id === selectedConvIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        
        markConversationRead(msg.conversation_id, msg.id);
        
        setTypingUsers((prev) => {
          const updated = { ...prev };
          delete updated[msg.sender_id];
          return updated;
        });
      }
      
      fetchConversations();
    };

    const handleReceiptUpdate = (event: any) => {
      const { message_id, user_id, status } = event;
      
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;
          
          const hasReceipt = msg.receipts.some((r) => r.user_id === user_id);
          let updatedReceipts = [];
          
          if (hasReceipt) {
            updatedReceipts = msg.receipts.map((r) =>
              r.user_id === user_id ? { ...r, status, updated_at: new Date().toISOString() } : r
            );
          } else {
            updatedReceipts = [
              ...msg.receipts,
              {
                id: Math.random(),
                message_id,
                user_id,
                status,
                updated_at: new Date().toISOString(),
              },
            ];
          }
          return { ...msg, receipts: updatedReceipts };
        })
      );
    };

    const handleTyping = (event: any) => {
      const { conversation_id, user_id, is_typing } = event;
      if (conversation_id === selectedConvIdRef.current) {
        const activeConv = conversations.find((c) => c.id === conversation_id);
        const participant = activeConv?.participants.find((p) => p.user_id === user_id);
        const name = participant?.user.display_name || "Someone";
        
        setTypingUsers((prev) => {
          const updated = { ...prev };
          if (is_typing) {
            updated[user_id] = { is_typing, name };
          } else {
            delete updated[user_id];
          }
          return updated;
        });
      }
    };

    subscribe("new_message", handleNewMessage);
    subscribe("receipt_update", handleReceiptUpdate);
    subscribe("typing", handleTyping);
    
    return () => {
      unsubscribe("new_message", handleNewMessage);
      unsubscribe("receipt_update", handleReceiptUpdate);
      unsubscribe("typing", handleTyping);
    };
  }, [subscribe, unsubscribe, conversations]);

  // Post message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedConvId) return;

    const replyId = replyingTo?.id;
    setNewMessage("");
    setReplyingTo(null);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingEvent(false);

    try {
      const createdMsg = await apiFetch<MessageRead>(`/conversations/${selectedConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content,
          reply_to_id: replyId
        }),
      });
      
      setMessages((prev) => {
        if (prev.some((m) => m.id === createdMsg.id)) return prev;
        return [...prev, createdMsg];
      });
      
      fetchConversations();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Format date timestamp nicely
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getFullMessageDateString = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Resolve message status icon
  const getMessageReceiptStatus = (msg: MessageRead, conv: ConversationResponseRead) => {
    if (msg.sender_id !== user?.id) return null;
    
    const otherParticipants = conv.participants.filter((p) => p.user_id !== user?.id);
    if (otherParticipants.length === 0) return "sent";

    const statuses = otherParticipants.map((p) => {
      const r = (msg.receipts ?? []).find((rec) => rec.user_id === p.user_id);
      return r ? r.status : "sent";
    });

    if (statuses.every((s) => s === "read")) return "read";
    if (statuses.every((s) => s === "read" || s === "delivered")) return "delivered";
    return "sent";
  };

  const renderReceiptIcon = (status: "sent" | "delivered" | "read" | null) => {
    if (!status) return null;
    
    if (status === "sent") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      );
    }
    
    if (status === "delivered") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l6-6M9 12.75l3 3m-3-3l3.75-3.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    
    if (status === "read") {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-blue-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l6-6M9 12.75l3 3m-3-3l3.75-3.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    
    return null;
  };

  // Get active conversation details
  const selectedConv = useMemo(() => {
    if (!selectedConvId) return null;
    return conversations.find((c) => c.id === selectedConvId) || null;
  }, [selectedConvId, conversations]);

  // Resolve online presence state for a conversation (direct chats)
  const resolveConversationPresence = (conv: ConversationResponseRead) => {
    if (conv.type === "group") {
      return { is_online: false, last_seen: null };
    }
    
    const otherPart = conv.participants.find((p) => p.user_id !== user?.id);
    if (!otherPart) return { is_online: false, last_seen: null };
    
    const otherUserId = otherPart.user_id;

    if (presenceMap[otherUserId] !== undefined) {
      return presenceMap[otherUserId];
    }
    
    return {
      is_online: otherPart.user.is_online,
      last_seen: otherPart.user.last_seen,
    };
  };

  // Filter conversations locally based on search bar
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const name = c.name || "Unknown Conversation";
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery]);

  // Typing users list string helper
  const typingText = useMemo(() => {
    const typingArr = Object.values(typingUsers);
    if (typingArr.length === 0) return "";
    if (typingArr.length === 1) return `${typingArr[0].name} is typing...`;
    return "Several people are typing...";
  }, [typingUsers]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  const showSidebar = !isMobile || (selectedConvId === null && activeTab === "chats");
  const showRightPane = !isMobile || selectedConvId !== null || activeTab !== "chats";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200">
      {/* LEFT SIDEBAR */}
      <div className={`${showSidebar ? "flex" : "hidden"} w-full md:w-80 flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-3">
            {/* User Avatar */}
            <div
              onClick={() => setIsSettingsOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-md shadow-blue-900/20 overflow-hidden cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            >
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                user?.display_name?.substring(0, 2).toUpperCase() || "ME"
              )}
              {isConnected && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-50 dark:border-slate-900 bg-green-500 animate-pulse"></span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold tracking-wide truncate">{user?.display_name || "Signal User"}</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">@{user?.username}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {/* New Chat Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              title="New Chat"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            {/* New Group Button */}
            <button
              title="New Group"
              onClick={() => setIsGroupModalOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3">
          <div className="relative flex items-center rounded-lg bg-slate-100 dark:bg-slate-950 px-3 py-2 border border-slate-200 dark:border-slate-800 focus-within:border-blue-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="mr-2 h-4 w-4 text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations"
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
            />
          </div>
        </div>

        {/* Conversations List Area */}
        <div className="flex-1 overflow-y-auto px-2">
          {/* Active Navigation Tabs */}
          <div className="mb-2 flex justify-around text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-1">
            <button
              onClick={() => {
                setActiveTab("chats");
                if (isMobile) setSelectedConvId(null);
              }}
              className={`px-1 py-1 transition-colors border-b-2 ${
                activeTab === "chats"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab("calls")}
              className={`px-1 py-1 transition-colors border-b-2 ${
                activeTab === "calls"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Calls
            </button>
            <button
              onClick={() => setActiveTab("stories")}
              className={`px-1 py-1 transition-colors border-b-2 ${
                activeTab === "stories"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Stories
            </button>
            <button
              onClick={() => setActiveTab("devices")}
              className={`px-1 py-1 transition-colors border-b-2 ${
                activeTab === "devices"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Devices
            </button>
          </div>

          {/* Conversations List */}
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              {conversations.length === 0 ? (
                <div>
                  <p className="font-semibold text-slate-400 mb-1">No chats yet</p>
                  <p className="text-[10px]">Click the "+" or group icon above to start chatting.</p>
                </div>
              ) : (
                "No matching conversations found."
              )}
            </div>
          ) : (
            <div className="space-y-0.5 animate-fade-in">
              {filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const { is_online } = resolveConversationPresence(conv);
                const lastMsg = conv.last_message;
                const isGroup = conv.type === "group";
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveTab("chats");
                      setSelectedConvId(conv.id);
                    }}
                    className={`flex items-center gap-3 rounded-lg p-2.5 cursor-pointer border border-transparent transition-all select-none ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                        : "hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 font-bold overflow-hidden border border-slate-200 dark:border-slate-800">
                      {conv.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={conv.avatar_url}
                          alt={conv.name || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : isGroup ? (
                        <div className="flex h-full w-full items-center justify-center bg-blue-600/20 text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.65 18.957a19.733 19.733 0 0113.95-3.722 19.733 19.733 0 0113.95 3.722C18.363 20.124 12 21 12 21s-6.364-.876-7.65-2.043zM16.5 16.25c.98-.326 2.012-.54 3.09-.633a19.548 19.548 0 017.35 1.911c-.41.767-1.127 1.4-2.09 1.831a18.865 18.865 0 00-8.35-3.109z" />
                          </svg>
                        </div>
                      ) : (
                        conv.name?.substring(0, 2).toUpperCase() || "CH"
                      )}
                      
                      {/* Live presence indicator */}
                      {!isGroup && is_online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-50 dark:border-slate-900 bg-green-500"></span>
                      )}
                    </div>

                    {/* Content Preview */}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex justify-between items-baseline">
                        <h4 className={`text-xs font-semibold truncate ${isSelected ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>
                          {conv.name}
                        </h4>
                        <span className={`text-[10px] flex-shrink-0 ml-1 ${isSelected ? "text-blue-200" : "text-slate-400 dark:text-slate-500"}`}>
                          {lastMsg ? formatTime(lastMsg.created_at) : formatTime(conv.updated_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-[11px] truncate mr-2 ${isSelected ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
                          {lastMsg ? lastMsg.content : "No messages yet"}
                        </p>
                        {/* Unread badge */}
                        {conv.unread_count > 0 && (
                          <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                            isSelected ? "bg-white text-blue-600 shadow-sm" : "bg-blue-600 text-white shadow-sm"
                          }`}>
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={logoutUser}
              title="Log Out"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-red-500 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-blue-500 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.99l1.004.831a1.124 1.124 0 01.26 1.43l-1.297 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.83c.292-.24.437-.613.43-.991a6.936 6.936 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.645-.869L9.594 3.94z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT CHAT PANE */}
      <div className={`${showRightPane ? "flex" : "hidden"} flex-1 flex-col bg-white dark:bg-slate-955`}>
        {/* Render placeholder screens if active tab is selected */}
        {activeTab === "calls" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {isMobile && (
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex-shrink-0 text-slate-900 dark:text-slate-100">
                <button
                  onClick={() => setActiveTab("chats")}
                  className="mr-2 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-xs font-bold uppercase tracking-wider">Calls</span>
              </div>
            )}
            <CallsPlaceholder />
          </div>
        )}

        {activeTab === "stories" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {isMobile && (
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex-shrink-0 text-slate-900 dark:text-slate-100">
                <button
                  onClick={() => setActiveTab("chats")}
                  className="mr-2 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-xs font-bold uppercase tracking-wider">Stories</span>
              </div>
            )}
            <StoriesPlaceholder />
          </div>
        )}

        {activeTab === "devices" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {isMobile && (
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex-shrink-0 text-slate-900 dark:text-slate-100">
                <button
                  onClick={() => setActiveTab("chats")}
                  className="mr-2 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <span className="text-xs font-bold uppercase tracking-wider">Linked Devices</span>
              </div>
            )}
            <DevicesPlaceholder />
          </div>
        )}

        {activeTab === "chats" && (
          <>
            {selectedConv ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Active Chat Header */}
                <div
                  onClick={() => {
                    if (selectedConv.type === "group") {
                      setIsMembersModalOpen(true);
                    }
                  }}
                  className={`flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3.5 shadow-sm z-10 flex-shrink-0 text-slate-900 dark:text-slate-100 ${
                    selectedConv.type === "group" ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* MOBILE BACK BUTTON */}
                    {isMobile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConvId(null);
                        }}
                        className="mr-1 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                    )}
                    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold text-white">
                      {selectedConv.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedConv.avatar_url}
                          alt={selectedConv.name || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : selectedConv.type === "group" ? (
                        <div className="flex h-full w-full items-center justify-center bg-blue-600/20 text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.65 18.957a19.733 19.733 0 0113.95-3.722 19.733 19.733 0 0113.95 3.722C18.363 20.124 12 21 12 21s-6.364-.876-7.65-2.043zM16.5 16.25c.98-.326 2.012-.54 3.09-.633a19.548 19.548 0 017.35 1.911c-.41.767-1.127 1.4-2.09 1.831a18.865 18.865 0 00-8.35-3.109z" />
                          </svg>
                        </div>
                      ) : (
                        selectedConv.name?.substring(0, 2).toUpperCase() || "CH"
                      )}
                      {selectedConv.type === "direct" && resolveConversationPresence(selectedConv).is_online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 bg-green-500"></span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{selectedConv.name}</span>
                        {selectedConv.type === "group" && (
                          <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/60">Group</span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        {selectedConv.type === "group" ? (
                          `${selectedConv.participants.length} members (click to view)`
                        ) : resolveConversationPresence(selectedConv).is_online ? (
                          "Online"
                        ) : (
                          `Offline · last seen ${formatTime(resolveConversationPresence(selectedConv).last_seen || selectedConv.updated_at)}`
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex gap-1 text-slate-400 items-center">
                    {/* Encryption Badge */}
                    <div
                      title="Messages are end-to-end encrypted"
                      className="flex items-center gap-1 text-[10px] text-blue-500 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full mr-2 cursor-help select-none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                      <span>Secure</span>
                    </div>

                    <button title="Call (Coming Soon)" className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.824-1.502-5.114-3.792-6.615-6.615l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H3.75A2.25 2.25 0 001.5 4.5v2.25z" />
                      </svg>
                    </button>
                    <button title="Video Call (Coming Soon)" className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Chat Messages Scroll List */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-955 px-4 py-3 flex flex-col space-y-3">
                  {messagesLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mb-2 text-slate-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375 0 11-.75 0 .375 0 01.75 0zm0 0H8.25m4.125 0a.375 0 11-.75 0 .375 0 01.75 0zm0 0H12m4.125 0a.375 0 11-.75 0 .375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                      </svg>
                      <p className="text-xs">No messages in this chat. Say hello!</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, index) => {
                        const isSystem = msg.message_type === "system";
                        if (isSystem) {
                          return (
                            <div key={msg.id} className="flex justify-center my-2 select-none w-full animate-fade-in">
                              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-full px-4 py-1 backdrop-blur-sm max-w-sm text-center leading-relaxed">
                                {msg.content}
                              </span>
                            </div>
                          );
                        }

                        const isSelf = msg.sender_id === user?.id;
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        
                        const showDateDivider = !prevMsg || 
                          new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
                        
                        const receiptStatus = getMessageReceiptStatus(msg, selectedConv);
                        const showSenderProfile = !isSelf && selectedConv.type === "group";
                        
                        return (
                          <React.Fragment key={msg.id}>
                            {showDateDivider && (
                              <div className="flex justify-center my-4 select-none">
                                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-full px-3.5 py-1 backdrop-blur-sm uppercase tracking-wider">
                                  {getFullMessageDateString(msg.created_at)}
                                </span>
                              </div>
                            )}
                            <div id={`msg-${msg.id}`} className={`flex w-full ${isSelf ? "justify-end" : "justify-start"} transition-all duration-300 rounded-xl`}>
                              <div className={`flex items-start gap-2.5 max-w-[75%] ${isSelf ? "ml-auto" : "mr-auto"}`}>
                                {/* Sender avatar beside bubble in group chat */}
                                {showSenderProfile && (
                                  <div className="h-7.5 w-7.5 rounded-full overflow-hidden bg-blue-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white border border-slate-200 dark:border-slate-800 shadow-sm mt-0.5 select-none">
                                    {msg.sender?.avatar_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={msg.sender.avatar_url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      msg.sender?.display_name.substring(0, 2).toUpperCase() || "US"
                                    )}
                                  </div>
                                )}
                                
                                {/* Bubble Container with reply actions */}
                                <div className="relative group/bubble flex items-center">
                                  <div
                                    className={`flex flex-col p-3 rounded-2xl shadow-sm border ${
                                      isSelf
                                        ? "bg-blue-600 text-white rounded-tr-none text-right border-blue-600"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none text-left border-slate-200 dark:border-slate-800"
                                    }`}
                                  >
                                    {/* Sender name above content in group chat */}
                                    {showSenderProfile && (
                                      <span className="block text-[10px] font-bold text-blue-500 dark:text-blue-400 mb-1 select-none">
                                        {msg.sender?.display_name || "Unknown User"}
                                      </span>
                                    )}

                                    {/* Quoted Reply Message Preview */}
                                    {msg.reply_to_id && (
                                      <div
                                        onClick={() => {
                                          const el = document.getElementById(`msg-${msg.reply_to_id}`);
                                          if (el) {
                                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                                            el.classList.add("ring-2", "ring-blue-500", "animate-pulse");
                                            setTimeout(() => el.classList.remove("ring-2", "ring-blue-500", "animate-pulse"), 2000);
                                          }
                                        }}
                                        className={`mb-2 p-2 rounded-lg border text-left cursor-pointer transition-all hover:bg-black/10 text-[10px] leading-snug ${
                                          isSelf
                                            ? "bg-blue-700/40 border-blue-500/20 text-blue-100"
                                            : "bg-slate-200/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-800/80 text-slate-600 dark:text-slate-400"
                                        }`}
                                      >
                                        {(() => {
                                          const refMsg = messages.find((m) => m.id === msg.reply_to_id);
                                          return (
                                            <>
                                              <div className="font-bold text-[9px] text-blue-500 dark:text-blue-400 uppercase tracking-wide">
                                                {refMsg ? (refMsg.sender_id === user?.id ? "You" : refMsg.sender?.display_name) : "Original Message"}
                                              </div>
                                              <div className="truncate opacity-90">{refMsg ? refMsg.content : "Click to view message details"}</div>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    )}

                                    <p className="text-xs whitespace-pre-wrap leading-relaxed select-text">{msg.content}</p>
                                    <div className={`flex items-center gap-1.5 justify-end mt-1 select-none text-[9px] ${
                                      isSelf ? "text-blue-200" : "text-slate-400 dark:text-slate-500"
                                    }`}>
                                      <span>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                      </span>
                                      {renderReceiptIcon(receiptStatus)}
                                    </div>
                                  </div>

                                  {/* Reply hover action trigger */}
                                  <button
                                    onClick={() => setReplyingTo(msg)}
                                    className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-opacity bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 shadow-md ${
                                      isSelf ? "-left-10" : "-right-10"
                                    }`}
                                    title="Reply to message"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Typing Indicator Bar */}
                {typingText && (
                  <div className="px-4 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-955 flex items-center gap-2 select-none border-t border-slate-200 dark:border-slate-900">
                    <span className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </span>
                    <span className="italic">{typingText}</span>
                  </div>
                )}

                {/* Replying-to Preview Bar */}
                {replyingTo && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs animate-fade-in">
                    <div className="min-w-0 border-l-2 border-blue-500 pl-2">
                      <span className="font-bold text-[9px] text-blue-500 dark:text-blue-400 uppercase tracking-wide">
                        Replying to {replyingTo.sender?.display_name || (replyingTo.sender_id === user?.id ? "You" : "User")}
                      </span>
                      <p className="text-slate-500 dark:text-slate-400 truncate text-[11px]">{replyingTo.content}</p>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Composer Footer Form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex gap-2 items-center flex-shrink-0 z-10">
                  <button
                    type="button"
                    title="Attachment (Coming Soon)"
                    onClick={() => alert("Attachments coming soon!")}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94a3 3 0 114.243 4.242L11.609 15.41a1.5 1.5 0 11-2.122-2.122l8-8" />
                    </svg>
                  </button>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => handleComposeChange(e.target.value)}
                    placeholder="New message"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-955 px-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-600 transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    title="Send Message"
                    className="rounded-full bg-blue-600 p-2.5 text-white transition-all hover:bg-blue-500 active:scale-95 disabled:bg-blue-800 disabled:opacity-40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 transform rotate-90">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-1 flex-col bg-white dark:bg-slate-955">
                {/* Top Spacer / Decoration Bar */}
                <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

                {/* Empty State Centered Content */}
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-800 dark:text-slate-100">
                  <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 shadow-inner">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-12 w-12"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                      />
                    </svg>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight">Welcome to Signal</h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Select a conversation to start messaging. Your communication is secure.
                  </p>

                  {/* Encryption Badge */}
                  <div className="mt-8 flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/20 px-3.5 py-1.5 text-xs text-blue-500 dark:text-blue-400 backdrop-blur-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                    <span className="font-bold tracking-wide uppercase text-[10px]">End-to-End Encrypted</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Bottom Footer */}
        <div className="p-4 text-center border-t border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950">
          <p className="text-[11px] text-slate-500">
            Signal Clone · SDE Assignment. Real-time data syncing over WebSockets.
          </p>
        </div>
      </div>

      {/* CONTACTS MODAL */}
      <ContactsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectConversation={(conversationId) => {
          fetchConversations();
          setSelectedConvId(conversationId);
        }}
      />

      {/* NEW GROUP MODAL */}
      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onSelectConversation={(conversationId) => {
          fetchConversations();
          setSelectedConvId(conversationId);
        }}
      />

      {/* GROUP MEMBERS PANEL */}
      {selectedConvId && (
        <GroupMembersModal
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
          conversationId={selectedConvId}
        />
      )}

      {/* SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
