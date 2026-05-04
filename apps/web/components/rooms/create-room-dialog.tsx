"use client";

import { useState } from "react";
import { X, Loader2, Copy, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";

export function CreateRoomDialog({ groupId, open, onClose }: { groupId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ invite_code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => apiPost<{ invite_code: string }>("/api/v1/rooms", { group_id: groupId, name: name.trim() }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["rooms", groupId] }); setCreated(r); toast.success("Room created"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const close = () => { setName(""); setCreated(null); onClose(); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in" onClick={close}>
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sora text-lg font-semibold text-primary">{created ? "Room created!" : "New study room"}</h2>
          <button type="button" onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>

        {!created ? (
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Room name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friday cram session" autoFocus required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                type="submit"
                disabled={create.isPending || !name.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {create.isPending && <Loader2 size={13} className="animate-spin" />}
                Create
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-sm text-slate-600 mb-4">Share this code with classmates so they can join:</p>
            <div className="rounded-xl bg-slate-100 p-6 text-center mb-4">
              <p className="font-mono text-3xl font-bold tracking-widest text-primary">{created.invite_code}</p>
            </div>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(created.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 inline-flex items-center justify-center gap-2"
            >
              {copied ? <Check size={14} className="text-teal" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
