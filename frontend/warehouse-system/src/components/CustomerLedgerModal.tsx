import React, { useState, useEffect } from "react";
import { IconX, IconReceipt2, IconPhone, IconMapPin, IconBuildingWarehouse, IconAlertTriangle } from "@tabler/icons-react";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";

interface CustomerLedgerModalProps {
  customerId: string;
  onClose: () => void;
  onSelectOrder?: (orderId: string) => void;
}

export function CustomerLedgerModal({ customerId, onClose, onSelectOrder }: CustomerLedgerModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api(`/customers/${customerId}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              CUSTOMER ACCOUNT LEDGER
            </span>
            <h2 className="text-xl font-bold text-white font-heading">
              {data?.customer?.name || "Customer Ledger"}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <IconPhone className="size-3.5" />
                {data?.customer?.phone}
              </span>
              <span className="flex items-center gap-1">
                <IconMapPin className="size-3.5" />
                {data?.customer?.address}
              </span>
              {data?.customer?.gstin && (
                <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  GSTIN: {data.customer.gstin}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="size-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading customer statement…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
            <IconAlertTriangle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Total Orders
                </span>
                <strong className="text-xl font-bold text-white tabular-nums">
                  {data.ledger?.totalOrders || 0}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Total Invoiced
                </span>
                <strong className="text-xl font-bold text-slate-200 tabular-nums">
                  {formatINR(data.ledger?.totalBilled || 0)}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Total Paid
                </span>
                <strong className="text-xl font-bold text-emerald-400 tabular-nums">
                  {formatINR(data.ledger?.totalPaid || 0)}
                </strong>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Balance Outstanding
                </span>
                <strong className="text-xl font-bold text-amber-400 tabular-nums">
                  {formatINR(data.ledger?.outstandingBalance || 0)}
                </strong>
              </div>
            </div>

            {/* Orders Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Order Invoices & Transactions
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Order / Inv #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Total Amount</th>
                      <th className="py-2.5 px-3">Paid Amount</th>
                      <th className="py-2.5 px-3">Balance Due</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {data.orders?.length ? (
                      data.orders.map((order: any) => (
                        <tr
                          key={order._id}
                          className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                          onClick={() => {
                            if (onSelectOrder) {
                              onSelectOrder(order._id);
                              onClose();
                            }
                          }}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                            {order.invoiceNumber || order.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {formatINR(order.totalAmount)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-emerald-400">
                            {formatINR(order.totalPaid)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-amber-400">
                            {formatINR(order.balanceAmount)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No commercial orders recorded for this customer yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
