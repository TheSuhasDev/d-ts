import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconBell,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconCheck,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface InsightItem {
  _id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  why: string;
  entityType: "PRODUCT" | "ORDER" | "CUSTOMER";
  entityId: string;
  status: "OPEN" | "ACKED" | "RESOLVED";
  createdAt: string;
  metadata?: Record<string, any>;
}

interface InsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  insights: InsightItem[];
  counts: { CRITICAL: number; WARNING: number; INFO: number; totalUnresolved: number };
  isAdmin: boolean;
  onRefresh: () => void;
}

export function InsightsDrawer({
  isOpen,
  onClose,
  insights,
  counts,
  isAdmin,
  onRefresh,
}: InsightsDrawerProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [actingId, setActingId] = useState<string | null>(null);
  const [runningEngine, setRunningEngine] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAck = async (id: string) => {
    try {
      setActingId(id);
      await api(`/insights/${id}/ack`, { method: "PATCH" });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to acknowledge insight");
    } finally {
      setActingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      setActingId(id);
      await api(`/insights/${id}/resolve`, { method: "PATCH" });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resolve insight");
    } finally {
      setActingId(null);
    }
  };

  const handleTriggerRun = async () => {
    try {
      setRunningEngine(true);
      setErrorMsg("");
      await api("/insights/run", { method: "POST" });
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to run intelligence engine");
    } finally {
      setRunningEngine(false);
    }
  };

  const filteredInsights = insights.filter((i) => {
    if (selectedSeverity !== "ALL" && i.severity !== selectedSeverity) return false;
    return i.status !== "RESOLVED";
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 240 }}
            className="relative z-10 w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                  <IconBell className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Warehouse Intelligence
                    {counts.totalUnresolved > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {counts.totalUnresolved} active
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400">Decentralized alerts & risk telemetry</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleTriggerRun}
                    disabled={runningEngine}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition-all disabled:opacity-50"
                    title="Run all 5 intelligence modules now"
                  >
                    <IconRefresh className={cn("size-3.5", runningEngine && "animate-spin")} />
                    <span>Scan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <IconX className="size-5" />
                </button>
              </div>
            </div>

            {/* Severity Filter Tabs */}
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setSelectedSeverity("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0",
                  selectedSeverity === "ALL"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                )}
              >
                All ({counts.totalUnresolved})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSeverity("CRITICAL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0",
                  selectedSeverity === "CRITICAL"
                    ? "bg-rose-600 text-white font-semibold"
                    : "text-rose-400 hover:bg-rose-500/10"
                )}
              >
                <IconAlertCircle className="size-3.5" />
                Critical ({counts.CRITICAL})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSeverity("WARNING")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0",
                  selectedSeverity === "WARNING"
                    ? "bg-amber-600 text-white font-semibold"
                    : "text-amber-400 hover:bg-amber-500/10"
                )}
              >
                <IconAlertTriangle className="size-3.5" />
                Warning ({counts.WARNING})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSeverity("INFO")}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0",
                  selectedSeverity === "INFO"
                    ? "bg-sky-600 text-white font-semibold"
                    : "text-sky-400 hover:bg-sky-500/10"
                )}
              >
                <IconInfoCircle className="size-3.5" />
                Info ({counts.INFO})
              </button>
            </div>

            {errorMsg && (
              <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Insight List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
              {filteredInsights.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="size-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <IconCheck className="size-6" />
                  </div>
                  <strong className="text-sm font-semibold text-slate-200">All Systems Nominal</strong>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    No active {selectedSeverity !== "ALL" ? selectedSeverity.toLowerCase() : ""} alerts detected.
                    Inventory flow and demand patterns are healthy.
                  </p>
                </div>
              ) : (
                filteredInsights.map((insight) => {
                  const isCrit = insight.severity === "CRITICAL";
                  const isWarn = insight.severity === "WARNING";

                  return (
                    <div
                      key={insight._id}
                      className={cn(
                        "rounded-xl border p-4 transition-all relative overflow-hidden",
                        isCrit
                          ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50"
                          : isWarn
                          ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50"
                          : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                      )}
                    >
                      {/* Top Bar: Badge & Entity Tag */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1",
                              isCrit
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : isWarn
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            )}
                          >
                            {isCrit ? <IconAlertCircle className="size-3" /> : isWarn ? <IconAlertTriangle className="size-3" /> : <IconInfoCircle className="size-3" />}
                            {insight.severity}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {insight.type.replace(/_/g, " ")}
                          </span>
                        </div>

                        {insight.status === "ACKED" && (
                          <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Acknowledged
                          </span>
                        )}
                      </div>

                      {/* Title & Message */}
                      <h4 className="text-sm font-semibold text-white mb-1">{insight.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-2.5">{insight.message}</p>

                      {/* "Why" field with exact numbers */}
                      <div className="rounded-lg bg-slate-950/60 border border-slate-800/80 p-2.5 text-[11px] text-slate-400 leading-relaxed mb-3">
                        <span className="font-semibold text-indigo-400 block mb-0.5">Telemetry & Grounding:</span>
                        {insight.why}
                      </div>

                      {/* Action buttons (Admin only) */}
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                          {insight.status !== "ACKED" && (
                            <button
                              type="button"
                              onClick={() => handleAck(insight._id)}
                              disabled={actingId === insight._id}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-colors disabled:opacity-50"
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleResolve(insight._id)}
                            disabled={actingId === insight._id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
