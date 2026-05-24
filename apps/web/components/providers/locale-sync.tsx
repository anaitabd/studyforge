"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale as useNextIntlLocale } from "next-intl";
import { useAccount } from "@/hooks/use-account";

/** Syncs the user's profile language preference to the locale cookie once after login. */
export function LocaleSync() {
  const router = useRouter();
  const currentLocale = useNextIntlLocale();
  const { data: account } = useAccount();

  useEffect(() => {
    if (!account?.language) return;
    if (account.language === currentLocale) return;

    fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: account.language }),
    }).then(() => router.refresh());
  }, [account?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
