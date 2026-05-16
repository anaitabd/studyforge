"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  AlertTriangle,
  Library,
  Settings,
  ClipboardList,
  Radio,
  ClipboardCheck,
  Trophy,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrg, useOrgMembers } from "@/lib/hooks/use-org";

type OrgRole = "admin" | "teacher" | "student" | "viewer";

function navForRole(slug: string, role: OrgRole) {
  if (role === "admin") {
    return [
      { label: "Dashboard", href: `/org/${slug}`, icon: LayoutDashboard },
      { label: "Cohorts", href: `/org/${slug}/cohorts`, icon: Users },
      { label: "Members", href: `/org/${slug}/members`, icon: UserCircle },
      { label: "At-risk", href: `/org/${slug}/at-risk`, icon: AlertTriangle },
      { label: "Content library", href: `/org/${slug}/library`, icon: Library },
      { label: "Settings", href: `/org/${slug}/settings`, icon: Settings },
    ];
  }
  if (role === "teacher") {
    return [
      { label: "My classes", href: `/org/${slug}/teacher`, icon: Users },
      { label: "Assignments", href: `/org/${slug}/teacher/assignments`, icon: ClipboardList },
      { label: "Live", href: `/org/${slug}/teacher/live`, icon: Radio },
    ];
  }
  return [
    { label: "My tasks", href: `/org/${slug}/student/tasks`, icon: ClipboardCheck },
    { label: "Leaderboard", href: `/org/${slug}/student/leaderboard`, icon: Trophy },
    { label: "Study", href: "/groups", icon: BookOpen },
  ];
}

export function OrgSidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { data: org } = useOrg(slug);
  const { data: members, isLoading } = useOrgMembers(slug);

  const myMembership = members?.find((m) => m.user_id === user?.id);
  const myRole: OrgRole = (myMembership?.role as OrgRole) ?? "student";

  useEffect(() => {
    if (!isLoading && members && !myMembership) {
      router.push("/dashboard");
    }
  }, [isLoading, members, myMembership, router]);

  const nav = navForRole(slug, myRole);

  return (
    <aside className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-slate-200 bg-white">
      {/* Org header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-sora font-bold text-sm text-primary truncate">
            {org?.name ?? slug}
          </p>
          <p className="text-[10px] text-slate-400 capitalize">{myRole}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const exact = href === `/org/${slug}`;
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent" />
              )}
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to app */}
      <div className="border-t border-slate-200 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors px-1"
        >
          ← Back to StudyForge
        </Link>
      </div>
    </aside>
  );
}
