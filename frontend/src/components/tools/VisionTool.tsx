import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, MapPin, Loader2, Maximize } from "lucide-react";
import {
  UIEvent,
  VisionImageCapturedEvent,
  VisionStereoCapturedEvent,
  VisionVQAResultEvent,
  Vision2DDetectionResultEvent,
  Vision3DResultEvent,
  VisionVQAStartEvent,
} from "../../schemas";

type VisionToolProps = {
  args: any;
  result?: any;
  events?: UIEvent[];
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
    return { status: "ok", data: { answer: result } };
  }

  if (
    typeof result === "object" &&
    ("status" in result || "data" in result || "message" in result)
  ) {
    return {
      status: (result as any).status ?? "ok",
      data: (result as any).data ?? result,
      message: (result as any).message,
    };
  }

  return { status: "ok", data: result };
}

function formatCoordinate(
  val: number | undefined,
  type: "x" | "y" | "z"
): string {
  if (val === undefined || val === null) return "-";

  const absVal = Math.abs(val);
  const distStr =
    absVal < 1 ? `${(absVal * 100).toFixed(0)}厘米` : `${absVal.toFixed(2)}米`;

  // Raw value formatting to 3 decimal places
  const raw = `${val.toFixed(3)}米`;

  if (type === "x") {
    const dir = val >= 0 ? "向前" : "向后";
    return `${raw}（${dir}${distStr}）`;
  }
  if (type === "y") {
    const dir = val > 0 ? "偏左" : val < 0 ? "偏右" : "";
    if (!dir) return `${raw}（正中）`;
    return `${raw}（${dir}${distStr}）`;
  }
  if (type === "z") {
    return `${raw}（高度${distStr}）`;
  }
  return raw;
}

export const VisionTool: React.FC<VisionToolProps> = ({
  args,
  result,
  events,
}) => {
  const rawMode = args?.mode;
  const modeFromArgs: "vqa" | "grounding" | "unknown" =
    rawMode === 1 || rawMode === "vqa"
      ? "vqa"
      : rawMode === 2 || rawMode === "grounding"
      ? "grounding"
      : "unknown";

  // Fallback: Infer mode from events if args are missing/unknown
  let mode = modeFromArgs;
  if (mode === "unknown") {
    if (
      events?.some(
        (e) =>
          e.event_type === "vision_vqa_result" ||
          e.event_type === "vision_vqa_start"
      )
    ) {
      mode = "vqa";
    } else if (
      events?.some(
        (e) =>
          e.event_type === "vision_3d_result" ||
          e.event_type === "vision_grounding_start"
      )
    ) {
      mode = "grounding";
    }
  }

  // Derive data from events or args/result
  const capturedImageEvent = events?.find(
    (e) =>
      e.event_type === "vision_image_captured" ||
      e.event_type === "vision_stereo_captured"
  ) as VisionImageCapturedEvent | VisionStereoCapturedEvent | undefined;

  // Logic: Prefer base64 if available (it means backend fetched it successfully or source provided it)
  // If base64 is empty, try image_url.
  let capturedImage: string | undefined = undefined;
  if (capturedImageEvent) {
    if (
      capturedImageEvent.image_base64 &&
      capturedImageEvent.image_base64.length > 0
    ) {
      capturedImage = `data:image/${capturedImageEvent.image_format};base64,${capturedImageEvent.image_base64}`;
    } else if (capturedImageEvent.image_url) {
      capturedImage = capturedImageEvent.image_url;
    }
  }

  // Prefer event image if available (real-time), else args image
  const image: string | undefined = capturedImage || args?.image;

  // Find start events for query fallback
  const vqaStartEvent = events?.find(
    (e) => e.event_type === "vision_vqa_start"
  ) as VisionVQAStartEvent | undefined;

  const question: string | undefined = args?.question ?? args?.query;

  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const normalized = useMemo(() => normalizeResult(result), [result]);
  const resultData = normalized.data ?? {};

  // Check for intermediate event data
  const vqaResultEvent = events?.find(
    (e) => e.event_type === "vision_vqa_result"
  ) as VisionVQAResultEvent;
  const detectionResultEvent = events?.find(
    (e) => e.event_type === "vision_2d_detection_result"
  ) as Vision2DDetectionResultEvent;
  const groundingResultEvent = events?.find(
    (e) => e.event_type === "vision_3d_result"
  ) as Vision3DResultEvent;

  // Status derivation
  const isProcessing =
    !result &&
    (!events || events.length > 0) &&
    !vqaResultEvent &&
    !groundingResultEvent;
  const statusText = isProcessing
    ? capturedImage
      ? "Analyzing..."
      : "Capturing..."
    : "Complete";

  // -----------------------
  // Mode 1: VQA / Analysis
  // -----------------------
  if (mode === "vqa") {
    // Answer from result OR event
    const answer =
      vqaResultEvent?.answer ??
      (typeof resultData?.answer === "string"
        ? resultData.answer
        : typeof resultData === "string"
        ? resultData
        : undefined);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm my-4"
      >
        {image ? (
          <div className="relative">
            <img
              src={image}
              alt="Analysis Target"
              className="w-full h-56 object-cover"
            />
            <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Eye size={12} />
              <span>Vision Analysis</span>
            </div>
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                <Loader2 className="animate-spin text-white" size={32} />
              </div>
            )}
          </div>
        ) : (
          <div className="h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span>Waiting for camera...</span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          {question && (
            <div className="text-sm font-medium text-gray-900 leading-snug">
              "{question}"
            </div>
          )}
          {answer && (
            <div className="flex gap-2 items-start mt-2 pt-2 border-t border-gray-100">
              <div className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-0.5">
                Result
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">
                {answer}
              </div>
            </div>
          )}
          {!answer && !isProcessing && result && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              Raw result:
              <pre className="mt-1 bg-gray-50 border border-gray-100 rounded-lg p-2 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          {vqaResultEvent && (
            <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
              {vqaStartEvent?.camera_position && (
                <div className="flex gap-2">
                  <span>Pitch: {vqaStartEvent.camera_position.pitch}°</span>
                  <span>Yaw: {vqaStartEvent.camera_position.yaw}°</span>
                </div>
              )}
              <div className="ml-auto">
                {vqaResultEvent.total_time_ms.toFixed(0)}ms
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // -----------------------
  // Mode 2: Grounding / Object Localization
  // -----------------------
  if (mode === "grounding") {
    // Objects from result OR event
    const objects =
      groundingResultEvent?.objects ??
      (Array.isArray(resultData?.objects) ? resultData.objects : []);
    const detections2D = detectionResultEvent?.detections ?? [];

    // BEV Map Helpers
    const maxDist = Math.max(30, ...objects.map((o: any) => o.distance ?? 0)); // Auto scale or min 30m
    const scale = 160 / maxDist; // Map height 200px, 20px padding. 0 at bottom (180).

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full ${
          objects.length > 0 ? "max-w-3xl" : "max-w-md"
        } bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm my-4 transition-all duration-500`}
      >
        <div
          className={`flex flex-col ${objects.length > 0 ? "md:flex-row" : ""}`}
        >
          {/* Left: Camera View */}
          <div className="relative flex-1">
            {image ? (
              <div className="relative h-full">
                <img
                  src={image}
                  alt="Grounding Target"
                  className="w-full h-56 md:h-full object-cover"
                  onLoad={(e) => {
                    const imgEl = e.currentTarget;
                    if (imgEl.naturalWidth && imgEl.naturalHeight) {
                      setNaturalSize({
                        width: imgEl.naturalWidth,
                        height: imgEl.naturalHeight,
                      });
                    }
                  }}
                />
                <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <MapPin size={12} />
                  <span>Grounding</span>
                </div>
                {isProcessing && (
                  <div className="absolute top-3 right-3 bg-system-blue/90 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <Loader2 className="animate-spin" size={10} />
                    <span>{statusText}</span>
                  </div>
                )}

                {/* Visualize 2D Detections (always show if available) */}
                {naturalSize && detections2D.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {detections2D.map((det, idx) => (
                      <div
                        key={idx}
                        className="absolute border-2 border-yellow-400/70"
                        style={{
                          left: `${det.x1 * 100}%`,
                          top: `${det.y1 * 100}%`,
                          width: `${(det.x2 - det.x1) * 100}%`,
                          height: `${(det.y2 - det.y1) * 100}%`,
                        }}
                      >
                        <span className="absolute -top-4 left-0 text-[9px] bg-yellow-400/90 text-black px-1 rounded-sm shadow-sm font-medium max-w-[150px] truncate">
                          {det.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {naturalSize && objects.length > 0 && (
                  <div className="absolute inset-0">
                    {objects.map((obj: any, idx: number) => {
                      const { pixel_x, pixel_y, label, confidence } = obj;
                      if (
                        typeof pixel_x !== "number" ||
                        typeof pixel_y !== "number" ||
                        !naturalSize.width ||
                        !naturalSize.height
                      ) {
                        return null;
                      }

                      const xPct = (pixel_x / naturalSize.width) * 100;
                      const yPct = (pixel_y / naturalSize.height) * 100;

                      return (
                        <div
                          key={idx}
                          className="absolute flex flex-col items-center"
                          style={{
                            left: `${xPct}%`,
                            top: `${yPct}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <div className="w-5 h-5 rounded-full bg-system-blue/80 border border-white shadow-md flex items-center justify-center animate-[bounce_0.5s_ease-out]">
                            <MapPin size={12} className="text-white" />
                          </div>
                          {label && (
                            <div className="mt-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur-sm z-10 font-medium max-w-[120px] text-center leading-tight">
                              <div className="truncate">{label}</div>
                              {typeof confidence === "number" && (
                                <span className="text-[9px] text-gray-200 block">
                                  {(confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Waiting for camera...</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: BEV Map (Rendered only if objects exist) */}
          {objects.length > 0 && (
            <div className="w-full md:w-64 bg-gray-900 border-l border-gray-800 p-4 flex flex-col items-center relative min-h-[250px]">
              <div className="absolute top-3 left-3 text-gray-400 text-[10px] font-mono tracking-widest uppercase">
                BEV / RADAR
              </div>

              {/* SVG Map */}
              <div className="flex-1 w-full flex items-center justify-center mt-2">
                <svg
                  width="200"
                  height="200"
                  viewBox="0 0 200 200"
                  className="overflow-visible"
                >
                  {/* Grid Circles */}
                  <circle
                    cx="100"
                    cy="180"
                    r={(50 * scale) / 5}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <circle
                    cx="100"
                    cy="180"
                    r={(100 * scale) / 5}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <circle
                    cx="100"
                    cy="180"
                    r={(150 * scale) / 5}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    fill="none"
                  />

                  {/* Grid Lines */}
                  <line
                    x1="100"
                    y1="180"
                    x2="20"
                    y2="40"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                  <line
                    x1="100"
                    y1="180"
                    x2="180"
                    y2="40"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                  <line
                    x1="100"
                    y1="180"
                    x2="100"
                    y2="0"
                    stroke="rgba(255,255,255,0.1)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />

                  {/* Ego Robot */}
                  <path
                    d="M100 170 L90 190 L100 185 L110 190 Z"
                    fill="#3B82F6"
                  />

                  {/* Objects */}
                  {objects.map((obj: any, idx: number) => {
                    // Coordinate transform: X is forward (Up), Y is Left (Left)
                    // Screen X = 100 - (Y * scale)  <-- Y positive is left, so subtract from center
                    // Screen Y = 180 - (X * scale)  <-- X positive is forward, so subtract from bottom

                    // NOTE: Ensure obj.x and obj.y exist.
                    // If using the sample: { x: 25.0, y: 0.0 }
                    const x = obj.x ?? obj.distance ?? 0; // Forward
                    const y = obj.y ?? 0; // Lateral

                    const sx = 100 - y * scale;
                    const sy = 180 - x * scale;

                    return (
                      <g key={idx}>
                        <circle
                          cx={sx}
                          cy={sy}
                          r="4"
                          fill="#3B82F6"
                          className="animate-pulse"
                        />
                        <circle
                          cx={sx}
                          cy={sy}
                          r="8"
                          stroke="#3B82F6"
                          strokeWidth="1"
                          fill="none"
                          opacity="0.3"
                        />
                        {/* Label */}
                        <text
                          x={sx}
                          y={sy - 10}
                          textAnchor="middle"
                          fill="white"
                          fontSize="8"
                          className="select-none font-mono"
                        >
                          {obj.label}
                        </text>
                        {/* Coordinates */}
                        <text
                          x={sx}
                          y={sy + 12}
                          textAnchor="middle"
                          fill="#9CA3AF"
                          fontSize="6"
                          className="select-none font-mono"
                        >
                          {x.toFixed(1)}m, {y.toFixed(1)}m
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3 border-t border-gray-100">
          {question && (
            <div className="text-sm font-medium text-gray-900 leading-snug">
              "{question}"
            </div>
          )}

          {objects.length > 0 ? (
            <div className="mt-2 space-y-2">
              {objects.map((obj: any, idx: number) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-gray-50 border border-gray-100 transition-colors hover:bg-gray-100/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {obj.label ?? "Object"}
                    </div>
                    {typeof obj.confidence === "number" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 font-mono">
                        {(obj.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-600 bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b border-gray-50 last:border-0">
                          <td className="px-2 py-1.5 text-gray-400 font-mono w-8 bg-gray-50/50">
                            x
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {formatCoordinate(obj.x ?? obj.distance, "x")}
                          </td>
                        </tr>
                        <tr className="border-b border-gray-50 last:border-0">
                          <td className="px-2 py-1.5 text-gray-400 font-mono w-8 bg-gray-50/50">
                            y
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {formatCoordinate(obj.y, "y")}
                          </td>
                        </tr>
                        <tr className="border-b border-gray-50 last:border-0">
                          <td className="px-2 py-1.5 text-gray-400 font-mono w-8 bg-gray-50/50">
                            z
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {formatCoordinate(obj.z, "z")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">
              No grounded objects were returned.
            </div>
          )}

          {normalized.message && (
            <div className="text-[11px] text-gray-400 mt-1">
              {normalized.message}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
};
