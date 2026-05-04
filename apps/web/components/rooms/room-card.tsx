"use client";

import Link from "next/link";
import { Users, Copy, X, Check } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "@/lib/api";
import toast from "react-hot-toast";
import type { StudyRoom } from "@/lib/hooks/useApi";

export function RoomCard({ room, groupId, ownerView = true }: { room: StudyRoom; groupId: string; ownerView?: boolean }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const close = useMutation({
    mutationFn: () => apiDelete(`/api/v1/rooms/${room.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rooms", groupId] }); toast.success("Room closed"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <article className="group flex items-center gap-4 px-4 py-4 rounded-2xl border border-slate-200 bg-white hover:border-accent/30 transition-all">
      <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Users size={18} /></span>
      <div className="flex-1 min-w-0">
        <Link href={`/rooms/${room.id}`} className="font-sora font-semibold text-primary hover:text-accent">{room.name}</Link>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {room.member_count} member{room.member_count !== 1 ? "s" : ""}
          <span className="text-slate-300 italic ml-1">· presence coming soon</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(room.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success(`Code copied: ${room.invite_code}`); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-600 hover:border-accent hover:text-accent transition-colors"
        title="Copy invite code"
      >
        {copied ? <Check size={11} className="text-teal" /> : <Copy size={11} />}
        {room.invite_code}
      </button>
      {ownerView && (
        <button
          type="button"
          onClick={() => { if (confirm(`Close room "${room.name}"?`)) close.mutate(); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-destructive transition-all"
          aria-label="Close room"
        >
          <X size={15} />
        </button>
      )}
    </article>
  );
}
