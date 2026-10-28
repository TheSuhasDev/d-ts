import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { IconCpu, IconDatabase, IconActivity } from "@tabler/icons-react";

interface HealthData {
  status: string;
  uptimeSeconds: number;
  services: {
    database: { status: string; mode: string };
    visionService: { status: string; endpoint: string };
    intelligenceEngine: { status: string; cron: string };
  };
}

export function SystemHealthIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchHealth = () => {
    api<HealthData>("/health")
      .then((data) => setHealth(data))
      .catch(() => {
        setHealth({
          status: "unhealthy",
          uptimeSeconds: 0,
          services: {
            database: { status: "disconnected", mode: "unknown" },
            visionService: { status: "offline", endpoint: "" },
            intelligenceEngine: { status: "inactive", cron: "" },
          },
        });
      });
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const dbOk = health?.services?.database?.status === "connected";
  const aiOk = health?.services?.visionService?.status === "online";

  let statusColor = "bg-emerald-500 text-emerald-400";
  let statusText = "System Operational";
  if (!dbOk) {
    statusColor = "bg-rose-500 text-rose-400";
    statusText = "Database Disconnected";
  } else if (!aiOk) {
    statusColor = "bg-amber-500 text-amber-400";
    statusText = "Vision Model Offline";
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
      >
        <span className={cn("size-2 rounded-full animate-pulse", statusColor.split(" ")[0])} />
        <span className="hidden lg:inline text-[11px] font-mono text-slate-400">
          {aiOk ? "AI Live" : "AI Offline"}
        </span>
      </button>

      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md z-50 text-xs text-slate-200 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-semibold">
            <span className="flex items-center gap-1 text-white">
              <IconActivity className="size-3.5 text-indigo-400" />
              {statusText}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Uptime: {Math.floor((health?.uptimeSeconds || 0) / 60)}m
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <IconDatabase className="size-3" /> MongoDB
              </span>
              <span
                className={cn(
                  "font-mono font-bold",
                  dbOk ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {health?.services?.database?.status?.toUpperCase() || "CONNECTING"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <IconCpu className="size-3" /> YOLO AI Vision
              </span>
              <span
                className={cn(
                  "font-mono font-bold",
                  aiOk ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {health?.services?.visionService?.status?.toUpperCase() || "CHECKING"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
