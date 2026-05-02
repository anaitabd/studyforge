"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { useUploadFile } from "@/lib/hooks/use-files";
import { cn, formatBytes } from "@/lib/utils";
import toast from "react-hot-toast";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
};
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export function FileUploadZone({ groupId }: { groupId: string }) {
  const { mutate: upload, isPending } = useUploadFile(groupId);

  const onDrop = useCallback(
    (accepted: File[]) => {
      accepted.forEach((file) => {
        upload(file, {
          onSuccess: () => toast.success(`"${file.name}" uploaded`),
          onError: (err) => toast.error(`${file.name}: ${(err as Error).message}`),
        });
      });
    },
    [upload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    disabled: isPending,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-slate-300 hover:border-primary/50 hover:bg-slate-50",
          isPending && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud size={32} className={isDragActive ? "text-primary" : "text-slate-400"} />
        <p className="text-sm text-center text-slate-500">
          {isDragActive ? "Drop files here" : "Drag & drop files or click to browse"}
        </p>
        <p className="text-xs text-slate-400">PDF, DOCX, PPTX, TXT — up to {formatBytes(MAX_SIZE)}</p>
      </div>

      {fileRejections.length > 0 && (
        <ul className="mt-2 space-y-1">
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name} className="text-xs text-red-500">
              {file.name}: {errors.map((e) => e.message).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
