"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";

export function JoinRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  const join = useMutation({
    mutationFn: () => apiPost<{ id: string }>(`/api/v1/rooms/join/${code.trim().toUpperCase()}`),
    onSuccess: (r) => { toast.success("Joined!"); onClose(); router.push(`/rooms/${r.id}`); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in" onClick={onClose}>
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-sora text-lg font-semibold text-primary">Join a room</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) join.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Invite code</label>
            <input
              className="input font-mono uppercase tracking-widest text-center text-lg"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="ABCD1234"
              maxLength={8}
              autoFocus
              required
            />
          </div>
          <button
            type="submit"
            disabled={join.isPending || code.length < 4}
            className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {join.isPending && <Loader2 size={14} className="animate-spin" />}
            Join room
          </button>
        </form>
      </div>
    </div>
  );
}
