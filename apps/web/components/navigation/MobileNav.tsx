"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, FileText, Home, MessageCircle, Target, Users } from "lucide-react";

interface MobileNavProps {
  groupId?: string;
}

export function MobileNav({ groupId }: MobileNavProps) {
  const pathname = usePathname();

  const tabs = groupId
    ? [
        { href: `/groups/${groupId}`, icon: MessageCircle, label: "Chat" },
        { href: `/groups/${groupId}/exams`, icon: FileText, label: "Examens" },
        { href: `/groups/${groupId}/flashcards`, icon: Brain, label: "Cartes" },
        { href: `/groups/${groupId}/members`, icon: Users, label: "Groupe" },
      ]
    : [
        { href: "/dashboard", icon: Home, label: "Accueil" },
        { href: "/groups", icon: BookOpen, label: "Groupes" },
        { href: "/goals", icon: Target, label: "Objectifs" },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe sm:hidden z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                active ? "text-indigo-600" : "text-slate-500"
              }`}
            >
              <tab.icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
