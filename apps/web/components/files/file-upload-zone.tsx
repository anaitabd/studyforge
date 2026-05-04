"use client";

import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
};
const MAX = 50 * 1024 * 1024;

export function FileUploadZone({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post(`/api/v1/groups/${groupId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (_, f) => {
      qc.invalidateQueries({ queryKey: ["files", groupId] });
      toast.success(`${f.name} uploaded — processing started`);
    },
    onError: (e, f) => toast.error(`${f.name}: ${(e as Error).message}`),
  });

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: ACCEPTED,
    maxSize: MAX,
    onDrop: (files) => files.forEach((f) => upload.mutate(f)),
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
        <p className="text-xs text-slate-400">PDF, DOCX, PPTX, TXT — up to 50 MB</p>
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
