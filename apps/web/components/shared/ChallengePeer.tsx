"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface ChallengePeerProps {
  examTitle: string;
  groupId: string;
  examId: string;
  score?: number;
  maxScore?: number;
  className?: string;
}

export function ChallengePeer({
  examTitle,
  groupId,
  examId,
  score,
  maxScore,
  className = "",
}: ChallengePeerProps) {
  const [copied, setCopied] = useState(false);

  const challengeUrl = `${window.location.origin}/groups/${groupId}/exams/${examId}`;
  const scoreText = score !== undefined && maxScore !== undefined
    ? ` J'ai obtenu ${score}/${maxScore}. Peux-tu faire mieux ?`
    : "";
  const message = `Je te défie sur l'examen "${examTitle}" sur StudyForge !${scoreText} ${challengeUrl}`;

  async function handleChallenge() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Lien de défi copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }

  return (
    <button
      onClick={handleChallenge}
      className={`inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
      {copied ? "Copié !" : "Défier un ami"}
    </button>
  );
}
