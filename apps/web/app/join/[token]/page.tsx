"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api";
import toast from "react-hot-toast";

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const [status, setStatus] = useState<"idle" | "joining" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!params.token) {
      setStatus("error");
      setMessage("Missing invite token.");
      return;
    }

    if (!userId) {
      setStatus("idle");
      return;
    }

    setStatus("joining");
    apiPost<{ group_id: string }>("/api/v1/groups/join", { invite_token: params.token })
      .then((response) => {
        setStatus("success");
        router.push(`/groups/${response.group_id}`);
      })
      .catch((error) => {
        const errorMessage = (error as Error).message || "Could not join the group. Please try again.";
        setStatus("error");
        setMessage(errorMessage);
        toast.error(errorMessage);
      });
  }, [isLoaded, userId, params.token, router]);

  const handleSignIn = () => {
    router.push("/sign-in");
  };

  const getHeadline = () => {
    if (!isLoaded || status === "joining") return "Joining your group…";
    if (userId && status === "success") return "Join successful! Redirecting…";
    if (userId && status === "error") return "Unable to join this group";
    return "Join your StudyForge group";
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">{getHeadline()}</h1>
          <p className="mt-3 text-sm text-slate-500">
            {userId
              ? status === "joining"
                ? "We are accepting your invite and connecting you to the group."
                : message ?? "Your invite token is valid."
              : "Please sign in to accept this group invitation."}
          </p>
        </div>

        <div className="space-y-4">
          {status === "joining" && (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-slate-700">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Joining group...</span>
            </div>
          )}

          {!isLoaded && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-slate-700">Loading auth state…</div>
          )}

          {isLoaded && !userId && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-slate-700">
              <p className="text-sm text-slate-600 mb-4">You need to sign in before you can join the group.</p>
              <button
                type="button"
                onClick={handleSignIn}
                className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                Sign in to continue
              </button>
            </div>
          )}

          {status === "error" && message && userId && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-red-700">
              <p>{message}</p>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-5 text-green-700">
              <p>Group joined successfully. Redirecting now…</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
