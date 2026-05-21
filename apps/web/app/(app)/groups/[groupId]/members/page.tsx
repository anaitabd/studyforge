"use client";

import { use, useState } from "react";
import { UserPlus, Crown, GraduationCap, User } from "lucide-react";
import { useGroup, useGroupMembers } from "@/lib/hooks/use-groups";
import { InviteMemberDialog } from "@/components/groups/invite-member-dialog";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  owner: { label: "Owner", icon: <Crown size={11} />, cls: "bg-amber/10 text-amber" },
  teacher: { label: "Teacher", icon: <GraduationCap size={11} />, cls: "bg-accent/10 text-accent" },
  student: { label: "Student", icon: <User size={11} />, cls: "bg-slate-100 text-slate-500" },
};

export default function MembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: group } = useGroup(groupId);
  const { data, isLoading } = useGroupMembers(groupId);
  const [invite, setInvite] = useState(false);

  const members = data?.members ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          {group?.member_count ?? members.length} member{(group?.member_count ?? members.length) !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={() => setInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
        >
          <UserPlus size={15} /> Invite member
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
            </div>
          ))
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">No members found.</div>
        ) : (
          members.map((m) => {
            const badge = ROLE_BADGE[m.role] ?? ROLE_BADGE.student;
            const initials = m.full_name
              ? m.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
              : m.email[0].toUpperCase();
            return (
              <div key={m.user_id} className="flex items-center gap-3 px-5 py-3.5">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.full_name} className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-accent">{initials}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.full_name || "—"}</p>
                  <p className="text-xs text-slate-400 truncate">{m.email}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium", badge.cls)}>
                  {badge.icon}
                  {badge.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      <InviteMemberDialog groupId={groupId} open={invite} onClose={() => setInvite(false)} />
    </div>
  );
}
