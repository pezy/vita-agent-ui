import React, { useEffect, useRef } from 'react';
import { useStreamIngestion } from './hooks/useStreamIngestion';
import { ToolRegistryProvider, useToolRegistry } from './lib/ToolRegistry';
import { VisionTool } from './components/tools/VisionTool';
import { TakeActionTool } from './components/tools/TakeActionTool';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BrainCircuit } from 'lucide-react';

import { GenericTool } from './components/tools/GenericTool';
import { ThinkingBlock } from './components/ThinkingBlock';

const TOOLS = {
    'vision_analyze': VisionTool,
    'take_action': TakeActionTool,
    'generic_tool': GenericTool
};

const StreamRenderer = () => {
    const { blocks, isConnected } = useStreamIngestion('ws://localhost:61111');
    const { getTool } = useToolRegistry();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [blocks]);

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-12 flex flex-col gap-6 min-h-screen">
            <header className="sticky top-0 z-50 flex items-center justify-between py-4 -mx-4 px-4 md:-mx-6 md:px-6 backdrop-blur-xl bg-white/40 border-b border-white/20 mb-4 transition-all duration-300">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-system-blue shadow-[0_0_10px_rgba(0,122,255,0.5)]"></div>
                    <span className="font-semibold text-lg tracking-tight text-gray-900">Agent Stream</span>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full border ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                    {isConnected ? 'Live' : 'Disconnected'}
                </div>
            </header>

            <div className="flex-1 space-y-6">
                <AnimatePresence>
                    {blocks.map((block, i) => {
                        if (block.type === 'user_request') {
                            return (
                                <div key={i} className="flex justify-end">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-system-blue text-white px-4 py-2 rounded-2xl max-w-[80%] shadow-sm text-sm"
                                    >
                                        {block.content}
                                    </motion.div>
                                </div>
                            );
                        } else if (block.type === 'system') {
                            return (
                                <div key={i} className="flex justify-center my-2">
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wider">
                                        {block.content}
                                    </span>
                                </div>
                            );
                        } else if (block.type === 'text') {
                            if (block.isThinking) {
                                return (
                                    <div key={i} className="flex gap-3 my-2">
                                        {/* Spacer to align with avatar */}
                                        <div className="flex-shrink-0 w-8" />
                                        <ThinkingBlock content={block.content} />
                                    </div>
                                );
                            }
                            return (
                                <div key={i} className="flex gap-3 my-2">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                                        <Sparkles size={14} />
                                    </div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm max-w-[85%] leading-relaxed text-[15px] text-gray-800"
                                    >
                                        {block.content}
                                    </motion.div>
                                </div>
                            );
                        } else if (block.type === 'tool_call') {
                            const ToolComp = getTool(block.name);
                            if (!ToolComp) {
                                // Fallback to GenericTool for unknown tools
                                return (
                                    <div key={i} className="flex gap-3 my-2">
                                        <div className="flex-shrink-0 w-8" />
                                        <div className="w-full max-w-[85%]">
                                            <GenericTool args={block.args} result={block.result} name={block.name} />
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={i} className="flex gap-3 my-2">
                                    <div className="flex-shrink-0 w-8" />
                                    <div className="w-full max-w-[85%]">
                                        <ToolComp args={block.args} result={block.result} />
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
