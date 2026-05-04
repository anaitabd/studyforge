"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { GraduationCap, Users, Loader2, UploadCloud, Check, ArrowRight, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/api";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#2563EB", "#8B5CF6", "#EC4899", "#0D9488"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState(COLORS[4]);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  const createGroup = useMutation({
    mutationFn: async () => apiPost<{ id: string }>("/api/v1/groups", { name: groupName.trim(), color: groupColor }),
    onSuccess: (g) => { setCreatedGroupId(g.id); setStep(3); },
    onError: (e) => toast.error((e as Error).message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.post(`/api/v1/groups/${createdGroupId}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => toast.success("Uploading — we'll notify you when it's ready"),
    onError: (e) => toast.error((e as Error).message),
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"] },
    maxSize: 50 * 1024 * 1024,
    onDrop: (files) => files.forEach((f) => upload.mutate(f)),
    disabled: !createdGroupId,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="text-accent" size={22} />
        <span className="font-sora font-bold text-xl text-primary">StudyForge</span>
      </div>

      <div className="flex items-center gap-3 mb-10">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors", step >= n ? "bg-accent text-white" : "bg-slate-200 text-slate-500")}>
              {step > n ? <Check size={14} /> : n}
            </span>
            {n < 3 && <span className={cn("w-12 h-px transition-colors", step > n ? "bg-accent" : "bg-slate-200")} />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        {step === 1 && (
          <div className="text-center animate-in">
            <h1 className="font-sora text-3xl font-bold text-primary mb-2">What&apos;s your role?</h1>
            <p className="text-slate-500 mb-10">We&apos;ll customize StudyForge for how you work.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { key: "student" as const, icon: GraduationCap, label: "Student", desc: "I study and prepare for exams" },
                { key: "teacher" as const, icon: Users, label: "Teacher", desc: "I create courses and track my class" },
              ].map(({ key, icon: Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  className={cn("p-8 rounded-2xl border-2 text-left transition-all hover:border-accent hover:shadow-md", role === key ? "border-accent bg-accent/5" : "border-slate-200 bg-white")}
                >
                  <Icon className={cn("mb-4", role === key ? "text-accent" : "text-slate-400")} size={28} />
                  <p className="font-sora font-semibold text-lg text-primary mb-1">{label}</p>
                  <p className="text-sm text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!role}
              onClick={() => { if (role) { localStorage.setItem("sf_role", role); setStep(2); } }}
              className="mt-10 px-8 py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/90 inline-flex items-center gap-2"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in">
            <h1 className="font-sora text-3xl font-bold text-primary mb-2 text-center">Create your first Group</h1>
            <p className="text-slate-500 mb-8 text-center">A Group is a folder for one course. Your AI only answers from files you add here.</p>
            <div className="bg-white border border-slate-200 rounded-2xl p-8">
              <label className="block text-sm font-medium text-slate-700 mb-2">Group name</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value.slice(0, 60))}
                placeholder="e.g. Thermodynamics 101"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">{groupName.length}/60</p>

              <label className="block text-sm font-medium text-slate-700 mt-6 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setGroupColor(c)}
                    className={cn("w-9 h-9 rounded-full transition-all", groupColor === c && "ring-2 ring-offset-2 ring-slate-900")}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => router.push("/dashboard")} className="text-sm text-slate-500 hover:text-slate-700">Skip for now</button>
              <button
                type="button"
                disabled={!groupName.trim() || createGroup.isPending}
                onClick={() => createGroup.mutate()}
                className="px-8 py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-50 hover:bg-accent/90 inline-flex items-center gap-2"
              >
                {createGroup.isPending && <Loader2 size={14} className="animate-spin" />}
                Create group <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && createdGroupId && (
          <div className="animate-in">
            <h1 className="font-sora text-3xl font-bold text-primary mb-2 text-center">Upload your first file</h1>
            <p className="text-slate-500 mb-8 text-center">Add a PDF, DOCX, PPTX, or TXT to start chatting with your AI tutor.</p>
            <div
              {...getRootProps()}
              className={cn("rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors", isDragActive ? "border-accent bg-accent/5" : "border-slate-300 bg-white hover:border-accent/50")}
            >
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto text-slate-400 mb-4" size={36} />
              <p className="font-medium text-slate-900 mb-1">{isDragActive ? "Drop to upload" : "Drag & drop or click"}</p>
              <p className="text-xs text-slate-500">Up to 50 MB · PDF, DOCX, PPTX, TXT</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/groups/${createdGroupId}`)}
              className="mt-6 mx-auto block px-8 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90"
            >
              Go to my group →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
