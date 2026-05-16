"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import toast from "react-hot-toast";
import api from "@/lib/api";

const PLANS = [
  {
    key: "free",
    name: "Gratuit",
    nameAr: "مجاني",
    priceMad: 0,
    priceEur: 0,
    period: "",
    features: [
      "2 groupes",
      "5 fichiers / groupe",
      "20 messages IA / jour",
      "5 examens / mois",
      "5 séries de flashcards",
    ],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    key: "etudiant",
    name: "Étudiant",
    nameAr: "طالب",
    priceMad: 49,
    priceEur: 4.99,
    period: "/ mois",
    features: [
      "10 groupes",
      "30 fichiers / groupe",
      "200 messages IA / jour",
      "50 examens / mois",
      "50 séries de flashcards",
      "Résolution photo",
      "Quiz en direct (5 / mois)",
      "Gamification & objectifs",
    ],
    cta: "Choisir Étudiant",
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    nameAr: "متميز",
    priceMad: 99,
    priceEur: 9.99,
    period: "/ mois",
    features: [
      "50 groupes",
      "100 fichiers / groupe",
      "1 000 messages IA / jour",
      "200 examens / mois",
      "500 séries de flashcards",
      "Quiz en direct (50 / mois)",
      "Toutes les fonctionnalités",
    ],
    cta: "Choisir Premium",
    highlight: false,
  },
  {
    key: "ecole",
    name: "École",
    nameAr: "مدرسة",
    priceMad: 29,
    priceEur: null,
    period: "/ siège / mois (min. 10)",
    features: [
      "Groupes & fichiers illimités",
      "Tableau de bord directeur",
      "Outils enseignants",
      "Analyses avancées",
      "Support prioritaire",
    ],
    cta: "Contacter les ventes",
    highlight: false,
  },
];

type PaymentMethod = "stripe" | "cmi" | "cashplus";

export default function PricingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");

  async function handleSelect(planKey: string) {
    if (planKey === "free") {
      router.push("/dashboard");
      return;
    }
    if (planKey === "ecole") {
      window.location.href = "mailto:sales@studyforge.app?subject=Plan École";
      return;
    }
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setLoadingPlan(planKey);
    try {
      const res = await api.post<{ url?: string; form_data?: Record<string, string | undefined>; payment_code?: string }>(
        "/me/subscribe",
        { plan: planKey, payment_method: paymentMethod }
      );
      const data = res.data;

      if (paymentMethod === "cashplus" && data.payment_code) {
        toast.success(`Code de paiement : ${data.payment_code}`, { duration: 10000 });
        return;
      }

      if (paymentMethod === "cmi" && data.form_data && data.url) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.url;
        Object.entries(data.form_data).forEach(([k, v]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = v ?? "";
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error("Erreur lors de la création de la session de paiement.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Tous les plans incluent le chat RAG et les flashcards. Passez à niveau à tout moment.
          </p>
        </div>

        {/* Payment method selector */}
        <div className="flex justify-center gap-3 mb-10">
          {(["stripe", "cmi", "cashplus"] as PaymentMethod[]).map((method) => (
            <button
              key={method}
              onClick={() => setPaymentMethod(method)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                paymentMethod === method
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400"
              }`}
            >
              {method === "stripe" ? "Carte internationale" : method === "cmi" ? "Carte marocaine (CMI)" : "CashPlus"}
            </button>
          ))}
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm ${
                plan.highlight
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-500"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Populaire
                </span>
              )}
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h2>
                <p className="text-sm text-gray-400">{plan.nameAr}</p>
              </div>

              <div className="mb-6">
                {plan.priceMad === 0 ? (
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">Gratuit</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {paymentMethod === "stripe" && plan.priceEur
                        ? `€${plan.priceEur}`
                        : `${plan.priceMad} MAD`}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">{plan.period}</span>
                  </>
                )}
              </div>

              <ul className="flex-1 space-y-2 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.key)}
                disabled={loadingPlan === plan.key}
                className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  plan.highlight
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {loadingPlan === plan.key ? "Chargement…" : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-400">
          Paiements sécurisés via Stripe, CMI ou CashPlus. Annulez à tout moment.
        </p>
      </div>
    </div>
  );
}
