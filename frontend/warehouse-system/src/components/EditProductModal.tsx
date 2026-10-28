import React, { useState } from "react";
import { IconX, IconUpload, IconTrash, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { api } from "@/lib/api";
import { ProductThumbnail } from "./ProductThumbnail";

interface Product {
  _id: string;
  name: string;
  sku: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minimumStock: number;
  location?: string;
  hsn?: string;
  gstPercent?: number;
  leadTimeDays?: number;
  minOrderQty?: number;
  supplier?: string | { name?: string; phone?: string };
  isActive?: boolean;
  imageUrl?: string | null;
}

interface EditProductModalProps {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProductModal({ product, onClose, onSaved }: EditProductModalProps) {
  const [formData, setFormData] = useState({
    name: product.name || "",
    purchasePrice: product.purchasePrice || 0,
    sellingPrice: product.sellingPrice || 0,
    minimumStock: product.minimumStock ?? 5,
    location: product.location || "General Bay",
    hsn: product.hsn || "8504",
    gstPercent: product.gstPercent ?? 18,
    leadTimeDays: product.leadTimeDays ?? 7,
    minOrderQty: product.minOrderQty ?? 10,
    supplier: typeof product.supplier === "object" ? product.supplier?.name || "" : (product.supplier || ""),
    isActive: product.isActive !== false,
  });

  const [imageUrl, setImageUrl] = useState<string | null>(product.imageUrl || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image file size must be less than 2 MB");
      return;
    }

    const data = new FormData();
    data.append("image", file);

    setUploadingImage(true);
    setError("");
    try {
      const res = await api(`/products/${product._id}/image`, {
        method: "POST",
        body: data,
      });
      if (res.imageUrl) {
        setImageUrl(res.imageUrl);
        setSuccess("Product thumbnail updated!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    setUploadingImage(true);
    setError("");
    try {
      await api(`/products/${product._id}/image`, { method: "DELETE" });
      setImageUrl(null);
      setSuccess("Product image removed.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`/products/${product._id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const res = await api(`/products/${product._id}/toggle-status`, { method: "PATCH" });
      setFormData((prev) => ({ ...prev, isActive: res.isActive }));
      setSuccess(`Product marked as ${res.isActive ? "Active" : "Archived"}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to toggle status");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to archive/delete ${product.name}?`)) return;
    try {
      await api(`/products/${product._id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete product");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0d1322] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <ProductThumbnail product={{ name: formData.name, imageUrl }} size="md" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                EDIT PRODUCT MASTER
              </span>
              <h2 className="text-lg font-bold text-white font-heading">{product.sku}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            <IconAlertTriangle className="size-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <IconCheck className="size-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {/* Image upload section */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Product Thumbnail (WebP 600px Max)
          </h3>
          <div className="flex items-center gap-4">
            <ProductThumbnail product={{ name: formData.name, imageUrl }} size="lg" />
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-600/20 px-3.5 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-600/30 cursor-pointer transition-all">
                <IconUpload className="size-4" />
                <span>{uploadingImage ? "Uploading…" : "Upload Photo"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingImage}
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>

              {imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                  <IconTrash className="size-4" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Storage Bay / Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Purchase Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Minimum Stock Level (Safety threshold)
              </label>
              <input
                type="number"
                min="0"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                HSN Code
              </label>
              <input
                type="text"
                value={formData.hsn}
                onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                GST Rate (%)
              </label>
              <select
                value={formData.gstPercent}
                onChange={(e) => setFormData({ ...formData, gstPercent: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18% (Standard)</option>
                <option value={28}>28%</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Replenishment Lead Time (Days)
              </label>
              <input
                type="number"
                min="1"
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Minimum Batch Order Qty (MOQ)
              </label>
              <input
                type="number"
                min="1"
                value={formData.minOrderQty}
                onChange={(e) => setFormData({ ...formData, minOrderQty: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Preferred Supplier
              </label>
              <input
                type="text"
                placeholder="e.g. Bosch India Tooling Ltd"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleActive}
                className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-all ${
                  formData.isActive
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                }`}
              >
                {formData.isActive ? "Active (In Catalogue)" : "Archived (Inactive)"}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-all"
              >
                Delete / Archive
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
