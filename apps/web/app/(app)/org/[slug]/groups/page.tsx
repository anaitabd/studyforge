"use client";

import { useRouter } from "next/navigation";
import { Users, FileText, Calendar } from "lucide-react";
import { useGroups } from "@/lib/hooks/use-groups";

export default function OrgGroupsPage() {
  const router = useRouter();
  const { data: groups, isLoading } = useGroups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">Groups</h1>
        <p className="text-slate-500 text-sm mt-1">All study groups within your organisation.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (groups ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
          No groups yet. Members can create groups from their dashboard.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {(groups ?? []).map((group) => (
            <button
              key={group.id}
              onClick={() => router.push(`/groups/${group.id}`)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm"
                  style={{ backgroundColor: group.color ?? "#6366f1" }}
                >
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-slate-400 line-clamp-1">{group.description}</p>
                  )}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-5 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {group.member_count}
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={12} /> {group.file_count}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {new Date(group.created_at).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
