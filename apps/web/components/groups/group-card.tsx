"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Users, Trash2, MoreVertical } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "@/lib/api";
import toast from "react-hot-toast";
import type { Group } from "@/lib/hooks/use-groups";

export function GroupCard({ group }: { group: Group }) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => apiDelete(`/api/v1/groups/${group.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); toast.success("Group deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const initial = group.name.charAt(0).toUpperCase();
  const color = group.color ?? "#2563EB";

  return (
    <Link
      href={`/groups/${group.id}`}
      className="group relative block rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />

      <div className="flex items-start gap-3 pl-2">
        <span
          className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white font-sora font-bold"
          style={{ background: color }}
        >
          {initial}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-sora font-semibold text-primary truncate">{group.name}</h3>
          {group.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{group.description}</p>}
        </div>
        {(group.my_role === "owner" || !group.my_role) && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-slate-100"
            aria-label="Group actions"
          >
            <MoreVertical size={14} />
          </button>
        )}
        {menuOpen && (
          <div
            className="absolute right-3 top-12 z-10 rounded-lg border border-slate-200 bg-white shadow-md py-1 min-w-[140px]"
            onClick={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                if (confirm(`Delete "${group.name}"?`)) del.mutate();
              }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-400 pl-2">
        <span className="flex items-center gap-1"><FileText size={12} /> {group.file_count}</span>
        <span className="flex items-center gap-1"><Users size={12} /> {group.member_count}</span>
        <span className="ml-auto">{group.updated_at ? formatDistanceToNow(new Date(group.updated_at), { addSuffix: true }) : ""}</span>
      </div>
    </Link>
  );
}
