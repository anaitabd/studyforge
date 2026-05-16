"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Activity, BookOpen, MessageSquare, GraduationCap, Layers } from "lucide-react";
import { useStudentTimeline } from "@/lib/hooks/use-org-kpis";
import { useOrgMembers } from "@/lib/hooks/use-org";

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  "exam.started": { label: "Started exam", icon: GraduationCap, color: "text-amber-500" },
  "exam.submitted": { label: "Submitted exam", icon: GraduationCap, color: "text-green-600" },
  "flashcard.reviewed": { label: "Reviewed flashcard", icon: Layers, color: "text-accent" },
  "chat.message_sent": { label: "Sent a chat message", icon: MessageSquare, color: "text-blue-500" },
  "file.read": { label: "Read file", icon: BookOpen, color: "text-teal-500" },
  "learning_path.module_completed": { label: "Completed module", icon: BookOpen, color: "text-purple-600" },
  "slide.viewed": { label: "Viewed slide", icon: Layers, color: "text-slate-500" },
  "user.login": { label: "Logged in", icon: Activity, color: "text-slate-400" },
};

export default function StudentTimelinePage() {
  const { slug, userId } = useParams<{ slug: string; userId: string }>();
  const { data: events, isLoading } = useStudentTimeline(slug, userId);
  const { data: members } = useOrgMembers(slug);

  const student = (members ?? []).find((m) => m.user_id === userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href={`/org/${slug}/members`} className="hover:text-primary transition-colors">Members</Link>
        <ChevronRight size={14} />
        <span className="font-medium text-primary">{student?.name ?? userId}</span>
      </div>

      <div className="flex items-center gap-4">
        {student?.avatar_url ? (
          <img src={student.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-xl font-bold text-accent">
            {(student?.name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">{student?.name ?? "Student"}</h1>
          <p className="text-slate-400 text-sm">{student?.email}</p>
        </div>
      </div>

      <section>
        <h2 className="font-sora text-lg font-semibold text-primary mb-4">Activity timeline</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 h-8 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (events ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <Activity size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No activity recorded for this student yet.</p>
          </div>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200" />
            <div className="space-y-4">
              {(events ?? []).map((ev, i) => {
                const meta = EVENT_META[ev.event_type] ?? {
                  label: ev.event_type.replace(/\./g, " "),
                  icon: Activity,
                  color: "text-slate-400",
                };
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex gap-3 items-start relative">
                    <div className={`w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm ${meta.color}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-primary">{meta.label}</span>
                        {ev.metadata?.score != null && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {Math.round(Number(ev.metadata.score))}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(ev.time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
