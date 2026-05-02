"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { setAuthToken } from "@/lib/api";

/** Keeps the Axios instance JWT in sync with Clerk's live token. */
export function AuthSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      const token = await getToken();
      if (!cancelled) setAuthToken(token);
    }

    sync();
    // Re-sync every 55 s (Clerk tokens expire after 60 s)
    const id = setInterval(sync, 55_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getToken]);

  return null;
}
