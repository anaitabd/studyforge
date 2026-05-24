"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/hooks/use-locale";
import { NotificationBell } from "./notification-bell";

function useLocalizedCrumbs() {
  const pathname = usePathname();
  const t = useTranslations("breadcrumbs");

  const parts = pathname.split("/").filter(Boolean);
  return parts.map((p, i) => {
    let label: string;
    try {
      label = t(p);
    } catch {
      // Unknown segment (e.g. UUID) — capitalize as fallback
      label = p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, " ");
    }
    return {
      label,
      href: "/" + parts.slice(0, i + 1).join("/"),
    };
  });
}

export function TopBar() {
  const crumbs = useLocalizedCrumbs().slice(0, 3);
  const { isRTL } = useLocale();
  const Separator = isRTL ? ChevronLeft : ChevronRight;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-4 px-6 py-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <Separator size={12} className="shrink-0" />}
              <Link
                href={c.href}
                className={i === crumbs.length - 1 ? "text-primary font-medium truncate" : "hover:text-primary truncate"}
              >
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="ltr:ml-auto rtl:mr-auto flex items-center gap-3">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
