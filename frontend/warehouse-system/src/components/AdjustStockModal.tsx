import React, { useState } from "react";
import { IconX, IconAlertTriangle, IconCheck, IconAdjustments } from "@tabler/icons-react";
import { api } from "@/lib/api";
import { ProductThumbnail } from "./ProductThumbnail";

interface AdjustStockModalProps {
  product: {
    _id: string;
    name: string;
    sku: string;
    stock: number;
    imageUrl?: string | null;
  };
  onClose: () => void;
  onAdjusted: () => void;
}

export function AdjustStockModal({ product, onClose, onAdjusted }: AdjustStockModalProps) {
  const [adjustmentMode, setAdjustmentMode] = useState<"delta" | "target">("delta");
  const [deltaValue, setDeltaValue] = useState<number>(0);
  const [targetStock, setTargetStock] = useState<number>(product.stock);
  const [reason, setReason] = useState<"DAMAGED" | "LOST" | "FOUND" | "CORRECTION" | "COUNT">("CORRECTION");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const calculatedDelta = adjustmentMode === "delta" ? deltaValue : targetStock - product.stock;
  const newProjectedStock = product.stock + calculatedDelta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedDelta === 0) {
      setError("Adjustment cannot be 0. Enter a positive or negative quantity.");
      return;
    }
    if (newProjectedStock < 0) {
      setError(`Stock cannot drop below 0 (Attempted: ${newProjectedStock})`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api(`/products/${product._id}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          delta: calculatedDelta,
          reason,
          note: note.trim() || undefined,
        }),
      });
      onAdjusted();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <ProductThumbnail product={product} size="md" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                MANUAL STOCK ADJUSTMENT
              </span>
              <h2 className="text-base font-bold text-white font-heading">{product.name}</h2>
              <span className="text-xs font-mono text-slate-400">{product.sku}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {/* Current Stock Banner */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div>
            <span className="text-xs text-slate-400 block">Current On-Hand Stock</span>
            <strong className="text-2xl font-bold text-white tabular-nums">{product.stock}</strong>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">New Projected Stock</span>
            <strong
              className={`text-2xl font-bold tabular-nums ${
                newProjectedStock < 0
                  ? "text-rose-400"
                  : newProjectedStock > product.stock
                  ? "text-emerald-400"
                  : newProjectedStock < product.stock
                  ? "text-amber-400"
                  : "text-slate-300"
              }`}
            >
              {newProjectedStock}
            </strong>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <IconAlertTriangle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-950/60 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setAdjustmentMode("delta")}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                adjustmentMode === "delta"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Adjust by Delta (+ / -)
            </button>
            <button
              type="button"
              onClick={() => {
                setAdjustmentMode("target");
                setTargetStock(product.stock);
              }}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                adjustmentMode === "target"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Set New Absolute Count
            </button>
          </div>

          {adjustmentMode === "delta" ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Adjustment Delta (Quantity to Add / Deduct) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. +10 or -3"
                  value={deltaValue === 0 ? "" : deltaValue}
                  onChange={(e) => setDeltaValue(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Use positive numbers to add stock, negative to deduct.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                New Target Stock Count *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={targetStock}
                onChange={(e) => setTargetStock(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {/* Mandatory Reason Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Adjustment Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="CORRECTION">Inventory Count Correction</option>
              <option value="DAMAGED">Damaged Goods / Scrap</option>
              <option value="LOST">Lost / Unaccounted Shrinkage</option>
              <option value="FOUND">Found / Unrecorded Stock</option>
              <option value="COUNT">Physical Stock Audit / Cycle Count</option>
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Audit Note / Explanation
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Broken during transit in Bay 3 or Q4 shelf count"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || calculatedDelta === 0}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-all"
            >
              <IconAdjustments className="size-4" />
              <span>{saving ? "Applying…" : `Apply (${calculatedDelta > 0 ? `+${calculatedDelta}` : calculatedDelta})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
