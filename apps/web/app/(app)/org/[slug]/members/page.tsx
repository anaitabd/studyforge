"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { UserPlus, Shield, Trash2, UserCircle } from "lucide-react";
import { useOrgMembers, useInviteMember, useUpdateMemberRole, useRemoveMember } from "@/lib/hooks/use-org";

const ROLES = ["admin", "teacher", "student", "viewer"] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-purple-100 text-purple-700",
  teacher: "bg-blue-100 text-blue-700",
  student: "bg-green-100 text-green-700",
  viewer: "bg-slate-100 text-slate-600",
};

export default function MembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: members, isLoading } = useOrgMembers(slug);
  const invite = useInviteMember(slug);
  const updateRole = useUpdateMemberRole(slug);
  const remove = useRemoveMember(slug);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("student");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    await invite.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
    setInviteEmail("");
    setShowInvite(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">Members</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isLoading ? "…" : `${members?.length ?? 0} member${members?.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition"
        >
          <UserPlus size={16} /> Invite
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-sora font-semibold text-primary">Invite member</h3>
          <input
            type="email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">{r}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={invite.isPending}
              className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent/90 transition disabled:opacity-50"
            >
              {invite.isPending ? "Inviting…" : "Send invite"}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="text-sm text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-100 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (members ?? []).length === 0 ? (
        <p className="text-sm text-slate-400">No members yet.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {(members ?? []).map((m) => (
            <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                    <UserCircle size={20} className="text-accent" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-primary">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ userId: m.user_id, role: e.target.value })}
                  disabled={updateRole.isPending}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none ${ROLE_COLORS[m.role as Role] ?? ROLE_COLORS.viewer}`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="capitalize bg-white text-slate-700">{r}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${m.name} from this organisation?`)) {
                      remove.mutate(m.user_id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-destructive hover:bg-red-50 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
