"use client";

import { use, useState } from "react";
import { Mail, UserPlus, Crown, GraduationCap } from "lucide-react";
import { useGroup } from "@/lib/hooks/useApi";
import { InviteMemberDialog } from "@/components/groups/invite-member-dialog";

export default function MembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const { data: group } = useGroup(groupId);
  const [invite, setInvite] = useState(false);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{group?.member_count ?? 0} member{(group?.member_count ?? 0) !== 1 ? "s" : ""}</p>
        <button
          type="button"
          onClick={() => setInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
        >
          <UserPlus size={15} /> Invite member
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Mail className="mx-auto text-slate-300 mb-3" size={28} />
        <p className="text-sm text-slate-500 mb-1">Member roster API coming soon</p>
        <p className="text-xs text-slate-400">For now, share the invite link to add students or co-teachers.</p>
        <div className="mt-5 inline-flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Crown size={12} className="text-amber" /> Owner</span>
          <span className="flex items-center gap-1"><GraduationCap size={12} className="text-accent" /> Teacher</span>
          <span>Student</span>
        </div>
      </div>

      <InviteMemberDialog groupId={groupId} open={invite} onClose={() => setInvite(false)} />
    </div>
  );
}
