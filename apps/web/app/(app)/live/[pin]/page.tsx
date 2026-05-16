"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";

type Phase = "join" | "lobby" | "question" | "answered" | "finished";

interface Question {
  content: string;
  options: Record<string, string>;
  type: string;
  time_limit_seconds: number;
}

const OPTION_COLORS = [
  "bg-red-500 hover:bg-red-400",
  "bg-blue-500 hover:bg-blue-400",
  "bg-amber-500 hover:bg-amber-400",
  "bg-emerald-500 hover:bg-emerald-400",
];

export default function LiveQuizStudentPage() {
  const { pin } = useParams<{ pin: string }>();
  const [phase, setPhase] = useState<Phase>("join");
  const [nickname, setNickname] = useState("");
  const [quizId, setQuizId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answerStart, setAnswerStart] = useState(0);
  const [score, setScore] = useState(0);
  const [lastResult, setLastResult] = useState<{ is_correct: boolean; points_earned: number } | null>(null);

  async function joinQuiz() {
    if (!nickname.trim()) return;
    const res = await api.get(`/api/v1/live-quiz/join/${pin}`, {
      params: { nickname: nickname.trim() },
    });
    setQuizId(res.data.quiz_id);
    setParticipantId(res.data.participant_id);
    setPhase("lobby");
  }

  async function submitAnswer(answer: string) {
    if (!quizId || !participantId) return;
    const responseTimeMs = Date.now() - answerStart;
    const res = await api.post(`/api/v1/live-quiz/${quizId}/answer`, {
      participant_id: participantId,
      answer,
      response_time_ms: responseTimeMs,
    });
    setLastResult(res.data);
    setScore((s) => s + (res.data.points_earned ?? 0));
    setPhase("answered");
  }

  useEffect(() => {
    if (!quizId) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const es = new EventSource(`${apiBase}/api/v1/live-quiz/${quizId}/stream`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === "question_start") {
        setQuestion(data.question);
        setAnswerStart(Date.now());
        setLastResult(null);
        setPhase("question");
      } else if (data.event === "quiz_finished") {
        setPhase("finished");
        es.close();
      }
    };
    return () => es.close();
  }, [quizId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {phase === "join" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <h1 className="text-3xl font-bold">Rejoindre le quiz</h1>
          <p className="text-slate-400">PIN : {pin}</p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinQuiz()}
            placeholder="Ton prénom..."
            className="w-full max-w-xs px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-500 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={joinQuiz}
            disabled={!nickname.trim()}
            className="bg-indigo-500 text-white px-10 py-4 rounded-2xl text-xl font-bold hover:bg-indigo-400 disabled:opacity-40 transition-all"
          >
            Rejoindre →
          </button>
        </div>
      )}

      {phase === "lobby" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-2xl font-bold">En attente du professeur...</p>
          <p className="text-slate-400 mt-2">Le quiz va bientôt commencer</p>
          <p className="text-indigo-400 mt-4 text-lg font-semibold">Bonjour, {nickname} !</p>
        </div>
      )}

      {phase === "question" && question && (
        <div className="flex-1 flex flex-col p-4">
          <div className="bg-white/10 rounded-2xl p-6 mb-6 flex-1 flex items-center justify-center text-center">
            <p className="text-2xl font-bold">{question.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(question.options ?? {}).map(([key, val], i) => (
              <button
                key={key}
                onClick={() => submitAnswer(key)}
                className={`${OPTION_COLORS[i % 4]} text-white py-6 rounded-2xl text-lg font-bold transition-all active:scale-95`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "answered" && (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <div className="text-6xl mb-4">{lastResult?.is_correct ? "✅" : "❌"}</div>
            <p className="text-xl font-bold">
              {lastResult?.is_correct ? "Bonne réponse !" : "Mauvaise réponse"}
            </p>
            {lastResult?.is_correct && (
              <p className="text-indigo-300 mt-2">+{lastResult.points_earned} pts</p>
            )}
            <p className="text-slate-400 mt-4">En attente des autres élèves...</p>
            <p className="text-lg font-semibold mt-4">Score total : {score}</p>
          </div>
        </div>
      )}

      {phase === "finished" && (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <div className="text-6xl mb-4">🏁</div>
            <p className="text-3xl font-bold">Quiz terminé !</p>
            <p className="text-2xl text-indigo-300 mt-4">Score final : {score} pts</p>
          </div>
        </div>
      )}
    </div>
  );
}
