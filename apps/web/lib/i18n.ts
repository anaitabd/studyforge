export const UI_STRINGS = {
  fr: {
    dashboard: "Tableau de bord",
    groups: "Mes groupes",
    exams: "Examens",
    flashcards: "Cartes mémoire",
    chat: "Chat IA",
    goals: "Objectifs",
    streak: "Série",
    daily_challenge: "Défi du jour",
  },
  ar: {
    dashboard: "لوحة القيادة",
    groups: "مجموعاتي",
    exams: "الاختبارات",
    flashcards: "البطاقات التعليمية",
    chat: "الدردشة الذكية",
    goals: "الأهداف",
    streak: "التسلسل",
    daily_challenge: "تحدي اليوم",
  },
  en: {
    dashboard: "Dashboard",
    groups: "My groups",
    exams: "Exams",
    flashcards: "Flashcards",
    chat: "AI chat",
    goals: "Goals",
    streak: "Streak",
    daily_challenge: "Daily challenge",
  },
} as const;

export type UILanguage = "fr" | "ar" | "en";
export type UIStringKey = keyof typeof UI_STRINGS.fr;

export function t(lang: UILanguage, key: UIStringKey): string {
  return UI_STRINGS[lang]?.[key] ?? UI_STRINGS.fr[key];
}
