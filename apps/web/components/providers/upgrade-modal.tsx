"use client";

import { Sparkles, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function UpgradeModal() {
  const open = useAppStore((s) => s.upgradeModalOpen);
  const reason = useAppStore((s) => s.upgradeModalReason);
  const close = useAppStore((s) => s.closeUpgradeModal);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in" onClick={close}>
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button onClick={close} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
          <Sparkles className="text-accent" size={26} />
        </div>
        <h2 className="font-sora text-2xl font-bold text-primary mb-2">Upgrade to unlock</h2>
        <p className="text-sm text-slate-600 mb-6">{reason ?? "This feature requires a higher plan."}</p>
        <div className="space-y-2 mb-6 text-sm text-slate-700">
          <p className="flex items-center gap-2"><span className="text-teal">✓</span> Unlimited groups & files</p>
          <p className="flex items-center gap-2"><span className="text-teal">✓</span> AI flashcard generation</p>
          <p className="flex items-center gap-2"><span className="text-teal">✓</span> Study rooms with classmates</p>
          <p className="flex items-center gap-2"><span className="text-teal">✓</span> 500 AI messages/day</p>
        </div>
        <div className="flex gap-2">
          <button onClick={close} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Maybe later
          </button>
          <a href="/pricing" className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium text-center hover:bg-accent/90">
            See plans
          </a>
        </div>
      </div>
    </div>
  );
}
