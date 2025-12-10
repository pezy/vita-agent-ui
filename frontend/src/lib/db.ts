import { openDB, DBSchema, IDBPDatabase } from "idb";
import { ClientInfo, Block, TTSState, StreamState } from "../types";

interface VitaDB extends DBSchema {
  clients: {
    key: string;
    value: ClientInfo & { lastUpdated: number };
  };
  conversations: {
    key: string;
    value: {
      clientId: string;
      blocks: Block[];
      isThinking: boolean;
      isConnected: boolean;
      ttsState?: TTSState;
      lastUpdated: number;
    };
    indexes: { "by-last-updated": number };
  };
}

const DB_NAME = "vita_agent_ui_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VitaDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<VitaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("clients")) {
          db.createObjectStore("clients", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("conversations")) {
          const store = db.createObjectStore("conversations", {
            keyPath: "clientId",
          });
          store.createIndex("by-last-updated", "lastUpdated");
        }
      },
    });
  }
  return dbPromise;
};

// Configuration for limits
const MAX_CLIENTS = 10;
const MAX_MESSAGES_PER_CLIENT = 50; // User asked for "conversation times", interpreting as message history length

export const db = {
  async saveClients(clients: ClientInfo[]) {
    const db = await getDB();
    const tx = db.transaction("clients", "readwrite");
    const store = tx.objectStore("clients");

    // Update or add clients
    const timestamp = Date.now();
    for (const client of clients) {
      await store.put({ ...client, lastUpdated: timestamp });
    }

    await tx.done;
    await this.pruneClients();
  },

  async getAllClients(): Promise<ClientInfo[]> {
    const db = await getDB();
    const clients = await db.getAll("clients");
    // Sort by lastUpdated descending (optional, but good for UI)
    return clients.sort((a, b) => b.lastUpdated - a.lastUpdated);
  },

  async saveConversation(clientId: string, state: StreamState) {
    const db = await getDB();
    const timestamp = Date.now();

    // Prune messages if they exceed the limit
    // We keep the LAST N messages
    let blocksToSave = state.blocks;
    if (blocksToSave.length > MAX_MESSAGES_PER_CLIENT) {
      // Keep the latest
      blocksToSave = blocksToSave.slice(-MAX_MESSAGES_PER_CLIENT);
    }

    await db.put("conversations", {
      clientId,
      blocks: blocksToSave,
      isThinking: state.isThinking,
      isConnected: state.isConnected,
      ttsState: state.ttsState,
      lastUpdated: timestamp,
    });
  },

  async getConversation(clientId: string): Promise<StreamState | undefined> {
    const db = await getDB();
    const data = await db.get("conversations", clientId);
    if (!data) return undefined;

    return {
      blocks: data.blocks,
      isThinking: data.isThinking,
      isConnected: data.isConnected,
      ttsState: data.ttsState || { isSpeaking: false },
    };
  },

  async getAllConversations(): Promise<Record<string, StreamState>> {
    const db = await getDB();
    const all = await db.getAll("conversations");
    const result: Record<string, StreamState> = {};
    for (const item of all) {
      result[item.clientId] = {
        blocks: item.blocks,
        isThinking: item.isThinking,
        isConnected: item.isConnected,
        ttsState: item.ttsState || { isSpeaking: false },
      };
    }
    return result;
  },

  async pruneClients() {
    const db = await getDB();
    const clients = await db.getAll("clients");
    if (clients.length <= MAX_CLIENTS) return;

    // Sort by lastUpdated asc (oldest first)
    clients.sort((a, b) => a.lastUpdated - b.lastUpdated);

    const clientsToRemove = clients.slice(0, clients.length - MAX_CLIENTS);
    const tx = db.transaction(["clients", "conversations"], "readwrite");

    for (const client of clientsToRemove) {
      await tx.objectStore("clients").delete(client.id);
      await tx.objectStore("conversations").delete(client.id);
    }

    await tx.done;
  },
};
