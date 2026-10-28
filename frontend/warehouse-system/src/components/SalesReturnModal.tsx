import React, { useState } from "react";
import { IconX, IconAlertTriangle, IconCheck, IconReceiptRefund } from "@tabler/icons-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface OrderItem {
  product: { _id?: string } | string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

interface SalesReturnModalProps {
  order: {
    _id: string;
    orderNumber: string;
    items: OrderItem[];
    returns?: any[];
  };
  onClose: () => void;
  onReturned: () => void;
}

export function SalesReturnModal({ order, onClose, onReturned }: SalesReturnModalProps) {
  // Compute previously returned counts
  const prevReturnedMap = new Map<string, number>();
  for (const ret of order.returns || []) {
    for (const it of ret.items || []) {
      const pId = typeof it.productId === "object" ? it.productId?._id : it.productId;
      if (pId) {
        prevReturnedMap.set(pId, (prevReturnedMap.get(pId) || 0) + (it.quantity || 0));
      }
    }
  }

  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const getProductId = (item: OrderItem): string => {
    if (typeof item.product === "object" && item.product?._id) {
      return item.product._id;
    }
    return String(item.product);
  };

  const handleQtyChange = (productId: string, val: number, max: number) => {
    const qty = Math.max(0, Math.min(val, max));
    setReturnQuantities((prev) => ({
      ...prev,
      [productId]: qty,
    }));
  };

  // Calculate total refund estimate
  const totalEstimatedRefund = order.items.reduce((sum, item) => {
    const pId = getProductId(item);
    const qty = returnQuantities[pId] || 0;
    return sum + qty * item.unitPrice;
  }, 0);

  const totalItemsSelected = Object.values(returnQuantities).reduce((sum, q) => sum + q, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalItemsSelected <= 0) {
      setError("Please select at least 1 unit of a product to return.");
      return;
    }

    const payloadItems = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
        reason: reason.trim() || undefined,
      }));

    setLoading(true);
    setError("");
    try {
      const res = await api(`/orders/${order._id}/returns`, {
        method: "POST",
        body: JSON.stringify({
          items: payloadItems,
          note: reason.trim() || undefined,
        }),
      });
      setResult(res);
      onReturned();
    } catch (err: any) {
      setError(err.message || "Failed to process sales return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              SALES RETURN & CREDIT NOTE GENERATOR
            </span>
            <h2 className="text-lg font-bold text-white font-heading">
              Order {order.orderNumber}
            </h2>
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

        {result ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <IconCheck className="size-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-heading">
                Sales Return Processed Successfully
              </h3>
              <p className="text-xs text-emerald-300 mt-1">
                Credit Note Generated:{" "}
                <strong className="font-mono text-sm underline">
                  {result.creditNoteNumber}
                </strong>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Refund Credit: {formatINR(result.returnEntry?.totalRefund || 0)} · Items restocked into inventory.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-indigo-600 px-6 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            <p className="text-slate-400 text-xs">
              Select items being returned by the customer. Returned units will be restocked automatically and a sequential Credit Note will be generated.
            </p>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Product Item</th>
                    <th className="py-2.5 px-3">Dispatched</th>
                    <th className="py-2.5 px-3">Prev. Returned</th>
                    <th className="py-2.5 px-3">Available to Return</th>
                    <th className="py-2.5 px-3 text-right">Units to Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {order.items.map((item) => {
                    const pId = getProductId(item);
                    const prevReturned = prevReturnedMap.get(pId) || 0;
                    const maxReturnable = Math.max(0, item.quantity - prevReturned);
                    const currentQty = returnQuantities[pId] || 0;

                    return (
                      <tr key={item.sku} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <strong className="block text-slate-200">{item.name}</strong>
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.sku} · {formatINR(item.unitPrice)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-300">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-amber-400 font-semibold">
                          {prevReturned}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">
                          {maxReturnable}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={maxReturnable}
                            disabled={maxReturnable === 0}
                            value={currentQty === 0 ? "" : currentQty}
                            placeholder="0"
                            onChange={(e) =>
                              handleQtyChange(pId, Number(e.target.value) || 0, maxReturnable)
                            }
                            className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-center text-xs font-bold text-white focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Refund Banner */}
            <div className="flex items-center justify-between rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3.5">
              <span className="font-semibold text-cyan-300">
                Estimated Credit Note Value ({totalItemsSelected} units)
              </span>
              <strong className="text-base font-bold text-cyan-300">
                {formatINR(totalEstimatedRefund)}
              </strong>
            </div>

            {/* Return Reason Note */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Reason for Return
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Customer ordered incorrect size, undamaged in original box"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

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
                disabled={loading || totalItemsSelected <= 0}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition-all shadow-md shadow-cyan-600/30"
              >
                <IconReceiptRefund className="size-4" />
                <span>{loading ? "Processing…" : `Issue Credit Note (${formatINR(totalEstimatedRefund)})`}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
