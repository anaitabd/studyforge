"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Users, Copy, X, Loader2 } from "lucide-react";
import { useRooms, useCreateRoom, useJoinRoom, useCloseRoom } from "@/lib/hooks/use-rooms";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function RoomsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: rooms, isLoading } = useRooms(groupId);
  const { mutate: createRoom, isPending: creating } = useCreateRoom(groupId);
  const { mutate: joinRoom, isPending: joining } = useJoinRoom(groupId);
  const { mutate: closeRoom } = useCloseRoom(groupId);
  const [newName, setNewName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createRoom(newName.trim(), {
      onSuccess: (room) => {
        toast.success("Room created");
        setNewName("");
        setShowCreate(false);
        copyCode(room.invite_code);
      },
      onError: (err) => toast.error((err as Error).message),
    });
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    joinRoom(inviteCode.trim(), {
      onSuccess: () => {
        toast.success("Joined room");
        setInviteCode("");
        setShowJoin(false);
      },
      onError: (err) => toast.error((err as Error).message),
    });
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => toast.success(`Invite code copied: ${code}`));
  }

  function handleClose(roomId: string, name: string) {
    if (!confirm(`Close room "${name}"?`)) return;
    closeRoom(roomId, {
      onSuccess: () => toast.success("Room closed"),
      onError: (err) => toast.error((err as Error).message),
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/groups/${groupId}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 flex-1">Study rooms</h1>
        <button
          onClick={() => { setShowJoin(false); setShowCreate((v) => !v); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={15} />
          New room
        </button>
        <button
          onClick={() => { setShowCreate(false); setShowJoin((v) => !v); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
        >
          Join
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-5">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Room name"
            autoFocus
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {creating && <Loader2 size={13} className="animate-spin" />}
            Create
          </button>
        </form>
      )}

      {/* Join form */}
      {showJoin && (
        <form onSubmit={handleJoin} className="flex gap-2 mb-5">
          <input
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 uppercase tracking-widest"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="INVITE CODE"
            maxLength={8}
            autoFocus
          />
          <button
            type="submit"
            disabled={joining || !inviteCode.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {joining && <Loader2 size={13} className="animate-spin" />}
            Join
          </button>
        </form>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {rooms && rooms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <Users size={32} className="text-slate-300" />
          <p className="text-slate-500 text-sm">No active rooms.</p>
          <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">
            Create the first room →
          </button>
        </div>
      )}

      {rooms && rooms.length > 0 && (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id} className="group flex items-center gap-4 px-4 py-4 rounded-xl border border-slate-200 bg-white hover:border-primary/30 transition-all">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900">{room.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {room.member_count} member{room.member_count !== 1 ? "s" : ""}
                  {room.online_count !== undefined && room.online_count > 0 && (
                    <span className="text-emerald-500"> · {room.online_count} online</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => copyCode(room.invite_code)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-600 hover:border-primary hover:text-primary transition-colors"
                title="Copy invite code"
              >
                <Copy size={11} />
                {room.invite_code}
              </button>

              <button
                onClick={() => handleClose(room.id, room.name)}
                className={cn(
                  "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                  "hover:bg-red-50 text-slate-400 hover:text-red-500"
                )}
                title="Close room"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400 mt-6 text-center">
        Share the invite code with group members. Real-time features (presence, collaborative QCM) coming in a future update.
      </p>
    </div>
  );
}
