"use client";

import { use } from "react";
import { ArrowLeft, MessageSquare, GraduationCap, BookOpen, Users, BarChart2 } from "lucide-react";
import Link from "next/link";
import { useFiles } from "@/lib/hooks/use-files";
import { FileUploadZone } from "@/components/files/file-upload-zone";
import { FileList } from "@/components/files/file-list";

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: files, isLoading } = useFiles(groupId);

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to groups
      </Link>

      {/* Quick-action buttons */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Link
          href={`/groups/${groupId}/chat`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <MessageSquare size={15} />
          Chat with files
        </Link>
        <Link
          href={`/groups/${groupId}/exams`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <GraduationCap size={15} />
          Exams
        </Link>
        <Link
          href={`/groups/${groupId}/flashcards`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <BookOpen size={15} />
          Flashcards
        </Link>
        <Link
          href={`/groups/${groupId}/rooms`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <Users size={15} />
          Rooms
        </Link>
        <Link
          href={`/groups/${groupId}/teacher`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <BarChart2 size={15} />
          Analytics
        </Link>
      </div>

      {/* File manager */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Files</h2>
        <FileUploadZone groupId={groupId} />
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3 mt-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <FileList files={files ?? []} groupId={groupId} />
          )}
        </div>
      </section>
    </div>
  );
}
