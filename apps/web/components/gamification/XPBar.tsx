"use client";

import { useMyXP } from "@/lib/hooks/use-gamification";

export function XPBar() {
  const { data: xp } = useMyXP();
  if (!xp) return null;

  const pct = Math.min(100, ((xp.total_xp % xp.xp_to_next_level) / xp.xp_to_next_level) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {xp.level}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-slate-700">{xp.level_title}</span>
          <span className="text-slate-500">{xp.total_xp} XP</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
