import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatINR } from "@/lib/format";

interface DashboardChartsProps {
  products: any[];
  orders: any[];
  movements: any[];
}

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: "#6366f1", // indigo
  ADVANCE_RECEIVED: "#3b82f6", // blue
  PACKED: "#f59e0b", // amber
  DISPATCHED: "#10b981", // emerald
  CANCELLED: "#ef4444", // rose
};

const AGEING_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export function DashboardCharts({ products, orders, movements }: DashboardChartsProps) {
  // 1. Total Stock Valuation & Aggregates
  const { totalValue, totalUnits, totalReserved, totalAvailable } = useMemo(() => {
    let val = 0;
    let units = 0;
    let reserved = 0;
    let available = 0;

    for (const p of products) {
      const onHand = p.stock ?? p.onHand ?? 0;
      const res = p.reserved ?? 0;
      const avail = p.available ?? Math.max(0, onHand - res);
      const price = p.purchasePrice || p.sellingPrice || 0;

      units += onHand;
      reserved += res;
      available += avail;
      val += onHand * price;
    }

    return { totalValue: val, totalUnits: units, totalReserved: reserved, totalAvailable: available };
  }, [products]);

  // 2. 30-Day Dispatch Trend
  const dispatchTrendData = useMemo(() => {
    const daysMap = new Map<string, number>();
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      daysMap.set(key, 0);
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    for (const m of movements) {
      if (String(m.type).toUpperCase() === "DISPATCH") {
        const mDate = new Date(m.createdAt || m.date || m.timestamp);
        if (!isNaN(mDate.getTime()) && mDate >= thirtyDaysAgo) {
          const key = `${String(mDate.getMonth() + 1).padStart(2, "0")}-${String(mDate.getDate()).padStart(2, "0")}`;
          if (daysMap.has(key)) {
            daysMap.set(key, (daysMap.get(key) || 0) + (Number(m.quantity) || 1));
          }
        }
      }
    }

    // Supplement from dispatched orders if movements were empty for that day
    for (const o of orders) {
      if (o.status === "DISPATCHED") {
        const oDate = new Date(o.dispatchedAt || o.updatedAt || o.createdAt);
        if (!isNaN(oDate.getTime()) && oDate >= thirtyDaysAgo) {
          const key = `${String(oDate.getMonth() + 1).padStart(2, "0")}-${String(oDate.getDate()).padStart(2, "0")}`;
          if (daysMap.has(key) && daysMap.get(key) === 0) {
            const count = Array.isArray(o.items)
              ? o.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0)
              : 1;
            daysMap.set(key, count);
          }
        }
      }
    }

    return Array.from(daysMap.entries()).map(([day, qty]) => ({ day, quantity: qty }));
  }, [movements, orders]);

  // 3. Fast Movers vs Slow Movers
  const { fastMovers, slowMovers } = useMemo(() => {
    const usageMap = new Map<string, number>();
    for (const p of products) {
      usageMap.set(String(p._id), 0);
    }

    for (const m of movements) {
      if (String(m.type).toUpperCase() === "DISPATCH") {
        const rawId = typeof m.product === "object" ? m.product?._id : m.product;
        const pId = String(rawId || "");
        if (usageMap.has(pId)) {
          usageMap.set(pId, (usageMap.get(pId) || 0) + (Number(m.quantity) || 1));
        }
      }
    }

    const sorted = [...products].map((p) => ({
      name: p.name && p.name.length > 14 ? p.name.slice(0, 12) + ".." : (p.name || "Unknown"),
      dispatches: usageMap.get(String(p._id)) || 0,
      stock: p.stock || 0,
    }));

    sorted.sort((a, b) => b.dispatches - a.dispatches);
    return {
      fastMovers: sorted.slice(0, 5),
      slowMovers: sorted.slice(-5).reverse(),
    };
  }, [products, movements]);

  // 4. Overdue Payment Ageing
  const overdueAgeingData = useMemo(() => {
    const buckets = [
      { name: "0-3 Days", count: 0, amount: 0 },
      { name: "4-7 Days", count: 0, amount: 0 },
      { name: "8-14 Days", count: 0, amount: 0 },
      { name: "15+ Days", count: 0, amount: 0 },
    ];

    const now = new Date();

    for (const o of orders) {
      if (o.status !== "CANCELLED") {
        const balance = o.balanceAmount !== undefined ? o.balanceAmount : Math.max(0, o.totalAmount - (o.totalPaid || 0));
        if (balance > 0) {
          const refDate = o.packedAt ? new Date(o.packedAt) : new Date(o.createdAt);
          const days = Math.floor((now.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000));

          if (days <= 3) {
            buckets[0].count++;
            buckets[0].amount += balance;
          } else if (days <= 7) {
            buckets[1].count++;
            buckets[1].amount += balance;
          } else if (days <= 14) {
            buckets[2].count++;
            buckets[2].amount += balance;
          } else {
            buckets[3].count++;
            buckets[3].amount += balance;
          }
        }
      }
    }

    return buckets;
  }, [orders]);

  // 5. Orders by Status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const s = o.status || "PROCESSING";
      counts[s] = (counts[s] || 0) + 1;
    }

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Valuation & Stock Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400 font-medium">Total Inventory Valuation</span>
          <p className="text-xl font-bold text-white mt-1">{formatINR(totalValue)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Cost of goods in stock</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs text-slate-400 font-medium">On-Hand Stock</span>
          <p className="text-xl font-bold text-slate-200 mt-1">{totalUnits} units</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Total physical count</span>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <span className="text-xs text-amber-300 font-medium">Allocated / Reserved</span>
          <p className="text-xl font-bold text-amber-400 mt-1">{totalReserved} units</p>
          <span className="text-[11px] text-amber-400/70 mt-1 block">Committed to open orders</span>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <span className="text-xs text-emerald-300 font-medium">Available to Promise</span>
          <p className="text-xl font-bold text-emerald-400 mt-1">{totalAvailable} units</p>
          <span className="text-[11px] text-emerald-400/70 mt-1 block">Unencumbered stock</span>
        </div>
      </div>

      {/* Row 1: 30-Day Trend & Orders by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 30-Day Dispatch Area Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">30-Day Dispatch Velocity</h3>
              <p className="text-xs text-slate-400">Daily total outgoing quantity</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dispatchTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`${val} units`, "Dispatched"]}
                />
                <Area type="monotone" dataKey="quantity" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#dispatchGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Status Donut */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Orders by Status</h3>
            <p className="text-xs text-slate-400">Current active pipeline</p>
          </div>
          <div className="h-56 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-slate-800 text-[11px]">
            {statusData.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5 text-slate-300">
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] || "#94a3b8" }} />
                {s.name}: {s.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Fast vs Slow Movers & Overdue Ageing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fast Movers Bar Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-1">Top Fast Movers (Last 30 Days)</h3>
          <p className="text-xs text-slate-400 mb-4">Units dispatched</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fastMovers} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="dispatches" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overdue Ageing Bar Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-1">Unpaid Balance Ageing</h3>
          <p className="text-xs text-slate-400 mb-4">Aging buckets for packed & open orders</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overdueAgeingData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  formatter={(val: any, name: any, item: any) => [
                    `₹${(item?.payload?.amount || 0).toLocaleString("en-IN")} (${val} orders)`,
                    "Overdue Balance",
                  ]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {overdueAgeingData.map((_, idx) => (
                    <Cell key={idx} fill={AGEING_COLORS[idx] || "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
