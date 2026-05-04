"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useGroups } from "@/lib/hooks/useApi";
import { GroupCard } from "@/components/groups/group-card";
import { NewGroupDialog } from "@/components/groups/new-group-dialog";

export default function GroupsPage() {
  const { data: groups, isLoading } = useGroups();
  const [dialog, setDialog] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">My Groups</h1>
          <p className="text-sm text-slate-500 mt-0.5">Each group is a folder of files for one course.</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
        >
          <Plus size={15} /> New group
        </button>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (groups?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <Pencil className="mx-auto text-slate-300 mb-4" size={36} />
          <p className="font-sora text-lg font-semibold text-primary mb-1">Create your first group</p>
          <p className="text-sm text-slate-500 mb-6">Upload files, then chat, generate exams, and make flashcards from them.</p>
          <button
            type="button"
            onClick={() => setDialog(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
          >
            <Plus size={15} /> Create group
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groups!.map((g) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}

      <NewGroupDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  );
}
