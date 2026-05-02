"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { type StudentStat } from "@/lib/hooks/use-teacher";
import { cn } from "@/lib/utils";

type SortKey = "name" | "exams_taken" | "avg_score" | "chat_count";

export function StudentsTable({ students }: { students: StudentStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...students].sort((a, b) => {
    const av = a[sortKey] ?? -1;
    const bv = b[sortKey] ?? -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function Th({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-800 whitespace-nowrap"
      >
        <span className="flex items-center gap-1">
          {label}
          {active ? (
            sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          ) : (
            <ChevronUp size={12} className="opacity-20" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th col="name" label="Student" />
            <Th col="exams_taken" label="Exams taken" />
            <Th col="avg_score" label="Avg score" />
            <Th col="chat_count" label="Chat messages" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((s) => (
            <tr key={s.user_id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.email}</p>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{s.exams_taken}</td>
              <td className="px-4 py-3">
                {s.avg_score !== null ? (
                  <span
                    className={cn(
                      "font-medium",
                      s.avg_score >= 80
                        ? "text-emerald-600"
                        : s.avg_score >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                    )}
                  >
                    {s.avg_score}%
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{s.chat_count}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs">
                No students yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
