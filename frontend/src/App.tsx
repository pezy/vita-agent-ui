import React, { useEffect, useRef, useState } from "react";
import { useStreamIngestion } from "./hooks/useStreamIngestion";
import { ToolRegistryProvider, useToolRegistry } from "./lib/ToolRegistry";
import { VisionTool } from "./components/tools/VisionTool";
import { TakeActionTool } from "./components/tools/TakeActionTool";
import { ControlNavTool } from "./components/tools/ControlNavTool";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BrainCircuit, Menu, X } from "lucide-react";

import { GenericTool } from "./components/tools/GenericTool";
import { ThinkingBlock } from "./components/ThinkingBlock";
import { TTSIndicator } from "./components/TTSIndicator";

const TOOLS = {
  vision_analyze: VisionTool,
  take_action: TakeActionTool,
  control_nav: ControlNavTool,
  generic_tool: GenericTool,
};

const StreamRenderer = () => {
  const wsUrl = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:61111";
  const {
    blocks,
    isConnected,
    isReconnecting,
    availableClients,
    activeClientId,
    setActiveClientId,
    ttsState,
  } = useStreamIngestion(wsUrl);
  const { getTool } = useToolRegistry();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [blocks]);

  // Close sidebar when selecting a client on mobile
  const handleClientSelect = (clientId: string) => {
    setActiveClientId(clientId);
    setIsSidebarOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800">Active Agents</h2>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden p-1 hover:bg-gray-100 rounded-md text-gray-500"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {availableClients.length === 0 ? (
          <div className="text-sm text-gray-400 p-2 italic text-center">
            No agents connected
          </div>
        ) : (
          availableClients.map((client) => (
            <button
              key={client.id}
              onClick={() => handleClientSelect(client.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                activeClientId === client.id
                  ? "bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-100"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="truncate">{client.name}</div>
              <div className="text-[10px] text-gray-400 truncate">
                {client.id}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-green-500"
                : isReconnecting
                ? "bg-amber-400"
                : "bg-red-500"
            }`}
          />
          {isConnected
            ? "Server Connected"
            : isReconnecting
            ? "Reconnecting..."
            : "Disconnected"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 h-full">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden shadow-2xl"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative w-full">
        <header className="sticky top-0 z-30 flex items-center justify-between py-4 px-4 md:px-6 backdrop-blur-xl bg-white/40 border-b border-white/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100/50 rounded-lg text-gray-600"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-system-blue shadow-[0_0_10px_rgba(0,122,255,0.5)]"></div>
              <span className="font-semibold text-lg tracking-tight text-gray-900 truncate max-w-[200px] md:max-w-none">
                {activeClientId
                  ? availableClients.find((c) => c.id === activeClientId)
                      ?.name || "Agent Stream"
                  : "Agent Stream"}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-2 md:px-6 py-4 md:py-6">
          <div className="max-w-3xl mx-auto space-y-4 md:space-y-6 pb-20">
            {" "}
            {/* Added padding-bottom for indicators */}
            <AnimatePresence mode="popLayout">
              {(!blocks || blocks.length === 0) && activeClientId && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-gray-400 py-20"
                >
                  Waiting for output from{" "}
                  {availableClients.find((c) => c.id === activeClientId)?.name}
                  ...
                </motion.div>
              )}

              {blocks.map((block, i) => {
                if (block.type === "user_request") {
                  return (
                    <div key={i} className="flex justify-end">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-system-blue text-white px-4 py-2 rounded-2xl max-w-[90%] md:max-w-[80%] shadow-sm text-sm"
                      >
                        {block.content}
                      </motion.div>
                    </div>
                  );
                } else if (block.type === "system") {
                  return (
                    <div key={i} className="flex justify-center my-2">
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wider">
                        {block.content}
                      </span>
                    </div>
                  );
                } else if (block.type === "text") {
                  if (block.isThinking) {
                    return (
                      <div key={i} className="flex gap-2 md:gap-3 my-2">
                        {/* Spacer to align with avatar */}
                        <div className="flex-shrink-0 w-8" />
                        <ThinkingBlock
                          content={block.content}
                          thinkingTag={block.thinkingTag}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex gap-2 md:gap-3 my-2">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                        <Sparkles size={14} />
                      </div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm max-w-[90%] md:max-w-[85%] leading-relaxed text-[15px] text-gray-800"
                      >
                        {block.content}
                      </motion.div>
                    </div>
                  );
                } else if (block.type === "tool_call") {
                  const isAbandoned =
                    !block.result &&
                    (!block.events || block.events.length === 0) &&
                    i < blocks.length - 1 &&
                    blocks[i + 1].type === "text";

                  if (isAbandoned) return null;

                  const ToolComp = getTool(block.name);
                  if (!ToolComp) {
                    // Fallback to GenericTool for unknown tools
                    return (
                      <div key={i} className="flex gap-2 md:gap-3 my-2">
                        <div className="flex-shrink-0 w-8" />
                        <div className="w-full max-w-[90%] md:max-w-[85%]">
                          <GenericTool
                            args={block.args}
                            result={block.result}
                            name={block.name}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex gap-2 md:gap-3 my-2">
                      <div className="flex-shrink-0 w-8" />
                      <div className="w-full max-w-[90%] md:max-w-[85%]">
                        <ToolComp
                          args={block.args}
                          result={block.result}
                          events={block.events}
                        />
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </AnimatePresence>
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* TTS Indicator fixed at the bottom */}
        <TTSIndicator isSpeaking={!!ttsState?.isSpeaking} />
      </div>
    </div>
  );
};

function App() {
  return (
    <ToolRegistryProvider initialTools={TOOLS}>
      <StreamRenderer />
    </ToolRegistryProvider>
  );
}

export default App;
