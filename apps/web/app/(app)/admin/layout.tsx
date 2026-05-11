"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "@/hooks/use-account";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: account, isLoading } = useAccount();

  useEffect(() => {
    if (!isLoading && account?.role !== "super_admin") {
      router.replace("/dashboard");
    }
  }, [account, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="text-sm text-slate-400">Checking permissions…</span>
      </div>
    );
  }

  if (account?.role !== "super_admin") return null;

  return <>{children}</>;
}
