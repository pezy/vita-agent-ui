import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, ChevronDown } from "lucide-react";

type TakeActionToolProps = {
  args: any;
  result?: any;
};

type NormalizedResult = {
  status: string;
  data: any;
  message?: string;
};

function normalizeResult(result: any): NormalizedResult {
  if (!result) {
    return { status: "unknown", data: undefined };
  }

  if (typeof result === "string") {
    return { status: "ok", data: {}, message: result };
  }

  if (
    typeof result === "object" &&
    ("status" in result || "data" in result || "message" in result)
  ) {
    return {
      status: (result as any).status ?? "ok",
      data: (result as any).data ?? {},
      message: (result as any).message,
    };
  }

  return { status: "ok", data: result };
}

export const TakeActionTool: React.FC<TakeActionToolProps> = ({
  args,
  result,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const normalized = useMemo(() => normalizeResult(result), [result]);
  const status = normalized.status;
  const data = normalized.data ?? {};

  const actionName: string | undefined = args?.action_name ?? data?.action_name;
  const message: string | undefined =
    normalized.message ?? (typeof result === "string" ? result : undefined);

  const isError = status && status !== "ok";

  return (
    <div className="my-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all rounded-lg pl-3 pr-2 py-2 shadow-sm group w-full text-left"
      >
        <div className="bg-gray-100 p-1 rounded-md text-gray-500 group-hover:text-blue-500 transition-colors">
          <BrainCircuit size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-700 font-mono truncate">
            Robot Action{actionName ? `: ${actionName}` : ""}
          </div>
          {message && (
            <div className="text-[10px] text-gray-500 truncate mt-0.5">
              {message}
            </div>
          )}
        </div>
        <div
          className={`text-[10px] px-2 py-0.5 rounded-full border ${
            isError
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {isError ? "Error" : "OK"}
        </div>
        <ChevronDown
          size={14}
          className={`text-gray-400 ml-2 transition-transform ${
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
            className="overflow-hidden"
          >
            <div className="mt-2 ml-1 w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-xs shadow-inner">
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 mb-1 uppercase text-[10px] tracking-wider font-bold">
                    Input
                  </div>
                  <pre className="bg-white p-2 rounded-lg border border-gray-100 overflow-x-auto text-gray-600">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </div>

                {result && (
                  <div>
                    <div className="text-gray-400 mb-1 uppercase text-[10px] tracking-wider font-bold">
                      Result
                    </div>
                    <pre className="bg-white p-2 rounded-lg border border-gray-100 overflow-x-auto text-gray-600">
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
