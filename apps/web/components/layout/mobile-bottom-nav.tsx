"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Users, BookOpen, GraduationCap, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("mobile_nav");

  const TABS = [
    { href: "/groups", label: t("groups"), icon: FolderOpen },
    { href: "/rooms", label: t("rooms"), icon: Users },
    { href: "/flashcards", label: t("flashcards"), icon: BookOpen },
    { href: "/exams", label: t("exams"), icon: GraduationCap },
    { href: "/profile", label: t("profile"), icon: User },
  ];

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
