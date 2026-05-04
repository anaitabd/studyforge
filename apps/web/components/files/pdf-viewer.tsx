"use client";

import { useRef } from "react";
import { Download, FileText } from "lucide-react";
import { useReadingTracker } from "@/lib/hooks/use-reading-tracker";

interface Props { fileId: string; groupId: string; fileName: string; downloadUrl?: string | null }

export function PDFViewer({ fileId, groupId, fileName, downloadUrl }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useReadingTracker({ fileId, groupId, sentinelRef });

  if (!downloadUrl) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
        <FileText className="mx-auto text-slate-300 mb-3" size={32} />
        <p className="font-sora font-semibold text-primary mb-1">{fileName}</p>
        <p className="text-sm text-slate-500 mb-4">Inline preview needs a backend `GET /files/{`{id}`}/download` endpoint to return a presigned URL.</p>
        <p className="text-xs text-slate-400">Reading-time tracking is wired and waiting for the analytics endpoint to come online.</p>
        <div ref={sentinelRef} className="h-1" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <p className="text-sm font-medium text-primary truncate">{fileName}</p>
        <a href={downloadUrl} download className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"><Download size={12} /> Download</a>
      </div>
      <iframe src={downloadUrl} className="w-full h-[70vh]" title={fileName} />
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}
