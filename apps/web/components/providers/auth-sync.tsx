"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { registerTokenGetter, registerUnauthorizedHandler, registerUpgradeHandler } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export function AuthSync() {
  const { getToken } = useAuth();
  const router = useRouter();
  const openUpgradeModal = useAppStore((s) => s.openUpgradeModal);

  useEffect(() => {
    registerTokenGetter(() => getToken());
    registerUnauthorizedHandler(() => {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/sign-")) {
        router.push("/sign-in");
      }
    });
    registerUpgradeHandler((reason) => openUpgradeModal(reason));
  }, [getToken, router, openUpgradeModal]);

  return null;
}
