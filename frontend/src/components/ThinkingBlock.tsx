import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export const ThinkingBlock: React.FC<{
  content: string;
  thinkingTag?: string;
}> = ({ content, thinkingTag }) => {
  const [isOpen, setIsOpen] = useState(true);

  const getTitle = () => {
    switch (thinkingTag) {
      case "reasoning":
        return "Reasoning Process";
      case "think":
      case "thinking":
      default:
        return "Thinking Process";
    }
  };

  return (
    <div className="w-full my-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors bg-gray-50/50 hover:bg-gray-100/50 px-3 py-2 rounded-lg w-full text-left border border-transparent hover:border-gray-200"
      >
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-system-blue opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-system-blue"></span>
        </div>
        <span>{getTitle()}</span>
        <ChevronDown
          size={14}
          className={`ml-auto transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50/50 backdrop-blur-sm border border-gray-100 rounded-lg p-3 mt-1 text-xs font-mono text-gray-600 leading-relaxed whitespace-pre-wrap break-words shadow-inner">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
