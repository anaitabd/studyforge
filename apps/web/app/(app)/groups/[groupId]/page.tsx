"use client";

import { use } from "react";
import { useGroupFiles } from "@/lib/hooks/useApi";
import { FileUploadZone } from "@/components/files/file-upload-zone";
import { FileList } from "@/components/files/file-list";

export default function GroupFilesPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: files, isLoading } = useGroupFiles(groupId);

  return (
    <div className="space-y-6">
      <FileUploadZone groupId={groupId} />
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <FileList files={files ?? []} groupId={groupId} />
      )}
    </div>
  );
}
