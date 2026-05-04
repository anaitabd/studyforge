"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { FolderOpen, FileText, GraduationCap, BookOpen, Plus, Clock, type LucideIcon } from "lucide-react";
import { useGroups } from "@/lib/hooks/useApi";
import { GroupCard } from "@/components/groups/group-card";

export default function DashboardPage() {
  const { user } = useUser();
  const { data: groups, isLoading } = useGroups();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const totalFiles = groups?.reduce((s, g) => s + g.file_count, 0) ?? 0;
  const recent = (groups ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora text-3xl font-bold text-primary">
          {greeting}, {user?.firstName ?? "there"} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Pick up where you left off, or start something new.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FolderOpen} label="Groups" value={groups?.length ?? 0} color="text-accent" />
        <StatCard icon={FileText} label="Files indexed" value={totalFiles} color="text-teal" />
        <StatCard icon={GraduationCap} label="Exams taken" value={0} color="text-amber" />
        <StatCard icon={BookOpen} label="Cards due" value={0} color="text-destructive" />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sora text-xl font-semibold text-primary">Recent groups</h2>
          <Link href="/groups" className="text-sm text-accent hover:underline font-medium">View all →</Link>
        </div>
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
            <p className="text-slate-500 text-sm mb-4">No groups yet — create one to get started.</p>
            <Link href="/groups" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
              <Plus size={15} /> Create your first group
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((g) => <GroupCard key={g.id} group={g} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-sora text-xl font-semibold text-primary mb-4 flex items-center gap-2">
          <Clock size={18} className="text-amber" /> Upcoming
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No exams due in the next 48 hours. You&apos;re all caught up. 🎉
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="font-sora text-3xl font-bold text-primary">{value}</p>
    </div>
  );
}
