import React, { useEffect, useState } from "react";
import { Navigation, RotateCw, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface ControlNavArgs {
  x?: number;
  y?: number;
  angle?: number;
}

interface ControlNavToolProps {
  args: ControlNavArgs;
  result?: string;
}

export const ControlNavTool: React.FC<ControlNavToolProps> = ({
  args,
  result,
}) => {
  const isRotation = args.angle !== undefined;
  const isNavigation = args.x !== undefined || args.y !== undefined;
  const [progress, setProgress] = useState(0);

  // Simulate progress if no result acts as "pending"
  useEffect(() => {
    let interval: any;
    if (!result) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev; // Stall at 90% until done
          return prev + 10;
        });
      }, 500);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [result]);

  const formatMode = () => {
    if (isRotation) {
      const direction = (args.angle || 0) > 0 ? "Left" : "Right";
      return `Rotating ${Math.abs(args.angle || 0)}° ${direction}`;
    }
    if (isNavigation) {
      return `Navigating to (x=${args.x}m, y=${args.y}m)`;
    }
    return "Unknown Action";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm my-2 w-full max-w-md">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="bg-white p-1.5 rounded-lg shadow-sm text-blue-600">
            {isRotation ? <RotateCw size={16} /> : <Navigation size={16} />}
          </div>
          <span className="font-semibold text-sm text-gray-800">
            {isRotation ? "Robot Rotation" : "Point Navigation"}
          </span>
        </div>
        {result && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
          >
            <CheckCircle2 size={12} />
            <span>Done</span>
          </motion.div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Action Details */}
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              Requested Action
            </div>
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              {formatMode()}
            </div>
          </div>
        </div>

        {/* Progress Bar (Dynamic) */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Status</span>
            <span>{result ? "100%" : `${progress}%`}</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${result ? 100 : progress}%` }}
              transition={{ type: "spring", stiffness: 50 }}
            />
          </div>
        </div>

        {/* Result Section (Expandable/Visible when done) */}
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm text-gray-600 mt-2"
          >
            <span className="font-mono text-xs">
              {typeof result === "string" ? result : JSON.stringify(result)}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
