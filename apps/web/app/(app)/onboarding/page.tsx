"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";

type Role = "student" | "teacher" | "self_learner";
type Level = "college" | "lycee" | "universite" | "autre";
type Goal = "exams" | "revisions" | "comprehension" | "autre";

interface WizardState {
  role: Role | null;
  level: Level | null;
  goal: Goal | null;
  groupName: string;
}

const ROLES: { key: Role; label: string; icon: string }[] = [
  { key: "student", label: "Étudiant", icon: "🎓" },
  { key: "teacher", label: "Enseignant", icon: "📖" },
  { key: "self_learner", label: "Auto-apprenant", icon: "🚀" },
];

const LEVELS: { key: Level; label: string }[] = [
  { key: "college", label: "Collège" },
  { key: "lycee", label: "Lycée" },
  { key: "universite", label: "Université" },
  { key: "autre", label: "Autre" },
];

const GOALS: { key: Goal; label: string; desc: string }[] = [
  { key: "exams", label: "Préparer des examens", desc: "Génération d'examens et flashcards" },
  { key: "revisions", label: "Réviser efficacement", desc: "Répétition espacée et quiz" },
  { key: "comprehension", label: "Comprendre en profondeur", desc: "Chat RAG avec citations" },
  { key: "autre", label: "Autre", desc: "Explorer toutes les fonctionnalités" },
];

const STEP_LABELS = ["Rôle", "Niveau", "Objectif", "Premier groupe"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<WizardState>({
    role: null,
    level: null,
    goal: null,
    groupName: "",
  });

  function canAdvance() {
    if (step === 0) return state.role !== null;
    if (step === 1) return state.level !== null;
    if (step === 2) return state.goal !== null;
    if (step === 3) return state.groupName.trim().length >= 2;
    return false;
  }

  async function finish() {
    setLoading(true);
    try {
      const res = await api.post<{ id: string }>("/groups", {
        name: state.groupName.trim(),
        description: `Groupe créé lors de l'onboarding`,
      });
      toast.success("Bienvenue sur StudyForge !");
      router.push(`/groups/${res.data.id}`);
    } catch {
      toast.error("Erreur lors de la création du groupe");
      setLoading(false);
    }
  }

  const progress = ((step + 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`text-xs font-medium ${i <= step ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-lg">
          {/* Step 0 — Role */}
          {step === 0 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Qui êtes-vous ?</h1>
              <p className="text-sm text-gray-500 mb-6">Nous adaptons StudyForge à votre profil.</p>
              <div className="space-y-3">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setState((s) => ({ ...s, role: r.key }))}
                    className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors ${
                      state.role === r.key
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                    }`}
                  >
                    <span className="text-2xl">{r.icon}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{r.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 1 — Level */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Votre niveau</h1>
              <p className="text-sm text-gray-500 mb-6">Sélectionnez votre niveau d'études.</p>
              <div className="grid grid-cols-2 gap-3">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => setState((s) => ({ ...s, level: l.key }))}
                    className={`rounded-xl border-2 p-4 text-center font-medium transition-colors ${
                      state.level === l.key
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2 — Goal */}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Votre objectif principal</h1>
              <p className="text-sm text-gray-500 mb-6">Nous afficherons les outils les plus pertinents.</p>
              <div className="space-y-3">
                {GOALS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setState((s) => ({ ...s, goal: g.key }))}
                    className={`flex w-full flex-col rounded-xl border-2 p-4 text-left transition-colors ${
                      state.goal === g.key
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                    }`}
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{g.label}</span>
                    <span className="text-xs text-gray-500 mt-0.5">{g.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3 — First group */}
          {step === 3 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Créez votre premier groupe</h1>
              <p className="text-sm text-gray-500 mb-6">
                Un groupe est un espace où vous regroupez vos cours. Ex. : « Mathématiques S2 »
              </p>
              <input
                type="text"
                value={state.groupName}
                onChange={(e) => setState((s) => ({ ...s, groupName: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && canAdvance() && finish()}
                placeholder="Nom du groupe…"
                maxLength={80}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-colors"
              />
            </>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Retour
              </button>
            )}
            <button
              onClick={() => (step < 3 ? setStep((s) => s + 1) : finish())}
              disabled={!canAdvance() || loading}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Création…" : step < 3 ? "Continuer" : "Commencer →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
