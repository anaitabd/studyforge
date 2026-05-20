"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { MailCheck } from "lucide-react";

export default function VerifyPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <MailCheck size={28} className="text-accent" />
        </div>
        <h1 className="font-sora text-2xl font-bold text-primary mb-2">Check your email</h1>
        <p className="text-sm text-slate-500 mb-8">
          We sent a verification link to your email address. Click the link to activate your account.
        </p>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-400">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <a href="/sign-up" className="text-accent font-medium hover:underline">
            try signing up again
          </a>
          .
        </div>
      </div>
    </main>
  );
}
