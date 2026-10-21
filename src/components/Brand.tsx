"use client";

import { useEffect } from "react";
import { useLiveState } from "@/components/useLiveState";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { logo: "h-8", text: "text-lg font-bold" },
  lg: { logo: "h-28", text: "text-6xl font-extrabold" },
  xl: { logo: "h-20", text: "text-4xl font-extrabold" },
};

/** Logo + nome configurados no admin (Admin → Branding). */
export function Brand({ size = "sm", className }: { size?: keyof typeof SIZES; className?: string }) {
  const { state } = useLiveState();
  const brand = state?.brand;

  useEffect(() => {
    if (brand) document.title = brand.name;
  }, [brand]);

  if (!brand) return null;
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center gap-3", size === "lg" && "flex-col", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {brand.logoUrl && <img src={brand.logoUrl} alt="" className={cn("w-auto object-contain", s.logo)} />}
      <span className={cn(s.text, size === "sm" && "text-primary")}>{brand.name}</span>
    </div>
  );
}
