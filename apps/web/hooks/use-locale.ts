"use client";

import { useLocale as useNextIntlLocale } from "next-intl";
import { useRouter } from "next/navigation";

export type AppLocale = "fr" | "ar";

export function useLocale() {
  const locale = useNextIntlLocale() as AppLocale;
  const router = useRouter();

  const setLocale = async (newLocale: AppLocale) => {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: newLocale }),
    });
    router.refresh();
  };

  return { locale, setLocale, isRTL: locale === "ar" };
}
