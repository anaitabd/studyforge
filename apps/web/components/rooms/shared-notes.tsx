"use client";

import { useEffect, useState } from "react";
import { Eye, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SharedNotes({ roomId }: { roomId: string }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => { setText(localStorage.getItem(`room_notes_${roomId}`) ?? ""); }, [roomId]);
  useEffect(() => { localStorage.setItem(`room_notes_${roomId}`, text); }, [roomId, text]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <p className="text-sm font-medium text-primary">Shared notes</p>
        <div className="flex gap-1">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("px-2.5 py-1 rounded-md text-xs font-medium inline-flex items-center gap-1", mode === m ? "bg-accent/10 text-accent" : "text-slate-500 hover:bg-slate-100")}
            >
              {m === "edit" ? <Edit3 size={11} /> : <Eye size={11} />}
              {m}
            </button>
          ))}
        </div>
      </div>
      {mode === "edit" ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="# Notes&#10;Markdown supported. Saved locally for now."
          className="w-full h-48 p-4 text-sm font-mono outline-none resize-none rounded-b-xl"
        />
      ) : (
        <pre className="h-48 p-4 text-sm whitespace-pre-wrap overflow-auto">{text || "Nothing yet. Switch to Edit and start writing."}</pre>
      )}
      <p className="px-4 py-2 text-[10px] text-slate-400 italic border-t border-slate-100">Notes save locally — shared persistence coming soon</p>
    </div>
  );
}
