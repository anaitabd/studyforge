"use client";

import { Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroupFile } from "@/lib/hooks/useApi";

const CFG = {
  uploading: { label: "Uploading", color: "text-slate-500 bg-slate-100", icon: Upload, spin: false },
  processing: { label: "Processing", color: "text-accent bg-accent/10", icon: Loader2, spin: true },
  ready: { label: "Ready", color: "text-teal bg-teal/10", icon: CheckCircle2, spin: false },
  error: { label: "Failed", color: "text-destructive bg-destructive/10", icon: AlertCircle, spin: false },
} as const;

export function FileStatusBadge({ status }: { status: GroupFile["status"] }) {
  const cfg = CFG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium", cfg.color)}>
      <Icon size={11} className={cn(cfg.spin && "animate-spin", status === "processing" && !cfg.spin && "animate-pulse")} />
      {cfg.label}
    </span>
  );
}
