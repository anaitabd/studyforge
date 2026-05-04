"use client";

import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { useGroups } from "@/lib/hooks/useApi";

export default function AnalyticsIndex() {
  const { data: groups, isLoading } = useGroups();

  return (
    <div>
      <h1 className="font-sora text-2xl font-bold text-primary mb-1">Analytics</h1>
      <p className="text-sm text-slate-500 mb-6">Pick a group to see student engagement & exam stats.</p>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (groups ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">No groups yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {groups!.map((g) => (
            <Link key={g.id} href={`/analytics/${g.id}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all">
              <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><BarChart2 size={16} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-sora font-semibold text-primary truncate">{g.name}</p>
                <p className="text-xs text-slate-500">{g.member_count} members · {g.file_count} files</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
