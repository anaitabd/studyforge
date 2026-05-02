"use client";

import Link from "next/link";
import { FileText, Users, Trash2 } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { useDeleteGroup, type Group } from "@/lib/hooks/use-groups";
import toast from "react-hot-toast";

export function GroupCard({ group }: { group: Group }) {
  const { mutate: deleteGroup, isPending } = useDeleteGroup();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return;
    deleteGroup(group.id, {
      onSuccess: () => toast.success("Group deleted"),
      onError: (err) => toast.error((err as Error).message),
    });
  }

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group relative"
    >
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
        aria-label="Delete group"
      >
        <Trash2 size={15} />
      </button>

      <h3 className="font-semibold text-slate-900 truncate pr-6">{group.name}</h3>
      {group.description && (
        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{group.description}</p>
      )}

      <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <FileText size={13} />
          {group.file_count} file{group.file_count !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Users size={13} />
          {group.member_count} member{group.member_count !== 1 ? "s" : ""}
        </span>
        <span className="ml-auto">{formatRelative(group.updated_at)}</span>
      </div>
    </Link>
  );
}
