"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Notebook, Timer, Users, Copy } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { PomodoroTimer } from "@/components/rooms/pomodoro-timer";
import { SharedNotes } from "@/components/rooms/shared-notes";
import { useRoomPresence } from "@/lib/hooks/use-room-presence";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function RoomDetailPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [tab, setTab] = useState<"chat" | "notes" | "timer">("notes");
  const { user } = useUser();
  const currentUser = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.fullName ?? user.firstName ?? "Anonymous",
            avatar_url: user.imageUrl ?? null,
          }
        : null,
    [user]
  );
  const { onlineUsers, enabled: presenceEnabled } = useRoomPresence(roomId, currentUser);

  return (
    <div>
      <Link href="/rooms" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-4">
        <ArrowLeft size={14} /> Rooms
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Users size={18} /></span>
        <h1 className="font-sora text-2xl font-bold text-primary">Study room</h1>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <aside>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Members {presenceEnabled && `· ${onlineUsers.length} online`}
            </p>
            {presenceEnabled ? (
              onlineUsers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Just you so far.</p>
              ) : (
                <ul className="space-y-1.5">
                  {onlineUsers.map((u) => (
                    <li key={u.userId} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="truncate">{u.name}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-xs text-slate-500 italic">Live presence requires Supabase env vars.</p>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Invite code</p>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(roomId); toast.success("Copied"); }}
                className="w-full inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono hover:border-accent"
              >
                <span className="truncate">{roomId.slice(0, 8).toUpperCase()}</span>
                <Copy size={11} />
              </button>
            </div>
          </div>
        </aside>

        <div>
          <div className="flex border-b border-slate-200 mb-4">
            {([
              { key: "chat", label: "AI Chat", icon: MessageSquare },
              { key: "notes", label: "Notes", icon: Notebook },
              { key: "timer", label: "Timer", icon: Timer },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors", tab === key ? "border-accent text-accent" : "border-transparent text-slate-500 hover:text-primary")}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <MessageSquare className="mx-auto text-slate-300 mb-3" size={32} />
              <p className="text-sm text-slate-500">Room-scoped AI chat coming soon.</p>
              <p className="text-xs text-slate-400 mt-1">Use the group chat for now.</p>
            </div>
          )}
          {tab === "notes" && <SharedNotes roomId={roomId} />}
          {tab === "timer" && <PomodoroTimer />}
        </div>
      </div>
    </div>
  );
}
