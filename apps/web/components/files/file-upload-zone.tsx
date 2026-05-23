"use client";

import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { UPLOAD_TIMEOUT_MS } from "@/lib/api";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useAccount } from "@/hooks/use-account";

// ── Allowed types (mirrors server ALLOWED_MIME_TYPES) ────────────────────────
const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const ALLOWED_EXTENSIONS = "PDF, DOCX, PPTX, TXT, JPEG, PNG, WebP";

// ── Per-plan upload limits (mirrors server plans.py) ─────────────────────────
const PLAN_MAX_BYTES: Record<string, number> = {
  free: 10 * 1024 * 1024,
  etudiant: 50 * 1024 * 1024,
  premium: 50 * 1024 * 1024,
  personal: 50 * 1024 * 1024,
  ecole: 200 * 1024 * 1024,
  school: 200 * 1024 * 1024,
};

function planMaxBytes(plan: string | undefined): number {
  return PLAN_MAX_BYTES[plan ?? "free"] ?? 10 * 1024 * 1024;
}

function formatMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// ── Client-side pre-validation ────────────────────────────────────────────────
function validateFile(file: File, maxBytes: number): string | null {
  if (!Object.keys(ACCEPTED).includes(file.type)) {
    return `${file.name}: unsupported type "${file.type}". Allowed: ${ALLOWED_EXTENSIONS}.`;
  }
  if (file.size > maxBytes) {
    return `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds your plan limit of ${formatMB(maxBytes)}.`;
  }
  if (file.size === 0) {
    return `${file.name}: file is empty.`;
  }
  return null;
}

export function FileUploadZone({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const maxBytes = planMaxBytes(account?.plan);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post(`/api/v1/groups/${groupId}/files`, fd, { timeout: UPLOAD_TIMEOUT_MS });
    },
    onSuccess: (_, f) => {
      qc.invalidateQueries({ queryKey: ["files", groupId] });
      toast.success(`${f.name} uploaded — processing started`);
    },
    onError: (err: unknown, f) => {
      // Surface server 413 / 415 messages directly
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? `${f.name}: upload failed`);
    },
  });

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: ACCEPTED,
    maxSize: maxBytes,
    onDrop: (accepted, rejected) => {
      // Emit instant toasts for dropzone-rejected files (type / size)
      rejected.forEach(({ file, errors }) => {
        const msg = errors.map((e) => e.message).join(", ");
        toast.error(`${file.name}: ${msg}`);
      });

      // Run our own pre-validation before sending (catches edge cases dropzone misses)
      accepted.forEach((f) => {
        const err = validateFile(f, maxBytes);
        if (err) {
          toast.error(err);
          return;
        }
        upload.mutate(f);
      });
    },
    disabled: upload.isPending,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all",
          isDragActive ? "border-accent bg-accent/5" : "border-slate-300 hover:border-accent/50 hover:bg-slate-50",
          upload.isPending && "opacity-50 cursor-wait",
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud size={32} className={isDragActive ? "text-accent" : "text-slate-400"} />
        <p className="text-sm font-medium text-slate-700">
          {isDragActive ? "Release to upload" : "Drop files here or click to browse"}
        </p>
        <p className="text-xs text-slate-400">
          {ALLOWED_EXTENSIONS} — up to {formatMB(maxBytes)}
          {account?.plan === "free" && (
            <span className="ml-1 text-amber-500">(upgrade for larger files)</span>
          )}
        </p>
      </div>

      {fileRejections.length > 0 && (
        <ul className="mt-2 space-y-1">
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name} className="text-xs text-destructive">
              {file.name}: {errors.map((e) => e.message).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
