"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

interface WebSocketContextType {
  isConnected: boolean;
  presenceMap: Record<number, { is_online: boolean; last_seen: string | null }>;
  sendEvent: (type: string, payload: Record<string, any>) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => void;
  unsubscribe: (eventType: string, callback: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<number, { is_online: boolean; last_seen: string | null }>>({});
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Maps event types (e.g. "presence", "new_message") to sets of callbacks
  const listenersRef = useRef<Record<string, Set<(data: any) => void>>>({});

  // Subscribe to socket events
  const subscribe = (eventType: string, callback: (data: any) => void) => {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = new Set();
    }
    listenersRef.current[eventType].add(callback);
  };

  // Unsubscribe from socket events
  const unsubscribe = (eventType: string, callback: (data: any) => void) => {
    if (listenersRef.current[eventType]) {
      listenersRef.current[eventType].delete(callback);
      if (listenersRef.current[eventType].size === 0) {
        delete listenersRef.current[eventType];
      }
    }
  };

  // Emit event to local subscribers
  const emit = (eventType: string, data: any) => {
    const callbacks = listenersRef.current[eventType];
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in WebSocket listener for '${eventType}':`, err);
        }
      });
    }
  };

  // Send event to WebSocket server
  const sendEvent = (type: string, payload: Record<string, any>) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, ...payload });
      socketRef.current.send(message);
      console.log("✈️ Sent WS event:", type, payload);
    } else {
      console.warn("⚠️ WebSocket not open. Failed to send:", type);
    }
  };

  // Internal listener to build the presenceMap dynamically
  useEffect(() => {
    const handlePresence = (event: any) => {
      if (event.user_id) {
        setPresenceMap((prev) => ({
          ...prev,
          [event.user_id]: {
            is_online: event.is_online,
            last_seen: event.last_seen,
          },
        }));
      }
    };
    
    subscribe("presence", handlePresence);
    return () => {
      unsubscribe("presence", handlePresence);
    };
  }, []);

  useEffect(() => {
    // Connect only if authenticated
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (socketRef.current) return;

      const wsUrl = `${WS_BASE_URL}/ws/${token}`;
      console.log("🔌 Connecting to WebSocket URL (UNMASKED):", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected!");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📥 Received WS event:", data);
          if (data.type) {
            emit(data.type, data);
          }
        } catch (err) {
          console.error("Failed to parse incoming WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        let errorMsg = `WebSocket closed: code=${event.code}`;
        if (event.code === 4001) {
          errorMsg = "WebSocket Authentication Failed (code 4001). Check token validity.";
        } else if (event.code === 1006) {
          errorMsg = "WebSocket Abnormal Closure (code 1006). Check backend is running, host/port are correct, and firewall settings.";
        } else if (event.reason) {
          errorMsg += `, reason=${event.reason}`;
        }
        console.error(`❌ ${errorMsg}`);
        setIsConnected(false);
        socketRef.current = null;

        // Auto reconnect with backoff (capped at 5 attempts)
        if (token && reconnectAttemptsRef.current < 5) {
          const backoffs = [1000, 2000, 4000, 8000, 16000];
          const backoff = backoffs[reconnectAttemptsRef.current];
          console.log(`⏳ Reconnecting in ${backoff / 1000}s (Attempt ${reconnectAttemptsRef.current + 1}/5)`);
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoff);
        } else if (reconnectAttemptsRef.current >= 5) {
          console.error("❌ WebSocket reconnect attempts exceeded maximum limit of 5. Giving up.");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [token, user]);

  return (
    <WebSocketContext.Provider value={{ isConnected, presenceMap, sendEvent, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
