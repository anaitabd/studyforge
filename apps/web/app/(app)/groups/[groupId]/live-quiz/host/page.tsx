"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";

interface LiveQuizState {
  event: string;
  question_index?: number;
  question?: {
    content: string;
    options: Record<string, string>;
    type: string;
    time_limit_seconds: number;
  };
  participant_count?: number;
  started_at?: string;
}

export default function LiveQuizHostPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [state, setState] = useState<LiveQuizState | null>(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [creating, setCreating] = useState(false);

  async function createQuiz() {
    setCreating(true);
    try {
      const res = await api.post("/api/v1/live-quiz/create", { group_id: groupId });
      setQuizId(res.data.quiz_id);
      setPin(res.data.pin);
      setState({ event: "lobby", participant_count: 0 });
    } finally {
      setCreating(false);
    }
  }

  async function startQuiz() {
    if (!quizId) return;
    await api.post(`/api/v1/live-quiz/${quizId}/start`);
  }

  async function nextQuestion() {
    if (!quizId) return;
    await api.post(`/api/v1/live-quiz/${quizId}/next`);
    setAnswerCount(0);
  }

  async function endQuiz() {
    if (!quizId) return;
    await api.post(`/api/v1/live-quiz/${quizId}/end`);
  }

  useEffect(() => {
    if (!quizId) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const es = new EventSource(`${apiBase}/api/v1/live-quiz/${quizId}/stream`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as LiveQuizState;
      setState(data);
      if (data.event === "answer_submitted") {
        setAnswerCount((c) => c + 1);
      }
    };
    return () => es.close();
  }, [quizId]);

  if (!quizId) {
    return (
      <div className="min-h-screen bg-indigo-900 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Créer un quiz en direct</h1>
          <button
            onClick={createQuiz}
            disabled={creating}
            className="bg-emerald-500 text-white px-10 py-4 rounded-2xl text-xl font-bold hover:bg-emerald-400 disabled:opacity-50"
          >
            {creating ? "Création..." : "Démarrer un quiz →"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-900 text-white p-6">
      {/* PIN display */}
      <div className="text-center mb-8">
        <p className="text-indigo-300 text-sm uppercase tracking-wide">Code d'accès</p>
        <p className="text-7xl font-bold tracking-widest text-white">{pin}</p>
        <p className="text-indigo-300 text-sm">studyforge.ma/rejoindre</p>
      </div>

      {state?.event === "lobby" && (
        <div className="text-center space-y-4">
          <p className="text-2xl">{state.participant_count ?? 0} élèves connectés</p>
          <button
            onClick={startQuiz}
            className="bg-emerald-500 text-white px-10 py-4 rounded-2xl text-xl font-bold hover:bg-emerald-400"
          >
            Démarrer ! →
          </button>
        </div>
      )}

      {state?.event?.startsWith("question") && (
        <div className="space-y-6">
          <div className="bg-white/10 rounded-2xl p-6">
            <p className="text-2xl font-bold">{state.question?.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(state.question?.options ?? {}).map(([key, val]) => (
              <div key={key} className="bg-white/10 rounded-xl p-4 text-lg font-medium">
                <span className="font-bold mr-2">{key}.</span>
                {val}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xl">{answerCount} réponses reçues</p>
            <div className="flex gap-3">
              <button
                onClick={nextQuestion}
                className="bg-amber-400 text-slate-900 px-6 py-3 rounded-xl font-bold"
              >
                Suivant →
              </button>
              <button
                onClick={endQuiz}
                className="bg-red-500 text-white px-6 py-3 rounded-xl font-bold"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {state?.event === "quiz_finished" && (
        <div className="text-center space-y-4">
          <p className="text-4xl font-bold">Quiz terminé !</p>
          <p className="text-indigo-300">Consultez les résultats dans l'onglet Examens.</p>
        </div>
      )}
    </div>
  );
}
