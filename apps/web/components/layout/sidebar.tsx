"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Home, FolderOpen, Users, BookOpen, BarChart2, GraduationCap, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/groups", label: "My Groups", icon: FolderOpen },
  { href: "/rooms", label: "Study Rooms", icon: Users },
  { href: "/flashcards", label: "Flashcards", icon: BookOpen },
];

const TEACHER_NAV = [
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/exams", label: "Exams", icon: GraduationCap },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string) ?? "student";
  const plan = (user?.publicMetadata?.plan as string) ?? "free";
  const isTeacher = role === "teacher" || role === "owner" || role === "school_admin";

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-slate-200 bg-white shrink-0 transition-all duration-200",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "justify-center px-2")}>
        <Sparkles className="text-accent shrink-0" size={20} />
        {!collapsed && <span className="font-sora font-bold text-base text-primary">StudyForge</span>}
        <button type="button" onClick={toggle} className={cn("ml-auto p-1.5 rounded-md hover:bg-slate-100 text-slate-500", collapsed && "ml-0")} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {MAIN_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                active ? "bg-accent/10 text-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                collapsed && "justify-center px-2"
              )}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent" />}
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {isTeacher && (
          <>
            <div className={cn("pt-4 pb-1", collapsed && "px-0")}>
              {!collapsed && <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider px-3">Teacher</p>}
            </div>
            {TEACHER_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                    active ? "bg-accent/10 text-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    collapsed && "justify-center px-2"
                  )}
                >
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent" />}
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className={cn("border-t border-slate-200 p-3 space-y-3", collapsed && "px-2")}>
        {!collapsed && (
          <>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                plan === "free" && "bg-slate-100 text-slate-600",
                plan === "personal" && "bg-accent/10 text-accent",
                plan === "school" && "bg-teal/10 text-teal",
              )}>
                {plan}
              </span>
              {plan === "free" && (
                <Link href="/pricing" className="text-[11px] text-accent hover:underline">Upgrade →</Link>
              )}
            </div>
          </>
        )}
        <UserButton showName={!collapsed} />
      </div>
    </aside>
  );
}
