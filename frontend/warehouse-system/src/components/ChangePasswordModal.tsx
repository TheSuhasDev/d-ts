import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  IconLock,
  IconKey,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
  IconCheck,
  IconShieldLock,
} from "@tabler/icons-react";

export function ChangePasswordModal() {
  const { logout, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current temporary password.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      await refreshUser();
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-rose-500/20 opacity-70 blur-xl" />

        <div className="relative rounded-2xl border border-slate-800 bg-[#0d1322] p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-inner">
              <IconShieldLock className="size-8" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white font-heading">
              Password Reset Required
            </h2>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              For security compliance, seeded credentials must be changed upon first login.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <IconAlertTriangle className="size-4 shrink-0 text-rose-400" />
                <span className="flex-1 font-medium">{error}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="current-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-300"
              >
                Current Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <IconKey className="size-4" />
                </div>
                <input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pr-10 pl-10 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showCurrent ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-300"
              >
                New Password (min 6 characters)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <IconLock className="size-4" />
                </div>
                <input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pr-10 pl-10 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showNew ? <IconEyeOff className="size-4" /> : <IconEye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-300"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <IconLock className="size-4" />
                </div>
                <input
                  id="confirm-password"
                  type={showNew ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pr-4 pl-10 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <span>Updating Password…</span>
                ) : (
                  <>
                    <IconCheck className="size-4" />
                    <span>Set New Password & Continue</span>
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api("/auth/skip-password-change", { method: "POST" });
                      await refreshUser();
                    } catch {
                      // Fallback: update local state
                      window.location.reload();
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex-1 rounded-xl border border-slate-800 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
