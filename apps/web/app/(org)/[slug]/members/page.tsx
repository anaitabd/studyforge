"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { useOrgMembers, useUpdateMemberRole, useRemoveMember, useInviteMember } from "@/lib/hooks/use-org";
import { useBulkInvite } from "@/lib/hooks/use-org-admin";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  viewer: "Viewer",
};

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export default function MembersPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: members, isLoading } = useOrgMembers(slug);
  const updateRole = useUpdateMemberRole(slug);
  const removeMember = useRemoveMember(slug);
  const inviteSingle = useInviteMember(slug);
  const bulkInvite = useBulkInvite(slug);

  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [singleEmail, setSingleEmail] = useState("");
  const [singleRole, setSingleRole] = useState("student");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  const parsedEmails = parseEmails(bulkText);

  function handleBulkSubmit() {
    if (!parsedEmails.length) return;
    bulkInvite.mutate(parsedEmails, {
      onSuccess: () => {
        setBulkText("");
        setShowInviteModal(false);
      },
    });
  }

  function handleSingleInvite() {
    if (!singleEmail) return;
    inviteSingle.mutate(
      { email: singleEmail, role: singleRole },
      {
        onSuccess: () => {
          setSingleEmail("");
          setSingleRole("student");
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl font-bold text-primary">Members</h1>
          <p className="text-slate-500 text-sm mt-1">
            {members?.length ?? 0} member{members?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
        >
          Invite members
        </button>
      </div>

      {/* Search + single invite */}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
        />
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Email"
            value={singleEmail}
            onChange={(e) => setSingleEmail(e.target.value)}
            className="w-52 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 outline-none"
          />
          <select
            value={singleRole}
            onChange={(e) => setSingleRole(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm bg-white"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleSingleInvite}
            disabled={!singleEmail || inviteSingle.isPending}
            className="bg-slate-800 text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Invite
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-50" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">
              {search ? "No members match your search." : "No members yet."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Joined
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((member) => (
                <tr key={member.user_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-medium text-indigo-700">
                          {member.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-700">{member.name}</p>
                        <p className="text-xs text-slate-400">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateRole.mutate({ userId: member.user_id, role: e.target.value })
                      }
                      className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white focus:ring-1 focus:ring-accent/30"
                    >
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString("fr-MA")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmRemove === member.user_id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            removeMember.mutate(member.user_id);
                            setConfirmRemove(null);
                          }}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(member.user_id)}
                        className="text-red-500 text-xs hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-sora font-bold text-lg text-primary">Bulk invite</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Paste emails, one per line or comma-separated"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[120px] focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none resize-none"
            />
            {bulkText && (
              <p className="text-xs text-slate-500">
                {parsedEmails.length} valid email{parsedEmails.length !== 1 ? "s" : ""} found
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-sm text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSubmit}
                disabled={parsedEmails.length === 0 || bulkInvite.isPending}
                className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {bulkInvite.isPending ? "Inviting…" : `Invite ${parsedEmails.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
