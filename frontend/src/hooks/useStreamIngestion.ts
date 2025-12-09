import { useState, useEffect, useRef, useCallback } from "react";
import { StreamParser } from "../lib/streamParser";
import { StreamState, ServerMessage, ClientInfo } from "../types";

export function useStreamIngestion(url: string) {
  const [stats, setStats] = useState<{
    isConnected: boolean;
    isReconnecting: boolean;
  }>({
    isConnected: false,
    isReconnecting: false,
  });
  const [availableClients, setAvailableClients] = useState<ClientInfo[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // Timeout ref for debouncing disconnects
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const connectRef = useRef<(() => WebSocket | null) | null>(null);

  // Map clientId -> StreamParser instance
  const parsersRef = useRef<Map<string, StreamParser>>(new Map());
  // Map clientId -> StreamState
  const [clientStreams, setClientStreams] = useState<
    Record<string, StreamState>
  >({});

  const backoffDelay = useCallback(() => {
    const base = 500; // 0.5s
    const cap = 30000; // 30s cap
    const attempt = retryCountRef.current;
    const exp = Math.min(cap, base * Math.pow(2, attempt));
    const jitter = Math.random() * 300; // small jitter
    return Math.min(cap, exp + jitter);
  }, []);

  const scheduleReconnect = useCallback(() => {
    const delay = backoffDelay();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectTimeoutRef.current = setTimeout(() => {
      retryCountRef.current += 1;
      connectRef.current?.();
    }, delay);
  }, [backoffDelay]);

  const resetRetry = useCallback(() => {
    retryCountRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    connectRef.current = () => {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("Connected to WS");
        setStats({ isConnected: true, isReconnecting: false });
        resetRetry();
      };

      ws.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);

          if (data.type === "client_list") {
            const updateClients = () => {
              setAvailableClients(data.clients);
              // Auto-select first client IF none selected AND we have clients
              // If we have no clients, we KEEP the current activeClientId to show cached data
              if (data.clients.length > 0) {
                setActiveClientId((prev: string | null) => {
                  if (prev && data.clients.find((c) => c.id === prev))
                    return prev;
                  return data.clients[0].id;
                });
              } else {
                setActiveClientId(null);
              }
            };

            if (data.clients.length > 0) {
              // If we have clients, clear any pending disconnect timeout and update immediately
              if (disconnectTimeoutRef.current) {
                clearTimeout(disconnectTimeoutRef.current);
                disconnectTimeoutRef.current = null;
              }
              updateClients();
            } else {
              // If client list is empty, start a grace period before clearing UI
              if (!disconnectTimeoutRef.current) {
                disconnectTimeoutRef.current = setTimeout(() => {
                  updateClients();
                  disconnectTimeoutRef.current = null;
                }, 5000); // 5s grace period
              }
            }
          } else if (data.type === "broadcast") {
            const { clientId, message } = data;

            // Get or create parser for this client
            let parser = parsersRef.current.get(clientId);
            if (!parser) {
              parser = new StreamParser();
              parsersRef.current.set(clientId, parser);
            }

            const updatedBlocks = parser.processChunk(message);

            setClientStreams((prev: Record<string, StreamState>) => ({
              ...prev,
              [clientId]: {
                blocks: updatedBlocks,
                isThinking: parser.isThinking,
                isConnected: true,
                ttsState: parser.ttsState,
              },
            }));
          } else if (data.type === "system") {
            // console.log("System:", data.content);
          }
        } catch (e) {
          console.error("Failed to parse chunk", e);
        }
      };

      ws.onclose = () => {
        console.log("Disconnected from WS");
        setStats({ isConnected: false, isReconnecting: true });
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.error("WS error", err);
        ws.close();
      };

      // Cleanup for this connection instance on unmount
      return ws;
    };

    const ws = connectRef.current();

    return () => {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws?.close();
    };
  }, [resetRetry, scheduleReconnect, url]);

  const activeStream = activeClientId ? clientStreams[activeClientId] : null;

  return {
    blocks: activeStream?.blocks || [],
    isConnected: stats.isConnected,
    isReconnecting: stats.isReconnecting,
    availableClients,
    activeClientId,
    setActiveClientId,
    ttsState: activeStream?.ttsState,
  };
}
