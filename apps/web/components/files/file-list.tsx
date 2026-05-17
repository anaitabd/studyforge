"use client";

import { useState } from "react";
import { FileText, FileSpreadsheet, Presentation, FileType, Trash2, MoreVertical, Download } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete } from "@/lib/api";
import { useDownloadFile } from "@/lib/hooks/use-files";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { FileStatusBadge } from "./file-status-badge";
import { cn } from "@/lib/utils";
import type { GroupFile } from "@/lib/hooks/useApi";

function iconFor(mime: string) {
  if (mime.includes("pdf")) return { icon: FileType, color: "text-destructive" };
  if (mime.includes("word")) return { icon: FileText, color: "text-accent" };
  if (mime.includes("presentation")) return { icon: Presentation, color: "text-amber" };
  return { icon: FileSpreadsheet, color: "text-slate-400" };
}

function formatBytes(b: number) {
  if (!b) return "0 B";
  const k = 1024;
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${["B", "KB", "MB", "GB"][i]}`;
}

export function FileList({ files, groupId }: { files: GroupFile[]; groupId: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/groups/${groupId}/files/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["files", groupId] }); toast.success("File deleted"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const download = useDownloadFile(groupId);

  if (files.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No files yet. Upload one above.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
      {files.map((f) => (
        <FileRow
          key={f.id}
          file={f}
          onDelete={() => { if (confirm(`Delete "${f.name}"?`)) del.mutate(f.id); }}
          onDownload={() => download.mutate(f.id, { onSuccess: (d) => window.open(d.url, "_blank") })}
        />
      ))}
    </ul>
  );
}

function FileRow({ file, onDelete, onDownload }: { file: GroupFile; onDelete: () => void; onDownload: () => void }) {
  const { icon: Icon, color } = iconFor(file.mime_type);
  const [menu, setMenu] = useState(false);
  return (
    <li className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
      <Icon size={20} className={cn("shrink-0", color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate" title={file.name}>{file.name}</p>
        <p className="text-[11px] text-slate-400">
          {formatBytes(file.size)}
          {file.chunk_count ? ` · ${file.chunk_count} chunks` : ""}
          {file.created_at && ` · ${formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}`}
        </p>
        {file.error_message && <p className="text-[11px] text-destructive mt-0.5">{file.error_message}</p>}
      </div>
      <FileStatusBadge status={file.status} />
      <div className="relative">
        <button type="button" onClick={() => setMenu((v) => !v)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-slate-200" aria-label="Actions">
          <MoreVertical size={14} />
        </button>
        {menu && (
          <div className="absolute right-0 top-8 z-10 rounded-lg border border-slate-200 bg-white shadow-md py-1 min-w-[140px]">
            <button
              type="button"
              onClick={() => { setMenu(false); onDownload(); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Download size={13} /> Download
            </button>
            <button
              type="button"
              onClick={() => { setMenu(false); onDelete(); }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
