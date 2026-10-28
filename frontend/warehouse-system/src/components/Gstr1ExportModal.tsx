import React, { useState } from "react";
import { IconX, IconDownload, IconFileSpreadsheet, IconAlertTriangle } from "@tabler/icons-react";

interface Gstr1ExportModalProps {
  onClose: () => void;
}

export function Gstr1ExportModal({ onClose }: Gstr1ExportModalProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Financial year from April 1
  const startFy = now.getMonth() >= 3 ? `${currentYear}-04-01` : `${currentYear - 1}-04-01`;
  const endFy = now.toISOString().split("T")[0];

  const [from, setFrom] = useState(startFy);
  const [to, setTo] = useState(endFy);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const token = localStorage.getItem("wms_token");
      const url = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/orders/export/gstr1?from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}`;

      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed with HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `GSTR1_Export_${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to download GSTR-1 CSV");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <IconFileSpreadsheet className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                GST FILING TELEMETRY
              </span>
              <h2 className="text-base font-bold text-white font-heading">
                Export GSTR-1 Tax Return
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Download GSTR-1 CSV matching GST portal standard format with HSN codes, tax rates, B2B recipient GSTINs, and taxable values.
        </p>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <IconAlertTriangle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
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
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-md shadow-emerald-600/30"
          >
            <IconDownload className="size-4" />
            <span>{downloading ? "Exporting…" : "Download CSV"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
