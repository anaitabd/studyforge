"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, FileText, GraduationCap, BookOpen, Map, Users, Presentation, ArrowLeft, Sparkles, Network } from "lucide-react";
import { useGroup } from "@/lib/hooks/use-groups";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "chat", label: "Chat", icon: MessageSquare, teacherOnly: false },
  { key: "", label: "Files", icon: FileText, teacherOnly: false },
  { key: "learning-paths", label: "Learning paths", icon: Map, teacherOnly: false },
  { key: "slides", label: "Slides", icon: Presentation, teacherOnly: false },
  { key: "exams", label: "Exams", icon: GraduationCap, teacherOnly: false },
  { key: "flashcards", label: "Flashcards", icon: BookOpen, teacherOnly: false },
  { key: "concepts", label: "Concepts", icon: Network, teacherOnly: false },
  { key: "members", label: "Members", icon: Users, teacherOnly: false },
  { key: "generate", label: "Generate", icon: Sparkles, teacherOnly: true },
];

export default function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: group } = useGroup(groupId);
  const pathname = usePathname();

  return (
    <div>
      <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to groups
      </Link>

      <div className="flex items-center gap-3 mb-6">
        {group?.color && <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-sora font-bold" style={{ background: group.color }}>{group.name.charAt(0).toUpperCase()}</span>}
        <h1 className="font-sora text-2xl font-bold text-primary">{group?.name ?? "Loading..."}</h1>
      </div>

      <div className="border-b border-slate-200 mb-6 overflow-x-auto">
        <nav className="flex gap-1 -mb-px">
          {TABS.filter(({ teacherOnly }) =>
            !teacherOnly || ["owner", "teacher"].includes(group?.my_role ?? "")
          ).map(({ key, label, icon: Icon }) => {
            const href = `/groups/${groupId}${key ? "/" + key : ""}`;
            const active = key === "" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  active ? "border-accent text-accent" : "border-transparent text-slate-500 hover:text-primary"
                )}
              >
                <Icon size={15} /> {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
