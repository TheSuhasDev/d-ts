import React, { useState } from "react";
import { Boxes, Sparkles, Building2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");

interface ProductThumbnailProps {
  product?: {
    name?: string;
    imageUrl?: string | null;
  };
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProductThumbnail({
  product,
  name,
  size = "md",
  className,
}: ProductThumbnailProps) {
  const [imgError, setImgError] = useState(false);
  const productName = product?.name || name || "";
  const imageUrl = product?.imageUrl;

  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-base",
  };

  if (imageUrl && !imgError) {
    const src = imageUrl.startsWith("http") ? imageUrl : `${API_BASE}${imageUrl}`;
    return (
      <img
        src={src}
        alt={productName}
        onError={() => setImgError(true)}
        className={cn(
          "rounded-lg object-cover border border-slate-700/60 bg-slate-800 shrink-0",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  const normalized = productName.toLowerCase();
  if (normalized.includes("drill")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
          sizeClasses[size],
          className
        )}
      >
        <Sparkles className="size-4" />
      </div>
    );
  }
  if (normalized.includes("hammer")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25",
          sizeClasses[size],
          className
        )}
      >
        <Building2 className="size-4" />
      </div>
    );
  }
  if (normalized.includes("screwdriver")) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
          sizeClasses[size],
          className
        )}
      >
        <TrendingUp className="size-4" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60",
        sizeClasses[size],
        className
      )}
    >
      <Boxes className="size-4" />
    </div>
  );
}
