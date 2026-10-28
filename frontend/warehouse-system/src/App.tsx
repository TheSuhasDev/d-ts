"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
  SidebarSection,
  SidebarToggle,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  IconLayoutDashboard,
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconReceipt2,
  IconHistory,
  IconCamera,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconSparkles,
  IconPrinter,
  IconX,
  IconSearch,
  IconBuildingWarehouse,
  IconShieldCheck,
  IconTrendingUp,
  IconChevronRight,
  IconTruckDelivery,
  IconLogout,
  IconVolume,
  IconVolumeOff,
  IconBrandWhatsapp,
  IconPhoneCall,
  IconCopy,
  IconSend,
  IconAlertCircle,
  IconEdit,
  IconAdjustments,
  IconFileSpreadsheet,
  IconReceiptRefund,
  IconBell,
  IconDownload,
  IconFilter,
  IconRefresh,
} from "@tabler/icons-react";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { speak, warmUpVoice } from "@/lib/voice";
import { useVoiceSettings } from "@/hooks/useVoiceSettings";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SmartReorderCard } from "@/components/SmartReorderCard";
import { PaymentAlertsCard } from "@/components/PaymentAlertsCard";
import {
  formatINR,
  formatDaysAgo,
  normalizeIndianPhone,
  buildPaymentReminderMessage,
} from "@/lib/format";
import {
  normalizePhone,
  buildInvoiceMessage,
  openWhatsApp,
  viewInvoicePdfInTab,
  sendInvoiceWhatsAppTiered,
} from "@/lib/whatsapp";
import { WhatsAppPhoneModal } from "@/components/WhatsAppPhoneModal";
import { WarehouseAssistant } from "@/components/WarehouseAssistant";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { ProductThumbnail } from "@/components/ProductThumbnail";
import { EditProductModal } from "@/components/EditProductModal";
import { AdjustStockModal } from "@/components/AdjustStockModal";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { CustomerLedgerModal } from "@/components/CustomerLedgerModal";
import { CancelOrderModal } from "@/components/CancelOrderModal";
import { SalesReturnModal } from "@/components/SalesReturnModal";
import { Gstr1ExportModal } from "@/components/Gstr1ExportModal";
import { InsightsDrawer } from "@/components/InsightsDrawer";
import { PaymentRiskBadge } from "@/components/PaymentRiskBadge";
import { SystemHealthIndicator } from "@/components/SystemHealthIndicator";
import { DashboardCharts } from "@/components/DashboardCharts";
import { exportOrdersCsv, exportMovementsCsv, exportPaymentsCsv } from "@/lib/csvExport";
import { computeInvoiceGst } from "@/lib/gst";
import { activeMediaStreams, stopAllCameraStreams } from "@/lib/camera";

/* ─── API & Global Constants ────────────────────────────────── */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const AI_API_URL =
  import.meta.env.VITE_AI_API_URL ||
  import.meta.env.VITE_AI_URL ||
  "http://127.0.0.1:8001";

const INVOICE_SELLER_DETAILS = {
  name: import.meta.env.VITE_COMPANY_NAME || "DENIKA AND TEAM SOLUTIONS",
  address: import.meta.env.VITE_COMPANY_ADDRESS || "Plot 42, Peenya Industrial Area, Phase II, Bengaluru, Karnataka 560058",
  state: import.meta.env.VITE_COMPANY_STATE || "Karnataka",
  phone: import.meta.env.VITE_COMPANY_PHONE || "+91 98765 43210",
  email: import.meta.env.VITE_COMPANY_EMAIL || "billing@denikasolutions.com",
  gstin: import.meta.env.VITE_COMPANY_GSTIN || "29AABCU9603R1ZM",
};

const PRODUCT_CLASSES: Record<string, string> = {
  drill: "DRL001",
  hammer: "HAM001",
  pliers: "PLR001",
  screwdriver: "SCR001",
  wrench: "WRN001",
};

const SUPPORTED_TOOL_CLASSES = new Set(["drill", "hammer", "pliers", "screwdriver", "wrench"]);
const AI_CONFIDENCE_THRESHOLD = Number(import.meta.env.VITE_AI_CONFIDENCE || 0.85);
const AI_STABLE_FRAMES = Number(import.meta.env.VITE_AI_STABLE_FRAMES || 3);

const currency = (value: number | string) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const invoiceCurrency = (value: number | string) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numberWords = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tensWords = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelowThousand(value: number): string {
  if (value < 20) return numberWords[value];
  if (value < 100)
    return `${tensWords[Math.floor(value / 10)]}${value % 10 ? ` ${numberWords[value % 10]}` : ""}`;
  return `${numberWords[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${wordsBelowThousand(value % 100)}` : ""}`;
}

function amountInWords(value: number | string): string {
  const amount = Math.round(Number(value) || 0);
  if (!amount) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const remainder = amount % 1000;
  if (crore) parts.push(`${wordsBelowThousand(crore)} Crore`);
  if (lakh) parts.push(`${wordsBelowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${wordsBelowThousand(thousand)} Thousand`);
  if (remainder) parts.push(wordsBelowThousand(remainder));
  return `Rupees ${parts.join(" ")} Only`;
}


async function predictImage(blob: Blob, signal?: AbortSignal) {
  const form = new FormData();
  form.append("file", blob, "warehouse-frame.jpg");

  // Try routing through authenticated Express backend proxy first
  try {
    const backendResult = await api("/vision/predict", {
      method: "POST",
      body: form,
      signal,
    });
    if (backendResult && Array.isArray(backendResult.detections)) {
      return backendResult;
    }
  } catch (proxyError: any) {
    if (proxyError.name === "AbortError") throw proxyError;
    // If backend proxy is not reachable, fall back to direct FastAPI endpoint
  }

  // Fallback direct to FastAPI endpoint with X-AI-API-KEY header
  const aiApiKey = import.meta.env.VITE_AI_API_KEY || "";
  const headers: Record<string, string> = {};
  if (aiApiKey) {
    headers["X-AI-API-KEY"] = aiApiKey;
  }

  let response: Response;
  try {
    response = await fetch(`${AI_API_URL}/predict`, {
      method: "POST",
      headers,
      body: form,
      signal,
    });
  } catch (error: any) {
    if (error.name === "AbortError") throw error;
    console.error("Vision prediction network error", {
      endpoint: `${AI_API_URL}/predict`,
      errorName: error.name,
    });
    throw new Error("Vision service unavailable. Make sure the vision model is running.", {
      cause: error,
    });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Prediction HTTP error:", response.status, result);
    throw new Error(result?.detail || "Prediction request failed.");
  }
  if (!result || !Array.isArray(result.detections)) {
    console.error("Prediction invalid response:", result);
    throw new Error("Vision service returned an invalid prediction response.");
  }
  return result;
}

function buildInvoice(order: any) {
  const source = order.order || order;
  return {
    _id: source._id || source.id,
    id: source._id || source.id,
    orderId: source._id || source.id,
    number: source.invoiceNumber || source.orderNumber,
    orderNumber: source.orderNumber,
    invoiceNumber: source.invoiceNumber || source.orderNumber,
    date: new Date(source.createdAt || Date.now()),
    client: source.client,
    items: (source.items || []).map((item: any) => ({
      ...item,
      sellingPrice: item.unitPrice ?? item.sellingPrice ?? 0,
    })),
    total: source.totalAmount,
    totalAmount: source.totalAmount,
    paymentStatus: source.paymentStatus,
    totalPaid: source.totalPaid,
    balanceAmount: source.balanceAmount,
    advancePercentage: source.advancePercentage,
    advanceRequired: source.advanceRequired,
  };
}

const statusLabel = (status: string) => status?.replaceAll("_", " ") || "—";

/* ─── Product Icons ─────────────────────────────────────────── */

function ProductIcon({ name }: { name?: string }) {
  const normalized = (name || "").toLowerCase();
  if (normalized.includes("drill")) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
        <IconSparkles className="size-4" />
      </div>
    );
  }
  if (normalized.includes("hammer")) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <IconBuildingWarehouse className="size-4" />
      </div>
    );
  }
  if (normalized.includes("pliers")) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <Boxes className="size-4" />
      </div>
    );
  }
  if (normalized.includes("screwdriver")) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <IconTrendingUp className="size-4" />
      </div>
    );
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
      <Boxes className="size-4" />
    </div>
  );
}

function StatusBadge({ product }: { product: any }) {
  const status = String(product.status || "").toUpperCase();
  const available =
    product.available !== undefined
      ? Number(product.available)
      : Math.max(0, (Number(product.stock) || 0) - (Number(product.reserved) || 0));
  const onHand = Number(product.stock ?? product.onHand ?? 0);

  if (onHand === 0 || available === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="size-1.5 rounded-full bg-rose-500" />
        OUT OF STOCK
      </span>
    );
  }

  if (status === "CRITICAL") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
        CRITICAL
      </span>
    );
  }

  if (status === "LOW") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
        LOW STOCK
      </span>
    );
  }

  if (status === "OK") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        IN STOCK
      </span>
    );
  }

  // Fallback if status was not provided
  const minStock = Number(product.minimumStock) || 0;
  if (available <= minStock) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
        CRITICAL
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      IN STOCK
    </span>
  );
}

/* ─── Brand Workspace Header & Footer ───────────────────────── */

function WorkspaceBrand() {
  const { collapsed } = useSidebar();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src="/logo1.png"
        alt="DENIKA & TEAM SOLUTIONS"
        className="size-8 shrink-0 object-contain"
      />
      {!collapsed && (
        <span
          className="whitespace-nowrap text-[11px] font-black tracking-tight text-white uppercase font-heading"
          title="DENIKA & TEAM SOLUTIONS"
        >
          DENIKA & TEAM SOLUTIONS
        </span>
      )}
    </div>
  );
}

function UserSidebarFooter() {
  const { user, logout } = useAuth();
  const { collapsed } = useSidebar();

  if (!user) return null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          title={`${user.name} (${user.role})`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30 cursor-default"
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <button
          type="button"
          onClick={logout}
          title="Sign Out"
          aria-label="Sign Out"
          className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
        >
          <IconLogout className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-semibold text-slate-200" title={user.name}>
            {user.name}
          </span>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase border mt-0.5",
              user.role === "ADMIN"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : "bg-blue-500/15 text-blue-300 border-blue-500/30"
            )}
          >
            {user.role}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={logout}
        title="Sign Out"
        aria-label="Sign Out"
        className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
      >
        <IconLogout className="size-4" />
      </button>
    </div>
  );
}

/* ─── Main Workspace Component ──────────────────────────────── */

function WarehouseWorkspace() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [invoicePreview, setInvoicePreview] = useState<any>(null);

  // Intelligence & Assistant Drawers State
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [insightsData, setInsightsData] = useState<{
    insights: any[];
    counts: { CRITICAL: number; WARNING: number; INFO: number; totalUnresolved: number };
  }>({
    insights: [],
    counts: { CRITICAL: 0, WARNING: 0, INFO: 0, totalUnresolved: 0 },
  });

  const refresh = () => setRefreshKey((key) => key + 1);

  const loadInsights = useCallback(async () => {
    try {
      const res = await api<{
        insights: any[];
        counts: { CRITICAL: number; WARNING: number; INFO: number; totalUnresolved: number };
      }>("/insights");
      if (res && res.insights) {
        setInsightsData({
          insights: res.insights,
          counts: res.counts || { CRITICAL: 0, WARNING: 0, INFO: 0, totalUnresolved: 0 },
        });
      }
    } catch {
      // Non-blocking telemetry
    }
  }, []);

  useEffect(() => {
    loadInsights();
    const interval = setInterval(loadInsights, 60000); // 60s background polling
    return () => clearInterval(interval);
  }, [loadInsights, refreshKey]);

  useEffect(() => {
    const navigate = (event: any) => setActivePage(event.detail);
    const showInvoice = (event: any) => setInvoicePreview(event.detail);
    window.addEventListener("wms-navigate", navigate);
    window.addEventListener("wms-show-invoice", showInvoice);
    return () => {
      window.removeEventListener("wms-navigate", navigate);
      window.removeEventListener("wms-show-invoice", showInvoice);
    };
  }, []);

  useEffect(() => {
    stopAllCameraStreams();
  }, [activePage]);

  const pageTitles: Record<string, [string, string]> = {
    dashboard: ["Operational Dashboard", "Real-time inventory intelligence & movement telemetry"],
    reorder: ["Smart Reorder & Replenishment", "Burn-rate velocity, depletion timelines, and automated order recommendations"],
    receive: ["Vision Receiving Station", "Zero-touch incoming tool scanning with camera detection"],
    dispatch: ["Stock Dispatch & Billing", "Assemble client orders, verify stock allocations, and print tax invoices"],
    orders: ["Commercial Orders Register", "Monitor client orders, milestones, balances, and fulfillment stages"],
    inventory: ["Catalogue & Storage Registry", "Live tool inventory, threshold tracking, and bay allocations"],
    history: ["Auditable Stock Ledger", "Chronological audit trail of receive scans and fulfilled dispatches"],
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <IconLayoutDashboard className="size-[18px]" /> },
    { id: "receive", label: "Receive Stock", icon: <IconArrowDownCircle className="size-[18px]" /> },
    { id: "dispatch", label: "Dispatch Stock", icon: <IconArrowUpCircle className="size-[18px]" /> },
    { id: "orders", label: "Orders", icon: <IconReceipt2 className="size-[18px]" /> },
    { id: "inventory", label: "Inventory", icon: <Boxes className="size-[18px]" /> },
    { id: "history", label: "Stock History", icon: <IconHistory className="size-[18px]" /> },
  ];

  return (
    <ProtectedRoute
      currentPage={activePage}
      onLoginSuccess={(intended) => setActivePage(intended || "dashboard")}
    >
      {user?.mustChangePassword && <ChangePasswordModal />}
      <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* ─── Supplied Wensity Sidebar ─── */}
        <Sidebar
          variant="collapsible"
          width={268}
          collapsedWidth={64}
          aria-label="Main Navigation"
          className="border-r border-slate-800/80 bg-[#0d1322] backdrop-blur-md"
        >
          <SidebarHeader className="border-b border-slate-800/60 px-3">
            <WorkspaceBrand />
            <SidebarToggle className="ml-auto text-slate-400 hover:text-slate-100 hover:bg-slate-800/70" />
          </SidebarHeader>

          <SidebarNav className="px-2">
            <SidebarSection label="Warehouse Operations">
              {navItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  icon={item.icon}
                  active={activePage === item.id}
                  onClick={() => setActivePage(item.id)}
                  className="hover:bg-slate-800/60"
                >
                  {item.label}
                </SidebarItem>
              ))}
            </SidebarSection>

            <SidebarSection label="Predictive Intelligence">
              <SidebarItem
                icon={<IconSparkles className="size-[18px]" />}
                active={activePage === "reorder"}
                onClick={() => setActivePage("reorder")}
                className="hover:bg-slate-800/60"
              >
                Smart Reorder
              </SidebarItem>
            </SidebarSection>
          </SidebarNav>

          <SidebarFooter>
            <UserSidebarFooter />
          </SidebarFooter>
        </Sidebar>

        {/* ─── Main Content Canvas ─── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-gradient-to-b from-[#090d16] to-[#0b101c]">
          {/* Top Header Bar */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/70 bg-[#0d1322]/80 px-6 backdrop-blur-md">
            <div className="flex flex-col justify-center">
              <h1 className="text-sm font-bold text-white tracking-tight">
                {pageTitles[activePage]?.[0]}
              </h1>
              <p className="text-xs text-slate-400">
                {pageTitles[activePage]?.[1]}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Decentralized Intelligence Bell */}
              <button
                type="button"
                onClick={() => setIsInsightsOpen(true)}
                className="relative flex items-center justify-center p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="View Decentralized Intelligence Alerts"
              >
                <IconBell className="size-4" />
                {insightsData.counts.totalUnresolved > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-pulse">
                    {insightsData.counts.totalUnresolved}
                  </span>
                )}
              </button>

              {/* Ask AI Drawer Button */}
              <button
                type="button"
                onClick={() => setIsAiDrawerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 hover:from-indigo-600/30 hover:to-violet-600/30 text-indigo-300 hover:text-white text-xs font-semibold shadow-sm transition-all"
                title="Open AI Assistant Drawer"
              >
                <IconSparkles className="size-3.5 text-indigo-400" />
                <span>Ask AI</span>
              </button>

              {/* Date chip */}
              <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-300">
                <IconClock className="size-3.5 text-slate-400" />
                <span>
                  {new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </header>

          {/* Dynamic Page Router */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="mx-auto max-w-7xl">
              {activePage === "dashboard" && (
                <Dashboard refreshKey={refreshKey} onChanged={refresh} />
              )}
              {activePage === "reorder" && (
                <div className="space-y-6">
                  <SmartReorderCard refreshKey={refreshKey} />
                </div>
              )}
              {activePage === "receive" && <Receive onChanged={refresh} />}
              {activePage === "dispatch" && <Dispatch onChanged={refresh} />}
              {activePage === "orders" && <Orders refreshKey={refreshKey} onChanged={refresh} />}
              {activePage === "inventory" && <Inventory refreshKey={refreshKey} />}
              {activePage === "history" && <History refreshKey={refreshKey} />}
            </div>
          </main>
        </div>

        {/* Invoice Modal Overlay */}
        {invoicePreview && (
          <Invoice invoice={invoicePreview} onClose={() => setInvoicePreview(null)} />
        )}

        {/* Intelligence Alerts Slide-over Drawer */}
        <InsightsDrawer
          isOpen={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          insights={insightsData.insights}
          counts={insightsData.counts}
          isAdmin={user?.role === "ADMIN"}
          onRefresh={loadInsights}
        />

        {/* In-app Warehouse AI Assistant Drawer */}
        <WarehouseAssistant
          isOpen={isAiDrawerOpen}
          onOpenChange={setIsAiDrawerOpen}
          hideFloatingTrigger={true}
        />
      </div>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <WarehouseWorkspace />
    </AuthProvider>
  );
}

/* ─── Data State Helper ─────────────────────────────────────── */

function DataState({
  error,
  loading,
  children,
}: {
  error?: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 backdrop-blur-sm">
        <div className="size-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-3" />
        <p className="text-sm font-medium">Synchronizing warehouse telemetry…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8 text-center text-rose-300">
        <IconAlertTriangle className="size-8 mb-2 text-rose-400" />
        <p className="text-sm font-semibold">{error}</p>
      </div>
    );
  }
  return <>{children}</>;
}

/* ─── Metric Card with smooth CountUp ───────────────────────── */

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  tone?: "indigo" | "emerald" | "amber" | "cyan" | "rose";
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    let frame: number;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / 450, 1);
      setDisplayValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const toneConfig = {
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400 shadow-indigo-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 shadow-emerald-500/5",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400 shadow-amber-500/5",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400 shadow-cyan-500/5",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-400 shadow-rose-500/5",
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div className={cn("flex size-9 items-center justify-center rounded-xl border", toneConfig)}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-white font-heading">
          {displayValue}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

/* ─── Dashboard Page ────────────────────────────────────────── */

function Dashboard({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api("/products/dashboard"),
      api("/products"),
      api("/orders").catch(() => []),
      api("/products/movements").catch(() => api("/products/movements/history")).catch(() => []),
    ])
      .then(([dashboard, inventory, ordersData, movementsData]) => {
        setData(dashboard);
        setProducts(Array.isArray(inventory) ? inventory : inventory?.products || []);
        setOrders(Array.isArray(ordersData) ? ordersData : ordersData?.orders || []);
        setMovements(Array.isArray(movementsData) ? movementsData : movementsData?.movements || []);
      })
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  if (error) return <DataState error={error} />;
  if (!data) return <DataState loading />;

  const lowStock = products.filter((p) => p.stock <= p.minimumStock);

  return (
    <div className="space-y-6">
      {/* Visual Analytics & Inventory Telemetry (Recharts) */}
      <DashboardCharts
        products={products}
        orders={orders}
        movements={movements.length ? movements : data.recentMovements || []}
      />
      {/* 4 Quick Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Catalog SKUs"
          value={data.totalProducts ?? data.productsCount ?? products.length}
          hint="Tracked tool items in catalog"
          icon={<Boxes className="size-5" />}
          tone="indigo"
        />
        <MetricCard
          label="Units In Stock"
          value={data.totalStock ?? products.reduce((acc: number, p: any) => acc + (p.stock || 0), 0)}
          hint="Total physical stock across bays"
          icon={<IconBuildingWarehouse className="size-5" />}
          tone="emerald"
        />
        <MetricCard
          label="Low Stock Alerts"
          value={data.lowStockProducts ?? data.lowStockCount ?? lowStock.length}
          hint="Items below threshold mark"
          icon={<IconAlertTriangle className="size-5" />}
          tone="amber"
        />
        <MetricCard
          label="Today's Dispatches"
          value={
            data.todayDispatchCount ??
            data.todayDispatches ??
            orders.filter(
              (o: any) =>
                o.status === "DISPATCHED" &&
                new Date(o.dispatchedAt || o.updatedAt).toDateString() === new Date().toDateString()
            ).length
          }
          hint="Completed orders dispatched"
          icon={<IconTruckDelivery className="size-5" />}
          tone="cyan"
        />
      </div>

      {/* Middle Grid: Movement Stream + Low Stock Sentinel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Activity */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Recent Stock Movements
              </h2>
              <p className="text-xs text-slate-400">Live auditable stock transaction stream</p>
            </div>
            <span className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              Real-time Ledger
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-800/60">
            {data.recentMovements?.length ? (
              data.recentMovements.map((movement: any) => {
                const isReceive = movement.type === "RECEIVE";
                return (
                  <div key={movement._id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl border text-xs font-bold",
                          isReceive
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-rose-500/20 bg-rose-500/10 text-rose-400",
                        )}
                      >
                        {isReceive ? (
                          <IconArrowDownCircle className="size-5" />
                        ) : (
                          <IconArrowUpCircle className="size-5" />
                        )}
                      </div>
                      <div>
                        <strong className="block text-sm font-semibold text-slate-100">
                          {movement.product?.name || "Unlisted Product"}
                        </strong>
                        <span className="block text-xs text-slate-400">
                          {movement.type} · {new Date(movement.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {new Date(movement.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        isReceive ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {isReceive ? "+" : "-"}{movement.quantity}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                No recent stock movements recorded yet.
              </div>
            )}
          </div>
        </section>

        {/* Low Stock Watchlist */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Low Stock Sentinel
              </h2>
              <p className="text-xs text-slate-400">Replenishment candidates</p>
            </div>
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
              {lowStock.length} Alerts
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-800/60">
            {lowStock.length ? (
              lowStock.map((product) => (
                <div key={product._id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <ProductIcon name={product.name} />
                    <div>
                      <strong className="block text-sm font-semibold text-slate-200">
                        {product.name}
                      </strong>
                      <span className="block text-xs text-slate-400">
                        Location: {product.location || "Bay General"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-bold text-amber-400 tabular-nums">
                      {product.stock} / {product.minimumStock}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Critical Level
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                  <IconShieldCheck className="size-5" />
                </div>
                <strong className="text-sm font-semibold text-slate-200">
                  All Inventory Healthy
                </strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every tracked tool exceeds minimum storage thresholds.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Inventory Quick Overview Table */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Inventory Status Table
            </h2>
            <p className="text-xs text-slate-400">Current levels & warehouse allocation</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("wms-navigate", { detail: "inventory" }))}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>View Full Catalog</span>
            <IconChevronRight className="size-3.5" />
          </button>
        </div>
        <ProductTable products={products} compact />
      </section>

      {/* Payment Alerts Card (At bottom of dashboard) */}
      <PaymentAlertsCard
        refreshKey={refreshKey}
        onOrderClick={(orderId) => {
          window.dispatchEvent(new CustomEvent("wms-navigate", { detail: "orders" }));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("wms-open-order", { detail: orderId }));
          }, 60);
        }}
        onChanged={onChanged}
      />
    </div>
  );
}

/* ─── Camera Scanner HUD (YOLO Video Inference) ─────────────── */

function CameraScanner({
  onDetections,
  active,
  onError,
}: {
  onDetections: (detections: any[]) => void;
  active: boolean;
  onError?: (err: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const requestRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const stabilityRef = useRef<{ product: string | null; count: number; detection: any }>({
    product: null,
    count: 0,
    detection: null,
  });
  const [status, setStatus] = useState("Camera offline");
  const [hasError, setHasError] = useState(false);
  const [detections, setDetections] = useState<any[]>([]);

  // Stable references for callbacks to prevent stream destruction on re-renders
  const onDetectionsRef = useRef(onDetections);
  onDetectionsRef.current = onDetections;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const isMountedRef = useRef(true);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    requestRef.current?.abort();
    requestRef.current = null;

    if (streamRef.current) {
      activeMediaStreams.delete(streamRef.current);
      streamRef.current.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      const srcStream = videoRef.current.srcObject as MediaStream | null;
      if (srcStream && typeof srcStream.getTracks === "function") {
        activeMediaStreams.delete(srcStream);
        srcStream.getTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      }
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      try {
        videoRef.current.load();
      } catch {}
    }

    stopAllCameraStreams();

    busyRef.current = false;
    stabilityRef.current = { product: null, count: 0, detection: null };
    setDetections([]);
    setHasError(false);
    setStatus("Camera offline");
  }, []);

  const scan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    busyRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.78),
      );
      if (!blob || controller.signal.aborted) return;

      const result = await predictImage(blob, controller.signal);
      const imgW = result.imageWidth || video.videoWidth || 640;
      const imgH = result.imageHeight || video.videoHeight || 480;
      const next = (result.detections || [])
        .map((item: any) => ({
          ...item,
          imageWidth: imgW,
          imageHeight: imgH,
        }))
        .filter((item: any) => {
          const prod = String(item.product || "").toLowerCase().trim();
          return (
            prod !== "person" &&
            SUPPORTED_TOOL_CLASSES.has(prod) &&
            Number(item.confidence) >= AI_CONFIDENCE_THRESHOLD
          );
        });

      const candidate = next.sort((a: any, b: any) => b.confidence - a.confidence)[0];
      const state = stabilityRef.current;
      if (!candidate) {
        stabilityRef.current = { product: null, count: 0, detection: null };
        setDetections([]);
        onDetectionsRef.current([]);
        setStatus("SCANNING BAY · NO TOOL DETECTED");
      } else if (state.product === candidate.product) {
        state.count += 1;
        state.detection = candidate;
        const requiredFrames = AI_STABLE_FRAMES; // strictly 3 consecutive frames
        const stable = state.count >= requiredFrames ? [candidate] : [];
        setDetections(stable);
        onDetectionsRef.current(stable);
        setStatus(
          state.count >= requiredFrames
            ? `${candidate.product.toUpperCase()} · ${(candidate.confidence * 100).toFixed(0)}% · VERIFIED`
            : `Detecting ${candidate.product} (${state.count}/${requiredFrames})`,
        );
      } else {
        stabilityRef.current = {
          product: candidate.product,
          count: 1,
          detection: candidate,
        };
        setDetections([]);
        onDetectionsRef.current([]);
        setStatus(`Detecting ${candidate.product} (1/${AI_STABLE_FRAMES})`);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        setStatus("SCANNING BAY · NO TOOL DETECTED");
      }
    } finally {
      clearTimeout(timeoutId);
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
    }
  }, []);

  const scanRef = useRef(scan);
  scanRef.current = scan;

  const startInterval = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!busyRef.current) {
        scanRef.current();
      }
    }, 800);
  }, []);

  const startCamera = useCallback(async () => {
    // If stream is already running and active with live tracks, reuse it
    if (
      streamRef.current &&
      streamRef.current.active &&
      streamRef.current.getVideoTracks().some((t) => t.readyState === "live")
    ) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play().catch(() => {});
      }
      setHasError(false);
      setStatus("Camera active · awaiting object");
      startInterval();
      return;
    }

    const constraintsList: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    // Retry loop with backoff for NotReadableError / temporary hardware locks (e.g. React 18 StrictMode mount/unmount cycle)
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!isMountedRef.current) return;
      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices?.getUserMedia(constraints);
          if (stream) break;
        } catch (err: any) {
          lastError = err;
          // If user explicitly denied permission, retrying will not help
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            break;
          }
        }
      }

      if (stream) break;

      if (lastError && (lastError.name === "NotReadableError" || lastError.name === "AbortError")) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        break;
      }
    }

    if (!isMountedRef.current) {
      stream?.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
      });
      return;
    }

    if (!stream) {
      const errorMsg =
        lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError"
          ? "Camera permission denied in browser settings"
          : lastError?.name === "NotFoundError" || lastError?.name === "DevicesNotFoundError"
          ? "No camera device detected on this system"
          : lastError?.message || "Camera device unavailable";
      setHasError(true);
      setStatus(errorMsg);
      onErrorRef.current?.(errorMsg);
      return;
    }

    activeMediaStreams.add(stream);
    streamRef.current = stream;

    // Listen for unexpected track disconnection (e.g. camera unplugged or suspended)
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (isMountedRef.current) {
          setHasError(true);
          setStatus("Camera disconnected · Click to reconnect");
          onErrorRef.current?.("Camera disconnected");
        }
      };
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    setHasError(false);
    setStatus("Camera active · awaiting object");
    startInterval();
  }, [startInterval]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!active) {
      stopCamera();
      return undefined;
    }

    startCamera();

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [active, startCamera, stopCamera]);

  // Auto-resume camera stream when page/tab regains visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        if (
          videoRef.current &&
          videoRef.current.paused &&
          streamRef.current &&
          streamRef.current.active
        ) {
          videoRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [active]);

  return (
    <div className="relative flex flex-col gap-3">
      {/* Viewfinder frame */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-indigo-500/40 bg-slate-950 shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* Cyber HUD Overlays */}
        <div className="pointer-events-none absolute inset-0 border border-indigo-500/20">
          {/* Corner brackets */}
          <div className="absolute left-3 top-3 size-6 border-l-2 border-t-2 border-indigo-400" />
          <div className="absolute right-3 top-3 size-6 border-r-2 border-t-2 border-indigo-400" />
          <div className="absolute bottom-3 left-3 size-6 border-l-2 border-b-2 border-indigo-400" />
          <div className="absolute bottom-3 right-3 size-6 border-r-2 border-b-2 border-indigo-400" />

          {/* Central Target Reticle */}
          <div className="absolute inset-[18%] rounded-xl border-2 border-dashed border-indigo-400/50 bg-indigo-500/5 shadow-[0_0_0_9999px_rgba(9,13,22,0.4)]" />

          {/* Animated Laser Scanline */}
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-scanline" />
        </div>

        {/* Live Detected Bounding Boxes + Confidence Tags */}
        {detections.map((d, index) => {
          const w = d.imageWidth || 640;
          const h = d.imageHeight || 480;
          const x1 = d.box?.x1 ?? 0;
          const y1 = d.box?.y1 ?? 0;
          const x2 = d.box?.x2 ?? w;
          const y2 = d.box?.y2 ?? h;
          const leftPct = Math.max(0, Math.min(95, (x1 / w) * 100));
          const topPct = Math.max(0, Math.min(95, (y1 / h) * 100));
          const widthPct = Math.max(4, Math.min(100 - leftPct, ((x2 - x1) / w) * 100));
          const heightPct = Math.max(4, Math.min(100 - topPct, ((y2 - y1) / h) * 100));

          return (
            <div
              key={`${d.product}-${index}`}
              className="absolute border-2 border-emerald-400 bg-emerald-500/15 rounded-xl shadow-[0_0_16px_rgba(52,211,153,0.4)] pointer-events-none transition-all duration-150"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
            >
              <div className="absolute -top-6 left-0 flex items-center gap-1.5 rounded-md bg-slate-950/90 border border-emerald-400 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider backdrop-blur-md">
                <span>{d.product}</span>
                <span className="text-white font-mono">{(d.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Camera Status Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm shadow-md">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2.5 rounded-full",
              hasError ? "bg-rose-500" : "bg-indigo-400 animate-pulse"
            )}
          />
          <span
            className={cn(
              "font-bold tracking-wide text-sm uppercase",
              hasError ? "text-rose-300" : "text-slate-100"
            )}
          >
            {status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasError && (
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                setStatus("Connecting camera...");
                startCamera();
              }}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-500"
            >
              <IconRefresh className="size-3.5" />
              <span>Reconnect Camera</span>
            </button>
          )}
          <span className="text-xs text-slate-400 font-mono font-medium">1.2s cadence</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Receive Stock Page ────────────────────────────────────── */

function Receive({ onChanged }: { onChanged: () => void }) {
  const { voiceEnabled, toggleVoice } = useVoiceSettings();
  const [active, setActive] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [autoReceiveMode, setAutoReceiveMode] = useState(true);
  const lastScannedTime = useRef<Map<string, number>>(new Map());
  const isReceivingRef = useRef(false);
  const [activeDetection, setActiveDetection] = useState(false);
  const [pendingItem, setPendingItem] = useState<{
    product: any;
    confidence: number;
    quantity: number;
  } | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [undoToast, setUndoToast] = useState<{
    productId: string;
    productName: string;
    quantity: number;
    secondsLeft: number;
  } | null>(null);
  const undoIntervalRef = useRef<any>(null);

  useEffect(() => {
    api("/products")
      .then(setProducts)
      .catch((err) => setMessage(err.message));
  }, [lastResult]);

  // Clean up undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    };
  }, []);

  const executeReceive = useCallback(
    async (product: any, quantity: number = 1, confidence: number = 1) => {
      if (isReceivingRef.current) return;
      isReceivingRef.current = true;

      const effectiveQty = quantity > 0 ? quantity : 1;

      try {
        const result = await api(`/products/${product._id}/receive`, {
          method: "PATCH",
          body: JSON.stringify({
            quantity: effectiveQty,
          }),
        });

        const newStock = result.product?.stock ?? (product.stock + effectiveQty);

        setLastResult({
          name: product.name,
          confidence,
          stock: newStock,
          quantity: effectiveQty,
        });

        // Requested voice prompt: product name received, stock : n
        speak(
          `${product.name} received, stock: ${newStock}`,
          `receive:${product.name}`
        );

        setPendingItem(null);
        onChanged();

        // Trigger 5-second undo toast
        if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
        setUndoToast({
          productId: product._id,
          productName: product.name,
          quantity: effectiveQty,
          secondsLeft: 5,
        });

        undoIntervalRef.current = setInterval(() => {
          setUndoToast((prev) => {
            if (!prev || prev.secondsLeft <= 1) {
              clearInterval(undoIntervalRef.current);
              return null;
            }
            return { ...prev, secondsLeft: prev.secondsLeft - 1 };
          });
        }, 1000);
      } catch (error: any) {
        setMessage(error.message || "Failed to receive stock");
      } finally {
        isReceivingRef.current = false;
      }
    },
    [onChanged]
  );

  const handleDetections = useCallback(
    (detections: any[]) => {
      if (!detections.length) {
        // Clear cooldown when object leaves the frame so next scan triggers immediately
        lastScannedTime.current.clear();
        setActiveDetection(false);
        if (!autoReceiveMode) {
          setPendingItem(null);
        }
        return;
      }

      setActiveDetection(true);
      const topDetection = detections[0];
      const detectedKey = String(topDetection.product || "").toLowerCase().trim();
      const product = products.find(
        (item) => item.sku === PRODUCT_CLASSES[detectedKey] || item.name.toLowerCase() === detectedKey
      );

      if (!product) return;

      const now = Date.now();
      const lastTime = lastScannedTime.current.get(product.sku) || 0;
      const COOLDOWN_MS = 3000; // 3 seconds between accepted scans of the same tool

      if (autoReceiveMode) {
        if (now - lastTime < COOLDOWN_MS) {
          return;
        }
        lastScannedTime.current.set(product.sku, now);
        executeReceive(product, 1, topDetection.confidence);
      } else {
        // Safe Stepper Mode: allow changing to newly detected product
        if (now - lastTime < COOLDOWN_MS && pendingItem?.product?.sku === product.sku) {
          return;
        }
        setPendingItem({
          product,
          confidence: topDetection.confidence,
          quantity: 1,
        });
        speak(`${product.name} detected, quantity: 1. Confirm to receive.`, `receive:${product.name}`);
      }
    },
    [products, autoReceiveMode, pendingItem, executeReceive]
  );

  const handleConfirmReceive = async () => {
    if (!pendingItem) return;
    const { product, confidence, quantity } = pendingItem;
    lastScannedTime.current.set(product.sku, Date.now());
    await executeReceive(product, quantity, confidence);
  };

  const handleRejectReceive = () => {
    if (!pendingItem) return;
    lastScannedTime.current.set(pendingItem.product.sku, Date.now() + 3000);
    setPendingItem(null);
  };

  const handleUndo = async () => {
    if (!undoToast) return;
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

    try {
      await api(`/products/${undoToast.productId}/undo-receive`, {
        method: "POST",
        body: JSON.stringify({ quantity: undoToast.quantity }),
      });

      setMessage(
        `Receive undone: Compensating adjustment recorded for ${undoToast.quantity}x ${undoToast.productName}.`
      );
      setUndoToast(null);
      onChanged();
    } catch (err: any) {
      setMessage(`Undo failed: ${err.message}`);
    }
  };

  return (
    <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 5-Second Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-[#0d1322]/95 p-4 text-xs shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <IconAlertCircle className="size-5" />
          </div>
          <div>
            <p className="font-bold text-white">
              Received {undoToast.quantity}x {undoToast.productName}
            </p>
            <p className="text-[11px] text-slate-400">
              Logged to inventory ledger · Click undo to reverse
            </p>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className="ml-3 flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition-colors shadow-sm"
          >
            <span>Undo</span>
            <span className="font-mono text-[10px] rounded-full bg-amber-500/30 px-1.5 py-0.5">
              {undoToast.secondsLeft}s
            </span>
          </button>
        </div>
      )}

      {/* Camera Station Panel */}
      <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Vision Receiving Bay
              </h2>
              <p className="text-xs text-slate-400">
                ⚡ Auto-Receive Active · Automatically increments stock (+1) on verified scan
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleVoice}
                title={voiceEnabled ? "Mute voice feedback" : "Enable voice feedback"}
                aria-label={voiceEnabled ? "Mute voice feedback" : "Enable voice feedback"}
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl border transition-all",
                  voiceEnabled
                    ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                {voiceEnabled ? (
                  <IconVolume className="size-4" />
                ) : (
                  <IconVolumeOff className="size-4" />
                )}
              </button>
            </div>
          </div>

          {!active ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4 shadow-inner">
                <IconCamera className="size-8" />
              </div>
              <h3 className="text-base font-bold text-slate-100 font-heading">
                Activate Camera Feed
              </h3>
              <p className="max-w-md text-xs text-slate-400 mt-1 mb-6 leading-relaxed">
                Position incoming warehouse items in the scan zone. Auto-receive detects supported tools and automatically increments stock by 1.
              </p>
              <button
                onClick={() => {
                  warmUpVoice();
                  setMessage("");
                  setActive(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 hover:shadow-indigo-600/50"
              >
                <IconCamera className="size-4" />
                <span>Launch Live Camera</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <CameraScanner
                active={active}
                onDetections={handleDetections}
                onError={setMessage}
              />

              {/* Auto-Receive Notification Pill */}
              {lastResult && (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-4 backdrop-blur-md animate-in fade-in duration-200 shadow-xl">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-300 text-base font-extrabold font-mono shadow-inner">
                      ✓
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-white tracking-wide">
                        Auto-received +{lastResult.quantity || 1} {lastResult.name}!
                      </p>
                      <p className="text-xs text-emerald-300 font-semibold font-mono mt-0.5">
                        Current stock: {lastResult.stock} units · Show tool again to add +1
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300 font-mono">
                    {(lastResult.confidence * 100).toFixed(0)}% verified
                  </span>
                </div>
              )}

              <button
                onClick={() => {
                  stopAllCameraStreams();
                  setActive(false);
                  setActiveDetection(false);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              >
                Disconnect Camera
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Latest Receipt Card */}
      <section
        className={cn(
          "lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg flex flex-col justify-between transition-all duration-300",
          !activeDetection && !pendingItem && "opacity-60"
        )}
      >
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400">
                TELEMETRY FEED
              </span>
              <h2 className="text-lg font-black text-white font-heading tracking-tight mt-0.5">
                Latest Receive Event
              </h2>
            </div>
            {!activeDetection && !pendingItem && (
              <span className="rounded-full bg-slate-800/90 border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">
                IDLE · NO TOOL IN FRAME
              </span>
            )}
          </div>

          {lastResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-lg">
                <ProductIcon name={lastResult.name} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 block">
                    Recognized Item
                  </span>
                  <h3 className="text-2xl font-black text-white truncate tracking-tight mt-0.5">
                    {lastResult.name}
                  </h3>
                  <p className="text-sm font-mono text-indigo-300 font-bold mt-1">
                    SKU {PRODUCT_CLASSES[lastResult.name.toLowerCase()] || "—"}
                  </p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <IconCheck className="size-6 stroke-[2.5]" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-3.5 text-sm shadow-inner">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Confidence Score:</span>
                  <strong className="text-base font-black text-emerald-400 font-mono">
                    {(lastResult.confidence * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800/80 pt-3">
                  <span className="text-slate-300 font-medium">Quantity Added:</span>
                  <strong className="text-base font-black text-white font-mono">
                    +{lastResult.quantity || 1} Unit
                  </strong>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800/80 pt-3">
                  <span className="text-slate-300 font-medium">Stock Updated:</span>
                  <strong className="text-base font-black text-indigo-300 font-mono">
                    {lastResult.stock} Units on hand
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/40 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-300 mb-3 border border-slate-700">
                <IconCamera className="size-7" />
              </div>
              <strong className="text-base font-bold text-slate-100">
                Awaiting Product Detection
              </strong>
              <p className="text-sm text-slate-300 max-w-xs mt-1.5 leading-relaxed">
                Hold a warehouse tool in the scan viewfinder. The system auto-receives and adds to inventory.
              </p>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-200">
              {message}
            </div>
          )}
        </div>

        {/* Informational Guidance */}
        <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-xs text-slate-300 leading-relaxed">
          <strong className="text-indigo-300 block mb-1 font-bold text-xs">
            Supported Tool Classes:
          </strong>
          Drill (DRL001) · Hammer (HAM001) · Pliers (PLR001) · Screwdriver (SCR001) · Wrench (WRC001)
        </div>
      </section>
    </div>
  );
}

/* ─── Dispatch Stock Page ───────────────────────────────────── */

function Dispatch({ onChanged }: { onChanged: () => void }) {
  const { voiceEnabled, toggleVoice } = useVoiceSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const cartRef = useRef<any[]>(cart);
  const [active, setActive] = useState(false);
  const [client, setClient] = useState({ name: "", phone: "", address: "", gstin: "" });
  const [customerRisk, setCustomerRisk] = useState<any>(null);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);
  const [message, setMessage] = useState("");
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const lockedInFrame = useRef<Set<string>>(new Set());

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    const rawPhone = client.phone ? client.phone.replace(/\D/g, "") : "";
    if (rawPhone.length >= 10) {
      setEvaluatingRisk(true);
      api<{ success: boolean; risk: any }>(`/customers/${rawPhone}/risk`)
        .then((res) => {
          if (res?.risk) setCustomerRisk(res.risk);
        })
        .catch(() => setCustomerRisk(null))
        .finally(() => setEvaluatingRisk(false));
    } else {
      setCustomerRisk(null);
    }
  }, [client.phone]);

  useEffect(() => {
    api("/products")
      .then(setProducts)
      .catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    api("/orders")
      .then((data) =>
        setRecentOrders(Array.isArray(data) ? data.slice(0, 5) : data.orders?.slice(0, 5) || []),
      )
      .catch(() => {});
  }, [onChanged]);

  const addDetection = useCallback(
    (detections: any[]) => {
      if (!detections.length) {
        // All items left the frame; clear cooldown
        lockedInFrame.current.clear();
        return;
      }

      // Check items that have left the frame
      const currentInFrame = new Set(detections.map((d) => d.product));
      for (const lockedItem of lockedInFrame.current) {
        if (!currentInFrame.has(lockedItem)) {
          lockedInFrame.current.delete(lockedItem);
        }
      }

      detections.forEach((detection) => {
        // Enforce cooldown: product held in view is not added repeatedly
        if (lockedInFrame.current.has(detection.product)) return;

        const product = products.find(
          (item) => item.sku === PRODUCT_CLASSES[detection.product],
        );
        if (!product) return;

        lockedInFrame.current.add(detection.product);

        setCart((current) => {
          const found = current.find((item) => item._id === product._id);
          const nextQty = found ? found.quantity + 1 : 1;
          speak(
            `${product.name}, added to order, quantity ${nextQty}.`,
            `dispatch:${product.name}`
          );
          const nextCart = found
            ? current.map((item) =>
                item._id === product._id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              )
            : [...current, { ...product, quantity: 1 }];
          cartRef.current = nextCart;
          return nextCart;
        });
      });
    },
    [products],
  );

  const updateQuantity = (id: string, value: string) =>
    setCart((current) =>
      current.map((item) =>
        item._id === id ? { ...item, quantity: Math.max(1, Number(value) || 1) } : item,
      ),
    );

  const total = cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);

  const createOrder = async () => {
    if (!client.name.trim() || !client.phone.trim() || !client.address.trim()) {
      return setMessage("Enter client name, contact phone, and dispatch address before confirming.");
    }
    if (!cart.length) {
      return setMessage("Add at least one product item to the order cart.");
    }
    try {
      const created = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          client,
          items: cart.map((item) => ({ productId: item._id, quantity: item.quantity })),
        }),
      });
      window.dispatchEvent(
        new CustomEvent("wms-show-invoice", {
          detail: buildInvoice(created.order || created),
        }),
      );
      setCart([]);
      setClient({ name: "", phone: "", address: "", gstin: "" });
      onChanged();
      setMessage("");
      window.dispatchEvent(new CustomEvent("wms-navigate", { detail: "orders" }));
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Camera scanner */}
      <section className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Dispatch Scanner
            </h2>
            <p className="text-xs text-slate-400">
              Identify tools to append to cart
            </p>
          </div>
          <button
            type="button"
            onClick={toggleVoice}
            title={voiceEnabled ? "Mute voice feedback" : "Enable voice feedback"}
            aria-label={voiceEnabled ? "Mute voice feedback" : "Enable voice feedback"}
            className={cn(
              "flex size-8 items-center justify-center rounded-xl border transition-all",
              voiceEnabled
                ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                : "border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            {voiceEnabled ? (
              <IconVolume className="size-4" />
            ) : (
              <IconVolumeOff className="size-4" />
            )}
          </button>
        </div>

        {!active ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3 shadow-inner">
              <IconCamera className="size-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 font-heading">
              Camera Scanner Standby
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Detect packaged goods for automated order dispatch.
            </p>
            <button
              onClick={() => {
                warmUpVoice();
                setMessage("");
                setActive(true);
              }}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:bg-indigo-500"
            >
              Start Camera
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <CameraScanner active={active} onDetections={addDetection} onError={setMessage} />
            <button
              onClick={() => {
                stopAllCameraStreams();
                setActive(false);
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Stop Camera
            </button>
          </div>
        )}

        {/* Recent orders shortcut list */}
        <div className="pt-4 border-t border-slate-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Recent Order Invoices
          </h3>
          <div className="divide-y divide-slate-800/60">
            {recentOrders.map((order) => (
              <div key={order._id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <strong className="block text-slate-200">{order.orderNumber}</strong>
                  <span className="text-[11px] text-slate-400">
                    {order.client?.name} · {statusLabel(order.status)}
                  </span>
                </div>
                <button
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("wms-show-invoice", {
                        detail: buildInvoice(order),
                      }),
                    )
                  }
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  View Invoice
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right: Cart & Order Generator */}
      <section className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              New Dispatch Order Cart
            </h2>
            <p className="text-xs text-slate-400">
              Configure items and generate official commercial invoice
            </p>
          </div>
          <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} Units
          </span>
        </div>

        {/* Cart Item Rows */}
        {cart.length ? (
          <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            {cart.map((item) => {
              const onHand = item.stock ?? item.onHand ?? 0;
              const reserved = item.reserved ?? 0;
              const available = item.available ?? Math.max(0, onHand - reserved);
              const isOverStock = item.quantity > available;

              return (
                <div key={item._id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <ProductThumbnail product={item} size="md" />
                    <div>
                      <strong className="block text-sm font-semibold text-slate-100">
                        {item.name}
                      </strong>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span>{item.sku} · {currency(item.sellingPrice)} ea</span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-bold font-mono",
                            available >= item.quantity
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          )}
                        >
                          {available} Available ({onHand} On Hand)
                        </span>
                      </div>
                      {isOverStock && (
                        <span className="text-[10px] text-rose-400 font-semibold block mt-0.5">
                          ⚠️ Requested {item.quantity} exceeds available stock ({available})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item._id, e.target.value)}
                      className="w-16 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-center text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() =>
                        setCart((current) => current.filter((entry) => entry._id !== item._id))
                      }
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                    >
                      <IconX className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-8 text-center text-xs text-slate-400">
            Cart is empty. Scan an item with camera or pick from the manual catalogue selector below.
          </div>
        )}

        {/* Manual picker */}
        <div>
          <select
            value=""
            onChange={(e) => {
              const product = products.find((item) => item._id === e.target.value);
              if (product) setCart((current) => [...current, { ...product, quantity: 1 }]);
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">+ Manually add product from catalog…</option>
            {products.map((product) => {
              const onHand = product.stock ?? product.onHand ?? 0;
              const reserved = product.reserved ?? 0;
              const available = product.available ?? Math.max(0, onHand - reserved);
              return (
                <option key={product._id} value={product._id}>
                  {product.name} ({product.sku}) · {available} available ({onHand} on hand) · {currency(product.sellingPrice)}
                </option>
              );
            })}
          </select>
        </div>

        {/* Order total & Client Form */}
        {cart.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4">
              <span className="text-xs font-semibold text-slate-300">
                Order Grand Total
              </span>
              <strong className="text-xl font-extrabold text-indigo-300 font-heading">
                {currency(total)}
              </strong>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                CLIENT & BILLING DETAILS
              </span>
              <PaymentRiskBadge risk={customerRisk} loading={evaluatingRisk} className="mb-2" />
              <CustomerAutocomplete client={client} onChange={setClient} />
              <button
                onClick={createOrder}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 mt-2"
              >
                <IconReceipt2 className="size-4" />
                <span>Create Commercial Order & Print Tax Invoice</span>
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {message}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Orders Page ───────────────────────────────────────────── */

function Orders({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged?: () => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showGstr1, setShowGstr1] = useState(false);

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/orders");
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders, refreshKey]);

  useEffect(() => {
    const openOrder = (event: any) => setSelected(event.detail);
    window.addEventListener("wms-open-order", openOrder);
    return () => window.removeEventListener("wms-open-order", openOrder);
  }, []);

  // Filter calculations
  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = order.orderNumber?.toLowerCase().includes(q);
        const matchName = order.client?.name?.toLowerCase().includes(q);
        const matchPhone = order.client?.phone?.includes(q);
        if (!matchNumber && !matchName && !matchPhone) return false;
      }
      if (fromDate) {
        if (new Date(order.createdAt) < new Date(fromDate)) return false;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(order.createdAt) > end) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportPayments = () => {
    const paymentsList: any[] = [];
    orders.forEach((o) => {
      if (o.totalPaid > 0) {
        paymentsList.push({
          orderNumber: o.orderNumber,
          clientName: o.client?.name,
          amount: o.totalPaid,
          method: "UPI",
          type: o.paymentStatus,
          status: "CONFIRMED",
          createdAt: o.createdAt,
        });
      }
    });
    exportPaymentsCsv(paymentsList, "payments_ledger.csv");
  };

  return (
    <DataState loading={loading} error={error}>
      {!orders.length ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
          <IconReceipt2 className="size-10 mb-2 text-slate-500" />
          <p className="text-sm font-semibold text-slate-300">No Orders Created Yet</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Create your first dispatch order from the Dispatch tab.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Orders Register
              </h2>
              <p className="text-xs text-slate-400">
                Manage commercial transactions, status transitions, and payments
              </p>
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-xs">
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-2.5 size-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search order ID, client..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Stages (Pipeline)</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="ADVANCE_RECEIVED">ADVANCE RECEIVED</option>
              <option value="PACKED">PACKED</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            {/* From Date */}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              title="Filter from date"
            />

            {/* To Date */}
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              title="Filter to date"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-950/40">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Grand Total</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Order Stage</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      No orders match the current search or date filters.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white font-mono">
                        {order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <strong className="block text-slate-200">{order.client?.name}</strong>
                        <span className="text-[11px] text-slate-500">{order.client?.phone}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-200">
                        {currency(order.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                          {statusLabel(order.paymentStatus)}
                        </span>
                        <small className="block text-[10px] text-slate-400 mt-0.5">
                          Due {currency(order.balanceAmount)}
                        </small>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {((order.paymentStatus === "FULLY_PAID" || order.balanceAmount <= 0) && (order.status === "PROCESSING" || order.status === "ADVANCE_RECEIVED")) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              <span className="size-1.5 rounded-full bg-current" />
                              Paid in Full
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                                order.status === "DISPATCHED"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                                  : order.status === "CANCELLED"
                                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                                  : "bg-amber-500/15 text-amber-400 border border-amber-500/25",
                              )}
                            >
                              <span className="size-1.5 rounded-full bg-current" />
                              {statusLabel(order.status)}
                            </span>
                          )}
                          {Boolean(order.isOverdue || (order.status === "PACKED" && order.balanceAmount > 0 && (order.daysPending ?? 0) >= 3)) ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                              <span className="size-1 rounded-full bg-rose-500 animate-pulse" />
                              OVERDUE · {order.daysPending ?? 0}d
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelected(order._id)}
                            className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/40 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            onClick={() =>
                              window.dispatchEvent(
                                new CustomEvent("wms-show-invoice", {
                                  detail: buildInvoice(order),
                                }),
                              )
                            }
                            className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                          >
                            Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
            <span>
              Showing {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {selected && (
        <OrderDetails
          orderId={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            loadOrders();
            onChanged?.();
          }}
        />
      )}
    </DataState>
  );
}

/* ─── Order Details Drawer/Modal ────────────────────────────── */

function OrderDetails({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { isAdmin } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [payment, setPayment] = useState({
    amount: "",
    method: "UPI",
    paymentType: "ADVANCE",
    reference: "",
    notes: "",
  });
  const [showPayment, setShowPayment] = useState(false);
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showInvoicePhoneModal, setShowInvoicePhoneModal] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSalesReturnModal, setShowSalesReturnModal] = useState(false);
  const [showCustomerLedger, setShowCustomerLedger] = useState(false);

  const load = useCallback(
    () =>
      api(`/orders/${orderId}`)
        .then(setOrder)
        .catch((err) => setMessage(err.message)),
    [orderId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const action = async (path: string) => {
    try {
      await api(`/orders/${orderId}/${path}`, { method: "PATCH" });
      await load();
      onChanged();
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  const recordPayment = async () => {
    try {
      await api(`/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify(payment),
      });
      setPayment({
        amount: "",
        method: "UPI",
        paymentType: "PARTIAL",
        reference: "",
        notes: "",
      });
      setShowPayment(false);
      await load();
      onChanged();
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  const handleSendWhatsApp = async () => {
    setPhoneError("");
    setFeedback("");
    const rawPhone = order.client?.phone;
    if (!normalizePhone(rawPhone)) {
      setPhoneError("Valid 10-digit Indian phone number starting with 6-9 required.");
      return;
    }

    try {
      setFeedback("Sending payment reminder with invoice PDF...");
      await sendInvoiceWhatsAppTiered({
        order,
        isReminder: true,
        onToast: (msg) => setFeedback(msg),
      });
      await api(`/orders/${orderId}/reminders`, {
        method: "POST",
        body: JSON.stringify({
          channel: "WHATSAPP",
          note: "Payment reminder with invoice PDF sent via WhatsApp",
        }),
      }).catch(() => {});
      await load();
      onChanged();
    } catch (err: any) {
      setFeedback(`Reminder delivery failed: ${err.message}`);
    }
  };

  const handleCopyMessage = () => {
    const msg = buildPaymentReminderMessage(
      order.client?.name,
      order.invoiceNumber || order.orderNumber,
      order.balanceAmount
    );
    navigator.clipboard.writeText(msg).then(() => {
      setFeedback("Reminder message copied to clipboard!");
    });
  };

  const handleLogCall = async () => {
    try {
      await api(`/orders/${orderId}/reminders`, {
        method: "POST",
        body: JSON.stringify({ channel: "CALL", note: "Phone call reminder" }),
      });
      setFeedback("Call reminder logged to history!");
      await load();
      onChanged();
    } catch (err: any) {
      setFeedback(`Failed to log call: ${err.message}`);
    }
  };

  const handleSendInvoiceWhatsApp = async () => {
    const rawPhone = order.client?.phone;
    if (!normalizePhone(rawPhone)) {
      setShowInvoicePhoneModal(true);
      return;
    }
    try {
      setFeedback("Dispatching invoice PDF via WhatsApp...");
      await sendInvoiceWhatsAppTiered({
        order,
        isReminder: false,
        onToast: (msg) => setFeedback(msg),
      });
      await load();
      onChanged();
    } catch (err: any) {
      setFeedback(`Failed to send invoice: ${err.message}`);
    }
  };

  const handleCopyInvoiceMessage = () => {
    const msg = buildInvoiceMessage(order);
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedInvoice(true);
      setFeedback("Invoice details copied to clipboard!");
      setTimeout(() => setCopiedInvoice(false), 2500);
    });
  };

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-300">
          Loading order details…
        </div>
      </div>
    );
  }

  const steps = ["PROCESSING", "ADVANCE_RECEIVED", "PACKED", "DISPATCHED"];
  const currentIndex = steps.indexOf(order.status);
  const invoice = buildInvoice(order);

  const openPayment = () => {
    const amount =
      order.totalPaid < order.advanceRequired
        ? order.advanceRequired - order.totalPaid
        : order.balanceAmount;
    setPayment((current) => ({
      ...current,
      amount: amount.toFixed(2),
      paymentType: order.totalPaid < order.advanceRequired ? "ADVANCE" : "FULL",
    }));
    setShowPayment(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              ORDER LIFECYCLE
            </span>
            <h2 className="text-xl font-extrabold text-white font-heading">
              {order.orderNumber}
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 mt-1">
              {statusLabel(order.status)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {/* Client brief */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
          <div className="space-y-1">
            <strong className="block text-sm text-slate-100">{order.client?.name}</strong>
            <p className="text-slate-400">Phone: {order.client?.phone}</p>
            <p className="text-slate-400">Address: {order.client?.address}</p>
            {order.client?.gstin && <p className="font-mono text-indigo-300">GSTIN: {order.client.gstin}</p>}
          </div>
          <button
            type="button"
            onClick={() => setShowCustomerLedger(true)}
            className="self-start sm:self-auto rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/25 transition-all shadow-sm"
          >
            View Customer Ledger
          </button>
        </div>

        {/* Items Table */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Order Items
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Qty</th>
                  <th className="py-2.5 px-3">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {order.items.map((item: any) => (
                  <tr key={item.sku}>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{item.name}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.sku}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-slate-300">{currency(item.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                      {currency(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Summary, Payment Receipts & Reminder History */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs space-y-2">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Financial Summary
            </h3>
            <div className="flex justify-between text-slate-400">
              <span>Order Total:</span>
              <strong className="text-slate-100">{currency(order.totalAmount)}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Advance ({order.advancePercentage}%):</span>
              <strong className="text-slate-100">{currency(order.advanceRequired)}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Paid:</span>
              <strong className="text-emerald-400">{currency(order.totalPaid)}</strong>
            </div>
            <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1">
              <span>Balance Due:</span>
              <strong className="text-amber-400">{currency(order.balanceAmount)}</strong>
            </div>
            {order.status === "PACKED" && (order.daysPending ?? 0) > 0 && (
              <div className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-[11px] text-rose-300">
                Packed {order.daysPending} days ago
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs space-y-2">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Payment Receipts
            </h3>
            {order.payments?.length ? (
              <div className="space-y-1.5 divide-y divide-slate-800/60 max-h-44 overflow-y-auto">
                {order.payments.map((p: any) => (
                  <div key={p._id} className="pt-1.5 first:pt-0">
                    <div className="flex justify-between font-semibold text-slate-200">
                      <span>{p.paymentType} · {p.method}</span>
                      <span className="text-emerald-400 font-bold">{currency(p.amount)}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString("en-IN")} {p.reference ? `· ${p.reference}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No payment receipts logged yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                Reminder History
              </h3>
              {order.lastReminderAt && (
                <span className="text-[10px] text-slate-400">
                  {formatDaysAgo(order.lastReminderAt)}
                </span>
              )}
            </div>
            {order.reminders?.length ? (
              <div className="space-y-1.5 divide-y divide-slate-800/60 max-h-44 overflow-y-auto">
                {order.reminders.map((r: any, idx: number) => (
                  <div key={idx} className="pt-1.5 first:pt-0 text-[11px]">
                    <div className="flex justify-between items-center text-slate-200">
                      <span className="font-semibold inline-flex items-center gap-1">
                        {r.channel === "WHATSAPP" && <IconBrandWhatsapp className="size-3 text-emerald-400" />}
                        {r.channel === "CALL" && <IconPhoneCall className="size-3 text-blue-400" />}
                        {r.channel === "EMAIL" && <IconSend className="size-3 text-amber-400" />}
                        {r.channel === "MANUAL" && <IconClock className="size-3 text-purple-400" />}
                        {r.channel}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        by {r.sentBy || "Staff"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
                      <span>{new Date(r.sentAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {r.note && <span className="italic truncate max-w-[120px]">{r.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No payment reminders recorded yet.</p>
            )}
          </div>
        </div>

        {/* Sales Returns & Credit Notes (if any) */}
        {order.returns && order.returns.length > 0 && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <IconReceiptRefund className="size-4" />
                <span>Sales Returns & Credit Notes ({order.returns.length})</span>
              </h3>
              <span className="font-bold text-cyan-300 text-xs font-mono">
                Refund Value: {formatINR(order.returns.reduce((sum: number, r: any) => sum + (r.totalRefund || 0), 0))}
              </span>
            </div>
            <div className="space-y-2">
              {order.returns.map((ret: any, idx: number) => (
                <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="font-mono text-cyan-300">{ret.creditNoteNumber}</span>
                    <span className="text-slate-200">{formatINR(ret.totalRefund)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{new Date(ret.returnedAt).toLocaleString("en-IN")}</span>
                    <span>By: {ret.handledBy || "Admin"}</span>
                  </div>
                  {ret.reason && <p className="text-[11px] text-slate-400 italic">Reason: {ret.reason}</p>}
                  <div className="pt-1 text-[11px] text-slate-300">
                    Returned: {(ret.items || []).map((it: any) => `${it.quantity}x ${it.name}`).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log & Timeline */}
        {order.timeline && order.timeline.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Audit Log & Lifecycle Timeline
            </h3>
            <div className="space-y-2 divide-y divide-slate-800/60 max-h-48 overflow-y-auto pr-1">
              {order.timeline.map((entry: any, idx: number) => (
                <div key={idx} className="pt-2 first:pt-0 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {entry.action?.replaceAll("_", " ") || entry.status}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      by <strong className="text-slate-300">{entry.userName || "Staff"}</strong> · {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fulfillment Pipeline Timeline */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fulfillment Stage
          </h3>
          <div className="flex items-center justify-between gap-2">
            {steps.map((step, idx) => {
              const isPast = idx <= currentIndex;
              const isCurrent = step === order.status;
              return (
                <div key={step} className="flex-1 text-center">
                  <div
                    className={cn(
                      "mx-auto flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                      isPast
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-800 text-slate-500",
                      isCurrent && "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900",
                    )}
                  >
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 block text-[10px] font-semibold uppercase tracking-wider",
                      isPast ? "text-indigo-300" : "text-slate-500",
                    )}
                  >
                    {statusLabel(step)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-800">
          {order.status !== "DISPATCHED" && order.status !== "CANCELLED" && (
            <>
              <button
                onClick={openPayment}
                className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                Record Payment
              </button>

              {order.status === "PACKED" && order.balanceAmount > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSendWhatsApp}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:border-emerald-500/60 hover:bg-emerald-500/25 transition-all shadow-sm"
                    title="Send WhatsApp payment reminder"
                  >
                    <IconBrandWhatsapp className="size-4 text-emerald-400" />
                    Send Reminder
                  </button>
                  <button
                    onClick={handleCopyMessage}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all"
                    title="Copy reminder message"
                  >
                    <IconCopy className="size-3.5" />
                  </button>
                  <button
                    onClick={handleLogCall}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-all"
                    title="Log phone call reminder"
                  >
                    <IconPhoneCall className="size-3.5" />
                  </button>
                </div>
              )}

              {isAdmin && order.status === "PROCESSING" && (
                <button
                  onClick={() => action("confirm-payment")}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Confirm Payment
                </button>
              )}

              {isAdmin && order.status === "ADVANCE_RECEIVED" && (
                <button
                  onClick={() => action("pack")}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  Pack Order
                </button>
              )}

              {isAdmin && order.status === "PACKED" && order.paymentStatus === "FULLY_PAID" && (
                <button
                  onClick={() => action("dispatch")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30"
                >
                  Dispatch Order
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
                >
                  Cancel Order
                </button>
              )}
            </>
          )}

          {isAdmin && order.status === "DISPATCHED" && (
            <button
              onClick={() => setShowSalesReturnModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-600/20 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-600/30 transition-all shadow-sm"
            >
              <IconReceiptRefund className="size-4" />
              <span>Process Sales Return</span>
            </button>
          )}

          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("wms-show-invoice", { detail: invoice }),
              )
            }
            className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            View Tax Invoice
          </button>

          <button
            onClick={() => viewInvoicePdfInTab(order._id || order.id)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-indigo-500/30 px-3.5 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-all shadow-sm"
            title="Download or print official A4 GST Tax Invoice PDF"
          >
            <IconPrinter className="size-4" />
            <span>Print Tax Invoice (PDF)</span>
          </button>

          <button
            onClick={handleSendInvoiceWhatsApp}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20"
            title="Send invoice details on WhatsApp"
          >
            <IconBrandWhatsapp className="size-4" />
            <span>Send Invoice</span>
          </button>

          <button
            onClick={handleCopyInvoiceMessage}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
            title="Copy invoice message"
          >
            {copiedInvoice ? (
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <IconCheck className="size-3.5" />
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <IconCopy className="size-3.5 text-slate-400" />
                Copy Invoice
              </span>
            )}
          </button>
        </div>

        {/* Feedback / Notification alerts */}
        {feedback && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2 text-xs text-indigo-300">
            <IconCheck className="size-4 text-indigo-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {phoneError && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <IconAlertCircle className="size-4 text-rose-400 shrink-0" />
              <span>{phoneError} Cannot launch WhatsApp directly.</span>
            </div>
            <button
              onClick={handleCopyMessage}
              className="self-start sm:self-auto flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/30 transition-all"
            >
              <IconCopy className="size-3" />
              Copy Message Instead
            </button>
          </div>
        )}

        {/* Record payment drawer inline */}
        {showPayment && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Record Inward Payment
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <select
                value={payment.paymentType}
                onChange={(e) => setPayment({ ...payment, paymentType: e.target.value })}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="ADVANCE">Advance</option>
                <option value="PARTIAL">Partial</option>
                <option value="FULL">Full</option>
              </select>
              <select
                value={payment.method}
                onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <input
              placeholder="Reference / Transaction ID (Optional)"
              value={payment.reference}
              onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={recordPayment}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30"
            >
              Confirm Payment Receipt
            </button>
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {message}
          </div>
        )}

        <WhatsAppPhoneModal
          isOpen={showInvoicePhoneModal}
          initialPhone={order.client?.phone || ""}
          clientName={order.client?.name || "Client"}
          orderNumber={order.orderNumber}
          onSend={async (validPhone) => {
            setShowInvoicePhoneModal(false);
            const updatedOrder = { ...order, client: { ...order.client, phone: validPhone } };
            setFeedback("Dispatching invoice PDF via WhatsApp...");
            await sendInvoiceWhatsAppTiered({
              order: updatedOrder,
              isReminder: false,
              onToast: (msg) => setFeedback(msg),
            });
            await load();
            onChanged();
          }}
          onCopy={handleCopyInvoiceMessage}
          onClose={() => setShowInvoicePhoneModal(false)}
          copied={copiedInvoice}
        />

        {showCancelModal && (
          <CancelOrderModal
            order={order}
            onClose={() => setShowCancelModal(false)}
            onCancelled={() => {
              load();
              onChanged();
            }}
          />
        )}

        {showSalesReturnModal && (
          <SalesReturnModal
            order={order}
            onClose={() => setShowSalesReturnModal(false)}
            onReturned={() => {
              load();
              onChanged();
            }}
          />
        )}

        {showCustomerLedger && (
          <CustomerLedgerModal
            customerId={order.client?.phone || order._id}
            onClose={() => setShowCustomerLedger(false)}
            onSelectOrder={(id) => {
              setShowCustomerLedger(false);
              if (id !== orderId) {
                window.dispatchEvent(new CustomEvent("wms-open-order", { detail: id }));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Inventory Catalog Page ────────────────────────────────── */

function Inventory({ refreshKey }: { refreshKey: number }) {
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<any>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  const loadProducts = useCallback(() => {
    api("/products")
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, refreshKey, localRefresh]);

  const filtered = products.filter((product) =>
    `${product.name} ${product.sku} ${product.location || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <DataState loading={!products.length && !error} error={error}>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Inventory Registry
            </h2>
            <p className="text-xs text-slate-400">
              Live storage locations, reserved orders, and available allocations
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              placeholder="Search product, SKU, or bay…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <ProductTable
          products={filtered}
          onEditProduct={(p) => setEditingProduct(p)}
          onAdjustStock={(p) => setAdjustingProduct(p)}
        />
      </section>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            loadProducts();
            setLocalRefresh((k) => k + 1);
          }}
        />
      )}

      {adjustingProduct && (
        <AdjustStockModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onAdjusted={() => {
            loadProducts();
            setLocalRefresh((k) => k + 1);
          }}
        />
      )}
    </DataState>
  );
}

/* ─── Shared Product Table ──────────────────────────────────── */

function ProductTable({
  products,
  compact = false,
  onEditProduct,
  onAdjustStock,
}: {
  products: any[];
  compact?: boolean;
  onEditProduct?: (product: any) => void;
  onAdjustStock?: (product: any) => void;
}) {
  const { isAdmin } = useAuth();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
          <tr>
            <th className="py-3 px-4">Product Name</th>
            <th className="py-3 px-4">SKU Code</th>
            <th className="py-3 px-4">On Hand</th>
            <th className="py-3 px-4">Reserved</th>
            <th className="py-3 px-4">Available</th>
            <th className="py-3 px-4">Storage Bay</th>
            {!compact && <th className="py-3 px-4">Selling Price</th>}
            <th className="py-3 px-4">Status</th>
            {isAdmin && !compact && <th className="py-3 px-4 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {products.map((product) => {
            const onHand = product.stock ?? product.onHand ?? 0;
            const reserved = product.reserved ?? 0;
            const available = product.available ?? Math.max(0, onHand - reserved);

            return (
              <tr key={product._id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <ProductThumbnail product={product} size="md" />
                    <div>
                      <strong className="text-sm font-semibold text-slate-200 block">
                        {product.name}
                      </strong>
                      {product.supplier && (
                        <span className="text-[10px] text-slate-500">
                          {typeof product.supplier === "object" ? product.supplier?.name || "" : String(product.supplier)}
                          {product.leadTimeDays ? ` · ${product.leadTimeDays}d lead` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">{product.sku}</td>
                <td className="py-3 px-4 font-bold text-white text-sm tabular-nums">
                  {onHand}
                </td>
                <td className="py-3 px-4 tabular-nums">
                  {reserved > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {reserved} res.
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono">0</span>
                  )}
                </td>
                <td className="py-3 px-4 tabular-nums">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold",
                      available > 0
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    )}
                  >
                    {available} avail.
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-300">{product.location || "General Bay"}</td>
                {!compact && (
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    {currency(product.sellingPrice)}
                  </td>
                )}
                <td className="py-3 px-4">
                  <StatusBadge product={product} />
                </td>
                {isAdmin && !compact && (
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {onAdjustStock && (
                        <button
                          type="button"
                          onClick={() => onAdjustStock(product)}
                          title="Adjust stock with audit reason"
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          <IconAdjustments className="size-3.5 text-indigo-400" />
                          <span>Adjust</span>
                        </button>
                      )}
                      {onEditProduct && (
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          title="Edit product details & photo"
                          className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-2 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-colors"
                        >
                          <IconEdit className="size-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Stock History Page ────────────────────────────────────── */

function History({ refreshKey }: { refreshKey: number }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  // Search, filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    api("/products/movements/history")
      .then(setMovements)
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  useEffect(() => {
    api("/orders")
      .then((data) =>
        setOrders(
          (Array.isArray(data) ? data : data.orders || []).filter(
            (order: any) => order.status === "DISPATCHED",
          ),
        ),
      )
      .catch(() => {});
  }, [refreshKey]);

  // Filtering calculation
  const filteredMovements = React.useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== "ALL" && m.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = (typeof m.product === "object" ? m.product?.name : m.productName || "").toLowerCase();
        const pSku = (typeof m.product === "object" ? m.product?.sku : m.productSku || "").toLowerCase();
        const reason = (m.reason || "").toLowerCase();
        const user = (m.userName || "").toLowerCase();
        const orderNum = (m.orderNumber || "").toLowerCase();
        const poRef = (m.poReference || "").toLowerCase();
        const supplier = (m.supplier || "").toLowerCase();
        const note = (m.note || "").toLowerCase();
        if (
          !pName.includes(q) &&
          !pSku.includes(q) &&
          !reason.includes(q) &&
          !user.includes(q) &&
          !orderNum.includes(q) &&
          !poRef.includes(q) &&
          !supplier.includes(q) &&
          !note.includes(q)
        )
          return false;
      }
      if (fromDate && new Date(m.createdAt) < new Date(fromDate)) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(m.createdAt) > end) return false;
      }
      return true;
    });
  }, [movements, typeFilter, searchQuery, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMovements = filteredMovements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <DataState loading={!movements.length && !error} error={error}>
      <div className="space-y-6">
        {/* Movements Ledger */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Movement Audit Trail
              </h2>
              <p className="text-xs text-slate-400">
                Audited stock additions and deductions in chronological order
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportMovementsCsv(filteredMovements, "stock_movements_audit.csv")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-750 transition-all shadow-sm"
                title="Download filtered stock movements as CSV spreadsheet"
              >
                <IconDownload className="size-3.5 text-indigo-400" />
                <span>Export Audit CSV</span>
              </button>
              <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
                {filteredMovements.length} Records
              </span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="relative">
              <IconSearch className="absolute left-3 top-2.5 size-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search product, SKU, user..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">All Movement Types</option>
              <option value="RECEIVE">RECEIVE (+)</option>
              <option value="DISPATCH">DISPATCH (-)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Audit)</option>
              <option value="RETURN">RETURN (+)</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              title="Filter from date"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              title="Filter to date"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4">Quantity Units</th>
                  <th className="py-3 px-4">Handled By</th>
                  <th className="py-3 px-4">Reference / Notes</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      No stock movements found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((movement) => (
                    <tr key={movement._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <div className="flex items-center gap-2">
                          <ProductThumbnail product={movement.product} size="sm" />
                          <span>{movement.product?.name || "Deleted Product"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {movement.product?.sku || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                            movement.type === "RECEIVE"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : movement.type === "RETURN"
                              ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                              : movement.type === "ADJUSTMENT"
                              ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
                          )}
                        >
                          {movement.type === "RECEIVE" || movement.type === "RETURN" ? "+" : "-"} {movement.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white tabular-nums">
                        {movement.quantity}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {movement.userName || movement.userId?.name || "Staff"}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs">
                        <div className="flex flex-col gap-0.5">
                          {movement.orderNumber && (
                            <span className="font-mono text-indigo-400 font-semibold text-[11px]">
                              {movement.orderNumber}
                            </span>
                          )}
                          {movement.poReference && (
                            <span className="text-[11px] text-amber-300 font-mono">
                              PO: {movement.poReference}
                            </span>
                          )}
                          {movement.supplier && (
                            <span className="text-[11px] text-slate-400">
                              Supplier: {movement.supplier}
                            </span>
                          )}
                          <span className="text-slate-400 truncate text-[11px]" title={movement.reason || movement.note || ""}>
                            {movement.reason || movement.note || (movement.orderNumber ? "Order Dispatch" : "—")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(movement.createdAt).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs text-slate-400">
            <span>
              Showing {filteredMovements.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredMovements.length)} of {filteredMovements.length} movements
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Dispatch History Ledger */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Fulfilled Dispatches Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Orders successfully processed, packed, and handed to logistics
              </p>
            </div>
            <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
              {orders.length} Dispatched
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/40 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Dispatched Units</th>
                  <th className="py-3 px-4">Commercial Value</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Dispatched Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white font-mono">
                      {order.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-200">{order.client?.name}</td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {order.items.reduce((sum: number, item: any) => sum + item.quantity, 0)} units
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">
                      {currency(order.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        {statusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(order.dispatchedAt || order.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("wms-navigate", { detail: "orders" }),
                            );
                            window.setTimeout(
                              () =>
                                window.dispatchEvent(
                                  new CustomEvent("wms-open-order", {
                                    detail: order._id,
                                  }),
                                ),
                              0,
                            );
                          }}
                          className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/40"
                        >
                          Details
                        </button>
                        <button
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("wms-show-invoice", {
                                detail: buildInvoice(order),
                              }),
                            )
                          }
                          className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DataState>
  );
}

/* ─── High-Fidelity Tax Invoice Print Modal ─────────────────── */

function Invoice({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const gstCalc = React.useMemo(() => {
    return computeInvoiceGst(
      invoice,
      INVOICE_SELLER_DETAILS.state || "Karnataka",
      INVOICE_SELLER_DETAILS.gstin || "",
    );
  }, [invoice]);

  const formattedDate = (invoice.date instanceof Date ? invoice.date : new Date(invoice.date || invoice.createdAt || Date.now())).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const [feedback, setFeedback] = useState<string>("");

  const handleSendWhatsApp = async () => {
    const rawPhone = invoice.client?.phone;
    if (!normalizePhone(rawPhone)) {
      setShowPhoneModal(true);
      return;
    }
    try {
      setFeedback("Sending invoice PDF via WhatsApp...");
      await sendInvoiceWhatsAppTiered({
        order: invoice,
        isReminder: false,
        onToast: (msg) => setFeedback(msg),
      });
      setTimeout(() => setFeedback(""), 4000);
    } catch (err: any) {
      setFeedback(`WhatsApp send failed: ${err.message}`);
    }
  };

  const handlePrintPdf = () => {
    const orderId = invoice.orderId || invoice._id || invoice.id;
    if (orderId) {
      viewInvoicePdfInTab(orderId);
    } else {
      window.print();
    }
  };

  const handleCopyInvoice = () => {
    const msg = buildInvoiceMessage(invoice);
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto print-wrap">
      <article
        className="print-invoice-area relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 text-slate-900 shadow-2xl max-h-[95vh] overflow-y-auto"
        aria-label="Tax invoice"
      >
        {/* Non-print control actions */}
        <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
          {feedback && (
            <span className="mr-auto text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {feedback}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCopyInvoice}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            title="Copy invoice message"
          >
            {copied ? (
              <>
                <IconCheck className="size-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <IconCopy className="size-3.5 text-slate-600" />
                <span>Copy Message</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition-colors"
            title="Send invoice PDF to client on WhatsApp"
          >
            <IconBrandWhatsapp className="size-4" />
            <span>Send on WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-colors"
            title="Open identical official A4 GST Tax Invoice PDF for printing"
          >
            <IconPrinter className="size-4" />
            <span>Print Tax Invoice (PDF)</span>
          </button>
        </div>

        {/* Invoice Header */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo2.png"
              alt="Denika and Team Solutions"
              className="h-14 w-auto object-contain"
            />
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-950 font-heading">
                DENIKA AND TEAM SOLUTIONS
              </h1>
              <p className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">
                {gstCalc.docTitle}
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <div className="font-mono text-sm font-black text-indigo-950">
              #{invoice.invoiceNumber || invoice.number}
            </div>
            <div className="text-slate-600 mt-0.5">Date: {formattedDate}</div>
            <div className="text-[11px] text-slate-500">Place of Supply: <strong>{gstCalc.placeOfSupply}</strong></div>
            <div className="mt-1.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-800 border border-slate-200">
              {gstCalc.badgeLabel}
            </div>
          </div>
        </header>

        {/* Seller & Buyer Party Cards */}
        <section className="grid grid-cols-2 gap-4 py-3 text-xs border-b border-slate-200">
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 space-y-0.5">
            <h3 className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              SELLER / CONSIGNOR
            </h3>
            <strong className="block text-xs font-bold text-slate-900">
              {INVOICE_SELLER_DETAILS.name}
            </strong>
            <p className="text-[11px] text-slate-600">{INVOICE_SELLER_DETAILS.address}</p>
            <p className="text-[11px] text-slate-600">Phone: {INVOICE_SELLER_DETAILS.phone}</p>
            <p className="text-[11px] text-slate-600">Email: {INVOICE_SELLER_DETAILS.email}</p>
            <p className="text-[11px] font-semibold text-slate-800">
              {gstCalc.sellerGstin ? `GSTIN: ${gstCalc.sellerGstin}` : "GSTIN: Unregistered / Bill of Supply"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 space-y-0.5">
            <h3 className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              BILL TO / CONSIGNEE
            </h3>
            <strong className="block text-xs font-bold text-slate-900">
              {invoice.client?.name}
            </strong>
            <p className="text-[11px] text-slate-600">Phone: {invoice.client?.phone}</p>
            <p className="text-[11px] text-slate-600">{invoice.client?.address}</p>
            {invoice.client?.gstin && (
              <p className="text-[11px] font-semibold text-slate-800">
                GSTIN: {invoice.client?.gstin}
              </p>
            )}
            <p className="text-[10px] text-slate-500">
              Payment Terms: Due on Receipt / Grace 3 Days
            </p>
          </div>
        </section>

        {/* Line Items Table with HSN & GST */}
        <section className="py-3">
          <table className="w-full text-left text-xs border border-slate-200">
            <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700 tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-1.5 px-2 w-8 text-center">#</th>
                <th className="py-1.5 px-2">Item Description</th>
                <th className="py-1.5 px-2 font-mono">HSN</th>
                <th className="py-1.5 px-2 text-center">Qty</th>
                <th className="py-1.5 px-2 text-right">Unit Price</th>
                <th className="py-1.5 px-2 text-right">Taxable</th>
                {!gstCalc.isBillOfSupply && (
                  <>
                    <th className="py-1.5 px-2 text-center">GST</th>
                    <th className="py-1.5 px-2 text-right">Tax</th>
                  </>
                )}
                <th className="py-1.5 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {gstCalc.items.map((item: any, index: number) => (
                <tr key={item.sku || index}>
                  <td className="py-1.5 px-2 text-center text-slate-500">{index + 1}</td>
                  <td className="py-1.5 px-2 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-1.5 px-2 text-slate-600 font-mono text-[11px]">{item.hsn}</td>
                  <td className="py-1.5 px-2 text-center font-bold text-slate-900">{item.quantity}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{invoiceCurrency(item.sellingPrice)}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{invoiceCurrency(item.taxableAmount)}</td>
                  {!gstCalc.isBillOfSupply && (
                    <>
                      <td className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-600">
                        {item.gstPercent}%
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-[11px] text-slate-700">
                        {invoiceCurrency(item.cgstAmount + item.sgstAmount + item.igstAmount)}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 px-2 text-right font-bold text-slate-900 font-mono">
                    {invoiceCurrency(item.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Invoice Summary Block */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-0.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
              AMOUNT IN WORDS
            </span>
            <strong className="block text-xs text-slate-900 leading-snug">
              {amountInWords(gstCalc.grandTotal)}
            </strong>
          </div>

          <div className="space-y-1 text-right">
            <div className="flex justify-between text-slate-600 text-xs">
              <span>Taxable Amount:</span>
              <span className="font-mono">{invoiceCurrency(gstCalc.taxableAmount)}</span>
            </div>
            {!gstCalc.isBillOfSupply && (
              <>
                {gstCalc.totalIgst > 0 ? (
                  <div className="flex justify-between text-slate-600 text-xs">
                    <span>IGST:</span>
                    <span className="font-mono">{invoiceCurrency(gstCalc.totalIgst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>CGST (9%):</span>
                      <span className="font-mono">{invoiceCurrency(gstCalc.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>SGST (9%):</span>
                      <span className="font-mono">{invoiceCurrency(gstCalc.totalSgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-600 text-xs">
                  <span>Total Tax:</span>
                  <span className="font-mono">{invoiceCurrency(gstCalc.totalTax)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm font-black text-slate-950 border-t-2 border-slate-900 pt-1.5">
              <span>GRAND TOTAL:</span>
              <span className="font-mono">{invoiceCurrency(gstCalc.grandTotal)}</span>
            </div>
          </div>
        </section>

        {/* Terms & Payment Conditions */}
        <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Advance Required</span>
            <strong className="text-slate-900">{invoice.advancePercentage || 30}% · {invoiceCurrency(invoice.advanceRequired || 0)}</strong>
          </div>
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Payment Status</span>
            <strong className="text-indigo-900">{statusLabel(invoice.paymentStatus)}</strong>
          </div>
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Total Paid</span>
            <strong className="text-emerald-800">{invoiceCurrency(invoice.totalPaid || 0)}</strong>
          </div>
          <div>
            <span className="block text-[9px] text-slate-500 uppercase font-bold">Balance Due</span>
            <strong className="text-rose-800">{invoiceCurrency(invoice.balanceAmount || 0)}</strong>
          </div>
        </section>

        {/* Signatures */}
        <footer className="mt-4 pt-3 border-t border-slate-200 flex items-end justify-between text-xs text-slate-600">
          <div>
            <p className="italic text-[11px]">Thank you for your business.</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Computer-generated commercial invoice.</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-900">For Denika and Team Solutions</span>
            <div className="my-1 font-serif text-base italic text-slate-800">
              Denika and Team Solutions
            </div>
            <span className="text-[9px] text-slate-500">Authorized Signatory</span>
          </div>
        </footer>
      </article>

      <WhatsAppPhoneModal
        isOpen={showPhoneModal}
        initialPhone={invoice.client?.phone || ""}
        clientName={invoice.client?.name || "Client"}
        orderNumber={invoice.number}
        onSend={async (validPhone) => {
          setShowPhoneModal(false);
          const updatedInvoice = { ...invoice, client: { ...invoice.client, phone: validPhone } };
          setFeedback("Dispatching invoice PDF via WhatsApp...");
          await sendInvoiceWhatsAppTiered({
            order: updatedInvoice,
            isReminder: false,
            onToast: (msg) => setFeedback(msg),
          });
        }}
        onCopy={handleCopyInvoice}
        onClose={() => setShowPhoneModal(false)}
        copied={copied}
      />
    </div>
  );
}

export default App;
