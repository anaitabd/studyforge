"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Users, BookOpen, GraduationCap, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/groups", label: "Groups", icon: FolderOpen },
  { href: "/rooms", label: "Rooms", icon: Users },
  { href: "/flashcards", label: "Cards", icon: BookOpen },
  { href: "/exams", label: "Exams", icon: GraduationCap },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 transition-all",
                  active ? "text-accent scale-105" : "text-slate-500"
                )}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
