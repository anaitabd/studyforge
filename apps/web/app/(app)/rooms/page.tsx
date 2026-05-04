"use client";

import { useState } from "react";
import { Plus, KeyRound, Users } from "lucide-react";
import { useGroups, useRooms } from "@/lib/hooks/useApi";
import { RoomCard } from "@/components/rooms/room-card";
import { CreateRoomDialog } from "@/components/rooms/create-room-dialog";
import { JoinRoomDialog } from "@/components/rooms/join-room-dialog";

export default function RoomsPage() {
  const { data: groups } = useGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">Study rooms</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time collab with classmates</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setJoinOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50">
            <KeyRound size={14} /> Join by code
          </button>
          <button type="button" onClick={() => { if (groups?.[0]) setSelectedGroup(groups[0].id); setCreateOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
            <Plus size={14} /> New room
          </button>
        </div>
      </div>

      {(groups ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <Users className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-sm text-slate-500">Create a group first, then make a study room.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(groups ?? []).map((g) => <GroupRoomsBlock key={g.id} groupId={g.id} groupName={g.name} />)}
        </div>
      )}

      {selectedGroup && <CreateRoomDialog groupId={selectedGroup} open={createOpen} onClose={() => setCreateOpen(false)} />}
      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}

function GroupRoomsBlock({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { data: rooms } = useRooms(groupId);
  if ((rooms ?? []).length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-500 mb-3">{groupName}</h2>
      <div className="space-y-2">
        {rooms!.map((r) => <RoomCard key={r.id} room={r} groupId={groupId} />)}
      </div>
    </section>
  );
}
