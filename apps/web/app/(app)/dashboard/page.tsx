"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useGroups } from "@/lib/hooks/use-groups";
import { GroupCard } from "@/components/groups/group-card";
import { CreateGroupModal } from "@/components/groups/create-group-modal";

export default function DashboardPage() {
  const { data: groups, isLoading, isError } = useGroups();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your groups</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload files and start studying</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          New group
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-500">Failed to load groups. Please refresh.</p>
      )}

      {groups && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-slate-500 text-sm">No groups yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Create your first group →
          </button>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
