"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NotificationBell } from "./notification-bell";

function buildCrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((p, i) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " "),
    href: "/" + parts.slice(0, i + 1).join("/"),
  }));
}

export function TopBar() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname).slice(0, 3);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-4 px-6 py-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight size={12} className="shrink-0" />}
              <Link href={c.href} className={i === crumbs.length - 1 ? "text-primary font-medium truncate" : "hover:text-primary truncate"}>
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
