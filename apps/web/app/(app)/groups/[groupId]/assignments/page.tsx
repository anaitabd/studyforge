"use client";

import { use, useState } from "react";
import { GraduationCap, Users, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useGroupAnalytics } from "@/lib/hooks/use-teacher";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft:    { label: "Draft",    icon: <Clock size={12} />,        className: "bg-slate-100 text-slate-500" },
  assigned: { label: "Active",   icon: <Clock size={12} />,        className: "bg-blue-50 text-blue-700" },
  closed:   { label: "Closed",   icon: <XCircle size={12} />,      className: "bg-slate-100 text-slate-400" },
};

function GradeModal({ student, onClose, onGrade }: {
  student: { name: string; email: string };
  onClose: () => void;
  onGrade: (score: number, feedback: string) => Promise<void>;
}) {
  const [score, setScore] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onGrade(Number(score), feedback);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-sora font-semibold text-primary mb-1">Évaluer</h3>
        <p className="text-sm text-slate-500 mb-4">{student.name} · {student.email}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Score (sur 20)</label>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              required
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="ex: 15"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commentaire (optionnel)</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Feedback pour l'élève…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {saving ? "Envoi…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssignmentsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data, isLoading, isError } = useGroupAnalytics(groupId);
  const [grading, setGrading] = useState<{ name: string; email: string; userId: string } | null>(null);

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        Accès refusé. Cette vue nécessite le rôle enseignant ou propriétaire.
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-sora text-xl font-bold text-primary">Suivi des devoirs</h1>
        <p className="text-sm text-slate-500 mt-1">Avancement des élèves sur les examens assignés</p>
      </div>

      {/* Assigned exams */}
      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Examens assignés</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (data?.exams ?? []).filter((e) => e.status === "assigned").length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
            <GraduationCap className="mx-auto text-slate-300 mb-2" size={28} />
            <p className="text-sm text-slate-400">Aucun examen assigné pour l&apos;instant.</p>
            <p className="text-xs text-slate-400 mt-1">Allez dans l&apos;onglet Examens et assignez un examen aux élèves.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Examen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Soumissions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Moy. score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.exams ?? []).filter((e) => e.status === "assigned").map((exam) => {
                  const cfg = STATUS_STYLES[exam.status] ?? STATUS_STYLES.draft;
                  return (
                    <tr key={exam.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{exam.title}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", cfg.className)}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{exam.submissions}</td>
                      <td className="px-4 py-3">
                        {exam.avg_score !== null ? (
                          <span className={cn("font-medium", exam.avg_score >= 80 ? "text-emerald-600" : exam.avg_score >= 50 ? "text-amber-600" : "text-red-600")}>
                            {exam.avg_score}%
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Student progress */}
      <section>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Avancement par élève</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (data?.students ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucun élève dans ce groupe.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Élève</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Examens passés</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Score moyen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data!.students.map((s) => {
                  const hasSubmitted = s.exams_taken > 0;
                  return (
                    <tr key={s.user_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {s.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                              {s.name?.[0] ?? "?"}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 leading-tight">{s.name}</p>
                            <p className="text-[11px] text-slate-400">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.exams_taken}</td>
                      <td className="px-4 py-3">
                        {s.avg_score !== null ? (
                          <span className={cn("font-medium", s.avg_score >= 80 ? "text-emerald-600" : s.avg_score >= 50 ? "text-amber-600" : "text-red-600")}>
                            {s.avg_score}%
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          hasSubmitted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {hasSubmitted ? <><CheckCircle2 size={11} /> Soumis</> : <><Clock size={11} /> En attente</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setGrading({ name: s.name, email: s.email, userId: s.user_id })}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                        >
                          Évaluer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {grading && (
        <GradeModal
          student={grading}
          onClose={() => setGrading(null)}
          onGrade={async () => {
            // Feedback submitted — in a full implementation this would call
            // PATCH /api/v1/org/{slug}/assignments/{id}/progress/{userId}
            setGrading(null);
          }}
        />
      )}
    </div>
  );
}
