"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api";

interface BillingInfo {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

function useBilling(slug: string) {
  return useQuery<BillingInfo>({
    queryKey: ["org-billing", slug],
    queryFn: () => apiGet(`/api/v1/org/${slug}/billing`),
    enabled: !!slug,
  });
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  personal: "Personal",
  school: "School",
};

export default function OrgBillingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: billing, isLoading, isError } = useBilling(slug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">Billing</h1>
        <p className="text-slate-500 text-sm mt-1">Your organisation&apos;s subscription and payment details.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle size={16} />
          Could not load billing information.
        </div>
      ) : billing ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <CreditCard size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Current plan</p>
                  <p className="text-xs text-slate-400">
                    {billing.stripe_customer_id
                      ? `Stripe customer: ${billing.stripe_customer_id}`
                      : "No payment method on file"}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                {PLAN_LABELS[billing.plan] ?? billing.plan}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1">Status</p>
                <div className="flex items-center gap-1.5 font-medium text-primary">
                  {billing.status === "active" ? (
                    <CheckCircle2 size={14} className="text-teal-500" />
                  ) : (
                    <AlertCircle size={14} className="text-amber-500" />
                  )}
                  {billing.status}
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Renewal date</p>
                <p className="font-medium text-primary">
                  {billing.current_period_end
                    ? new Date(billing.current_period_end).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            {billing.cancel_at_period_end && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
                <AlertCircle size={14} />
                Subscription will cancel at the end of the current period.
              </div>
            )}
          </div>

          {billing.plan === "free" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-sora font-semibold text-primary mb-1">Upgrade your plan</h3>
              <p className="text-sm text-slate-500 mb-4">
                Unlock AI exam generation, flashcards, learning paths, and more.
              </p>
              <a
                href="mailto:contact@studyforge.app?subject=Upgrade%20plan"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition"
              >
                Contact us to upgrade
              </a>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
