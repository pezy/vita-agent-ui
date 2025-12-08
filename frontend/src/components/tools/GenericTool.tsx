import React, { useState } from 'react';
import { Terminal, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const GenericTool: React.FC<{ args: any; result?: any; name?: string; events?: any[] }> = ({ args, result, name = 'Tool Call' }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="my-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all rounded-lg pl-3 pr-2 py-2 shadow-sm group"
            >
                <div className="bg-gray-100 p-1 rounded-md text-gray-500 group-hover:text-blue-500 transition-colors">
                    <Terminal size={14} />
                </div>
                <span className="text-xs font-semibold text-gray-700 font-mono">Used: {name}</span>
                <ChevronDown size={14} className={`text-gray-400 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 ml-1 w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-xs shadow-inner">
                            <div className="space-y-3">
                                <div>
                                    <div className="text-gray-400 mb-1 uppercase text-[10px] tracking-wider font-bold">Input</div>
                                    <pre className="bg-white p-2 rounded-lg border border-gray-100 overflow-x-auto text-gray-600">
                                        {JSON.stringify(args, null, 2)}
                                    </pre>
                                </div>

                                {result && (
                                    <div>
                                        <div className="text-gray-400 mb-1 uppercase text-[10px] tracking-wider font-bold">Result</div>
                                        <pre className="bg-green-50 p-2 rounded-lg border border-green-100 overflow-x-auto text-green-700">
                                            {JSON.stringify(result, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
