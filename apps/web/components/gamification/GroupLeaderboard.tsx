"use client";

import { useGroupLeaderboard } from "@/lib/hooks/use-gamification";

const MEDALS = ["🥇", "🥈", "🥉"];

export function GroupLeaderboard({ groupId }: { groupId: string }) {
  const { data: lb, isLoading } = useGroupLeaderboard(groupId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!lb?.members.length) {
    return <p className="text-sm text-slate-500 text-center py-6">Aucun membre classé pour l'instant.</p>;
  }

  return (
    <div className="space-y-2">
      {lb.members.map((member, i) => (
        <div
          key={member.user_id}
          className={`flex items-center gap-3 p-3 rounded-xl ${
            member.is_me
              ? "bg-indigo-50 border border-indigo-200"
              : "bg-white border border-slate-100"
          }`}
        >
          <span className="text-xl w-8 text-center flex-shrink-0">
            {MEDALS[i] ?? (
              <span className="text-sm font-bold text-slate-500">#{i + 1}</span>
            )}
          </span>
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
            {member.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
            <p className="text-xs text-slate-500">{member.level_title}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-indigo-600">{member.total_xp.toLocaleString()}</p>
            <p className="text-xs text-slate-400">XP</p>
          </div>
        </div>
      ))}
    </div>
  );
}
