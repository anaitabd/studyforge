"use client";

import { useDailyChallenge } from "@/lib/hooks/use-gamification";

const ICONS: Record<string, string> = {
  review_N_cards: "🃏",
  complete_exam: "📝",
  chat_N_messages: "💬",
  study_N_minutes: "⏱️",
  complete_module: "📚",
};

export function DailyChallengeWidget() {
  const { data: challenge } = useDailyChallenge();
  if (!challenge) return null;

  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        challenge.completed
          ? "bg-emerald-50 border-emerald-400"
          : "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{ICONS[challenge.type] ?? "⭐"}</span>
          <span className="text-sm font-semibold text-slate-800">Défi du jour</span>
        </div>
        <span className="text-sm font-bold text-indigo-600">+{challenge.xp_reward} XP</span>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>
            {challenge.progress} / {challenge.target}
          </span>
          <span>{challenge.progress_pct}%</span>
        </div>
        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${challenge.progress_pct}%` }}
          />
        </div>
      </div>
      {challenge.completed && (
        <div className="text-center text-sm font-bold text-emerald-700">✓ Défi complété !</div>
      )}
    </div>
  );
}
