import { useState, useEffect, useRef } from "react";
import { StreamParser } from "../lib/streamParser";
import { StreamState, ServerMessage, ClientInfo } from "../types";

export function useStreamIngestion(url: string) {
  const [stats, setStats] = useState<{ isConnected: boolean }>({
    isConnected: false,
  });
  const [availableClients, setAvailableClients] = useState<ClientInfo[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  // Timeout ref for debouncing disconnects
  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Map clientId -> StreamParser instance
  const parsersRef = useRef<Map<string, StreamParser>>(new Map());
  // Map clientId -> StreamState
  const [clientStreams, setClientStreams] = useState<
    Record<string, StreamState>
  >({});

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("Connected to WS");
      setStats({ isConnected: true });
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
      setStats({ isConnected: false });
    };

    return () => {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
      }
      ws.close();
    };
  }, [url]);

  const activeStream = activeClientId ? clientStreams[activeClientId] : null;

  return {
    blocks: activeStream?.blocks || [],
    isConnected: stats.isConnected,
    availableClients,
    activeClientId,
    setActiveClientId,
    ttsState: activeStream?.ttsState,
  };
}
