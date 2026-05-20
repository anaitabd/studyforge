"use client";

import { CheckCircle2 } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0 / month",
    color: "text-slate-500",
    badge: "bg-slate-100 text-slate-600",
    features: [
      "1 study group",
      "5 file uploads",
      "Basic RAG chat",
      "Community support",
    ],
  },
  {
    id: "personal",
    name: "Personal",
    price: "$9 / month",
    color: "text-accent",
    badge: "bg-accent/10 text-accent",
    features: [
      "5 study groups",
      "Unlimited file uploads",
      "AI exam & flashcard generation",
      "Learning paths",
      "Priority support",
    ],
  },
  {
    id: "school",
    name: "School",
    price: "Contact us",
    color: "text-teal-600",
    badge: "bg-teal-50 text-teal-700",
    features: [
      "Unlimited groups & files",
      "Teacher analytics dashboard",
      "Cohort & student management",
      "At-risk student alerts",
      "SSO / Clerk organisation",
      "Dedicated support",
    ],
  },
] as const;

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-sora text-2xl font-bold text-primary">Plans</h1>
        <p className="text-slate-500 text-sm mt-1">
          Overview of available subscription tiers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className={`font-sora text-lg font-bold ${plan.color}`}>{plan.name}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${plan.badge}`}>
                {plan.id}
              </span>
            </div>
            <p className="text-2xl font-bold text-primary font-sora">{plan.price}</p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={14} className={plan.color} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
