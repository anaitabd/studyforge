"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LayoutDashboard, Users, BookOpen, UserCircle, ChevronRight } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { useOrg } from "@/lib/hooks/use-org";

const NAV = [
  { label: "Overview", href: "dashboard", icon: LayoutDashboard },
  { label: "Cohorts", href: "cohorts", icon: BookOpen },
  { label: "Members", href: "members", icon: Users },
];

const RESERVED_ORG_SLUG_REDIRECTS: Record<string, string> = {
  super_admin: "/admin/health",
};

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const pathname = usePathname();
  const redirectTo = RESERVED_ORG_SLUG_REDIRECTS[slug];

  const { data: account, isLoading: accountLoading } = useAccount();
  const { data: org, isLoading: orgLoading } = useOrg(redirectTo ? "" : slug);

  useEffect(() => {
    if (redirectTo) {
      router.replace(redirectTo);
      return;
    }
    if (accountLoading || orgLoading) return;
    if (!account?.org_id) {
      router.replace("/dashboard");
    }
  }, [account, accountLoading, orgLoading, redirectTo, router]);

  if (redirectTo) return null;

  if (accountLoading || orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="text-sm text-slate-400">Loading…</span>
      </div>
    );
  }

  if (!account?.org_id) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight size={14} />
        <span className="font-medium text-primary">{org?.name ?? slug}</span>
      </div>

      {/* Sub-nav */}
      <nav className="flex gap-1 border-b border-slate-200 pb-0">
        {NAV.map(({ label, href, icon: Icon }) => {
          const full = `/org/${slug}/${href}`;
          const active = pathname.startsWith(full);
          return (
            <Link
              key={href}
              href={full}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-slate-500 hover:text-primary"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
