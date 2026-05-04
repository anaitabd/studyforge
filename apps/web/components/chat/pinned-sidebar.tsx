"use client";

import { Pin } from "lucide-react";
import { usePinnedMessages } from "@/lib/hooks/useApi";

export function PinnedMessagesSidebar({ groupId }: { groupId: string }) {
  const { data } = usePinnedMessages(groupId);
  const pinned = data?.messages ?? [];
  if (pinned.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
        <Pin size={11} className="text-amber" /> Pinned
      </p>
      <ul className="space-y-2">
        {pinned.slice(0, 5).map((m) => (
          <li key={m.id}>
            <a href={`#msg-${m.id}`} className="block text-xs text-slate-600 line-clamp-2 hover:text-primary transition-colors">{m.content}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
