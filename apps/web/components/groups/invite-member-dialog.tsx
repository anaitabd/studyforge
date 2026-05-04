"use client";

import { useState } from "react";
import { X, Copy, Loader2, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export function InviteMemberDialog({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"link" | "email">("link");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => apiPost<{ invite_url: string; expires_in_hours: number }>(`/api/v1/groups/${groupId}/invite-link`),
    onSuccess: (d) => setLink(d.invite_url),
    onError: (e) => toast.error((e as Error).message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sora text-lg font-semibold text-primary">Invite members</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex border-b border-slate-200 mb-5">
          {(["link", "email"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors", tab === t ? "border-accent text-accent" : "border-transparent text-slate-500")}
            >
              {t === "link" ? "Share link" : "By email"}
            </button>
          ))}
        </div>

        {tab === "link" && (
          <div>
            {!link ? (
              <button
                type="button"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {generate.isPending && <Loader2 size={14} className="animate-spin" />}
                Generate invite link
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <input readOnly value={link} className="flex-1 input bg-slate-50 text-xs" />
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="px-3 rounded-lg border border-slate-300 hover:bg-slate-50"
                    aria-label="Copy"
                  >
                    {copied ? <Check size={14} className="text-teal" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-xs text-amber mt-2">Link expires in 72 hours</p>
              </>
            )}
          </div>
        )}

        {tab === "email" && (
          <div>
            <input type="email" placeholder="student@example.com" className="input mb-3" />
            <button type="button" disabled className="w-full px-4 py-2.5 rounded-lg bg-slate-200 text-slate-500 text-sm font-medium cursor-not-allowed">
              Email invites coming soon
            </button>
            <p className="text-xs text-slate-500 mt-2">For now, use the &ldquo;Share link&rdquo; tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
