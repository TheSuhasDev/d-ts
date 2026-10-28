import React, { useState } from "react";
import { IconX, IconAlertTriangle } from "@tabler/icons-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface CancelOrderModalProps {
  order: {
    _id: string;
    orderNumber: string;
    totalAmount: number;
    totalPaid: number;
  };
  onClose: () => void;
  onCancelled: () => void;
}

export function CancelOrderModal({ order, onClose, onCancelled }: CancelOrderModalProps) {
  const [refundOption, setRefundOption] = useState<"REFUNDED" | "CREDITED" | "NONE">(
    order.totalPaid > 0 ? "REFUNDED" : "NONE"
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api(`/orders/${order._id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({
          refundOption,
          note: note.trim() || undefined,
        }),
      });
      onCancelled();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl">
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              CANCEL ORDER
            </span>
            <h2 className="text-base font-bold text-white font-heading">{order.orderNumber}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <IconAlertTriangle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCancel} className="mt-4 space-y-4 text-xs">
          {order.totalPaid > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
              <span className="font-semibold text-amber-300 block">
                Advance Payment Collected: {formatINR(order.totalPaid)}
              </span>
              <p className="text-[11px] text-amber-200/80">
                Please select how to resolve the paid advance for this cancellation:
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="refundOption"
                    value="REFUNDED"
                    checked={refundOption === "REFUNDED"}
                    onChange={() => setRefundOption("REFUNDED")}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>Refund Advance Payment (Cash / UPI / Bank Return)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="refundOption"
                    value="CREDITED"
                    checked={refundOption === "CREDITED"}
                    onChange={() => setRefundOption("CREDITED")}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>Credit Note / Retain as Customer Ledger Balance</span>
                </label>

                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="refundOption"
                    value="NONE"
                    checked={refundOption === "NONE"}
                    onChange={() => setRefundOption("NONE")}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>No Refund (Forfeited / Settlement)</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Cancellation Reason *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Client requested cancellation before dispatch"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Canceling this order will release all reserved inventory items back into available stock.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-all shadow-md shadow-rose-600/30"
            >
              {loading ? "Cancelling…" : "Confirm Order Cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
