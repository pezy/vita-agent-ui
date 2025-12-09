import { UIEvent } from "./schemas";

export type StreamChunk =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; args: any; id: string }
  | { type: "tool_call_chunk"; name?: string; args?: string; id: string }
  | { type: "tool_result"; id: string; result: any }
  | { type: "user_request"; content: string }
  | { type: "system"; content: string }
  | { type: "ui_event"; event: UIEvent };

export type MessageBlock =
  | {
      type: "text";
      content: string;
      isThinking?: boolean;
      thinkingTag?: string;
    }
  | {
      type: "tool_call";
      name: string;
      args: any;
      id: string;
      result?: any;
      rawArgs?: string;
      events?: UIEvent[];
    }
  | { type: "user_request"; content: string }
  | { type: "system"; content: string };

export interface ClientInfo {
  id: string;
  name: string;
}

export type ServerMessage =
  | { type: "client_list"; clients: ClientInfo[] }
  | {
      type: "broadcast";
      clientId: string;
      clientName: string;
      message: StreamChunk;
    }
  | { type: "system"; content: string }; // connection status messages from server

export interface StreamState {
  blocks: MessageBlock[];
  isThinking: boolean;
  isConnected: boolean;
  ttsState: {
    isSpeaking: boolean;
    text?: string;
    provider?: string;
  };
}
