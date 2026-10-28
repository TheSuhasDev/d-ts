import React from "react";
import { IconShieldCheck, IconAlertTriangle, IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface CustomerRiskData {
  score: number;
  tier: "LOW" | "MEDIUM" | "HIGH";
  suggestedAdvancePercent: number;
  outstandingBalance: number;
  unpaidOrdersCount: number;
  avgDaysToPay: number;
  why: string;
}

interface PaymentRiskBadgeProps {
  risk: CustomerRiskData | null;
  loading?: boolean;
  className?: string;
}

export function PaymentRiskBadge({ risk, loading, className }: PaymentRiskBadgeProps) {
  if (loading) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 animate-pulse text-xs text-slate-400", className)}>
        <span className="size-2 rounded-full bg-slate-600 animate-ping" />
        <span>Evaluating customer credit risk...</span>
      </div>
    );
  }

  if (!risk) return null;

  const isHigh = risk.tier === "HIGH";
  const isMed = risk.tier === "MEDIUM";
  const isLow = risk.tier === "LOW";

  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-xs transition-all",
        isHigh
          ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
          : isMed
          ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
          : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 font-bold">
          {isHigh ? (
            <IconAlertCircle className="size-4 text-rose-400" />
          ) : isMed ? (
            <IconAlertTriangle className="size-4 text-amber-400" />
          ) : (
            <IconShieldCheck className="size-4 text-emerald-400" />
          )}
          <span>Customer Credit Risk: {risk.tier}</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900/80 border border-current">
            Score: {risk.score}/100
          </span>
        </div>

        <span className="text-[11px] font-semibold text-slate-300">
          Suggested Advance: <strong className={isHigh ? "text-rose-400" : isMed ? "text-amber-400" : "text-emerald-400"}>{risk.suggestedAdvancePercent}%</strong>
        </span>
      </div>

      <p className="text-[11px] text-slate-300 leading-relaxed">{risk.why}</p>

      {isHigh && (
        <div className="mt-2 text-[10px] text-rose-300/90 font-medium bg-rose-500/10 rounded-md p-1.5 border border-rose-500/20">
          ⚠️ Customer has elevated outstanding balances or late payment history. A {risk.suggestedAdvancePercent}% advance is strongly advised before order confirmation.
        </div>
      )}
    </div>
  );
}
