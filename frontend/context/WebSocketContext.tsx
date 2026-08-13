"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

interface WebSocketContextType {
  isConnected: boolean;
  sendEvent: (type: string, payload: Record<string, any>) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => void;
  unsubscribe: (eventType: string, callback: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
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
      console.log("🔌 Connecting to WebSocket:", wsUrl.replace(token, "[TOKEN_HIDDEN]"));
      
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
        console.log(`❌ WebSocket closed: code=${event.code}, reason=${event.reason}`);
        setIsConnected(false);
        socketRef.current = null;

        // Auto reconnect with backoff
        if (token) {
          const backoff = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`⏳ Reconnecting in ${backoff / 1000}s (Attempt ${reconnectAttemptsRef.current + 1})`);
          reconnectAttemptsRef.current += 1;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoff);
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
    <WebSocketContext.Provider value={{ isConnected, sendEvent, subscribe, unsubscribe }}>
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
