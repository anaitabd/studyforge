"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export function PomodoroTimer() {
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            setRunning(false);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("StudyForge", { body: "Time's up — take a break! ⏰" });
            }
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  const pct = (1 - remaining / duration) * 100;
  const circ = 2 * Math.PI * 60;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <div className="relative inline-block">
        <svg width="160" height="160" className="-rotate-90">
          <circle cx="80" cy="80" r="60" stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
          <circle cx="80" cy="80" r="60" stroke="hsl(var(--accent))" strokeWidth="6" fill="none" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-sora font-bold text-3xl text-primary">{mins}:{secs}</div>
      </div>
      <div className="flex items-center gap-2 justify-center mt-4">
        {[15, 25, 45].map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => { setRunning(false); setDuration(m * 60); setRemaining(m * 60); }}
            className="px-3 py-1 rounded-full text-xs font-medium border border-slate-200 hover:bg-slate-50"
          >
            {m}m
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 inline-flex items-center gap-1.5"
        >
          {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Start</>}
        </button>
        <button
          type="button"
          onClick={() => { setRunning(false); setRemaining(duration); }}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          aria-label="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 mt-3 italic">Sync coming soon — for now this is local-only</p>
    </div>
  );
}
