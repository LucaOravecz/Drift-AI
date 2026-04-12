"use client";

import { BRAND, type BrandingSnapshot } from "@/lib/brand-config";

interface BrandLogoProps {
  /** Show the Drift OS wordmark */
  showWordmark?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
  branding?: Partial<BrandingSnapshot>;
}

const sizeMap = {
  sm: { text: "text-sm" },
  md: { text: "text-lg" },
  lg: { text: "text-xl" },
};

/**
 * BrandLogo — single source-of-truth for the Drift OS wordmark.
 */
export function BrandLogo({ showWordmark = true, size = "md", className = "", branding }: BrandLogoProps) {
  const s = sizeMap[size];
  const resolved = {
    wordmark: branding?.wordmark ?? BRAND.wordmark,
  };

  return (
    <div className={`flex flex-row items-center ${className}`}>
      {showWordmark && (
        <span className={`${s.text} font-bold tracking-tight`}>{resolved.wordmark}</span>
      )}
    </div>
  );
}
