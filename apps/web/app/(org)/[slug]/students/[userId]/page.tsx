"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Brain,
  BookOpen,
  MessageCircle,
  CheckSquare,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useStudentProfile } from "@/lib/hooks/use-org-admin";
import { useStudentTimeline, type StudentTimelineEvent } from "@/lib/hooks/use-org-kpis";
import { ScoreOver20 } from "@/components/org/score-over-20";

const EVENT_ICONS: Record<string, React.ElementType> = {
  "exam.submitted": FileText,
  "flashcard.reviewed": Brain,
  "file.read": BookOpen,
  "chat.message_sent": MessageCircle,
  "learning_path.module_completed": CheckSquare,
};

function eventLabel(event: StudentTimelineEvent): string {
  const labels: Record<string, string> = {
    "exam.submitted": "Submitted an exam",
    "flashcard.reviewed": "Reviewed flashcards",
    "file.read": "Read a file",
    "chat.message_sent": "Sent a chat message",
    "learning_path.module_completed": "Completed a learning path module",
  };
  return labels[event.event_type] ?? event.event_type.replace(/[._]/g, " ");
}

function TimelineEvent({ event }: { event: StudentTimelineEvent }) {
  const Icon = EVENT_ICONS[event.event_type] ?? Activity;
  const scoreOverTwenty =
    typeof event.metadata?.score_over_20 === "number"
      ? event.metadata.score_over_20
      : null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="w-px flex-1 bg-slate-200 mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <p className="text-sm text-slate-700">{eventLabel(event)}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {new Date(event.time).toLocaleString("fr-MA")}
        </p>
        {scoreOverTwenty != null && (
          <div className="mt-1">
            <ScoreOver20 score={scoreOverTwenty} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const { slug, userId } = useParams<{ slug: string; userId: string }>();
  const { data: profile, isLoading: profileLoading } = useStudentProfile(slug, userId);
  const { data: timeline, isLoading: timelineLoading } = useStudentTimeline(slug, userId);

  const trendData = profile?.exam_score_trend?.map((score, i) => ({
    exam: `#${i + 1}`,
    score,
  })) ?? [];

  if (profileLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-100" />
          <div className="space-y-2">
            <div className="h-6 w-40 bg-slate-100 rounded-xl" />
            <div className="h-4 w-28 bg-slate-100 rounded-xl" />
          </div>
        </div>
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm">Student not found.</p>
        <Link href={`/org/${slug}/members`} className="text-xs text-accent hover:underline mt-2 block">
          Back to members
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">
            {profile.name[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-sora text-xl font-bold text-primary">{profile.name}</h1>
          <p className="text-sm text-slate-500">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1">
            {profile.cohort_name && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {profile.cohort_name}
              </span>
            )}
            {profile.last_active && (
              <span className="text-xs text-slate-400">
                Last active {new Date(profile.last_active).toLocaleDateString("fr-MA")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Exam score trend */}
      {trendData.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Exam score trend</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="exam" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${typeof v === "number" ? v.toFixed(1) : "—"}/20`, "Score"]} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weak areas */}
      {profile.weak_areas?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Weak areas</h2>
          <div className="flex flex-wrap gap-2">
            {profile.weak_areas.map((area) => (
              <span
                key={area}
                className="text-xs bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-full"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Activity timeline</h2>
        {timelineLoading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : !timeline?.length ? (
          <p className="text-sm text-slate-400">No activity recorded yet.</p>
        ) : (
          <div className="relative">
            {timeline.map((event, i) => (
              <TimelineEvent key={i} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
