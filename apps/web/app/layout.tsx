import type { Metadata } from "next";
import { Sora, DM_Sans, Noto_Sans_Arabic } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthSync } from "@/components/providers/auth-sync";
import { UpgradeModal } from "@/components/providers/upgrade-modal";
import { ServiceWorkerRegistrar } from "@/components/providers/service-worker-registrar";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-sora" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-sans" });
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-arabic",
});

export const metadata: Metadata = {
  title: "StudyForge — Your courses. Your AI tutor. Your exam prep.",
  description: "AI-powered educational RAG platform with citation-backed answers, AI exams, and spaced-repetition flashcards.",
  manifest: "/manifest.json",
};

type AppLocale = "fr" | "ar";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("studyforge_locale")?.value ?? "fr";
  const locale: AppLocale = rawLocale === "ar" ? "ar" : "fr";
  const dir = locale === "ar" ? "rtl" : "ltr";

  const messages =
    locale === "ar"
      ? (await import("../messages/ar.json")).default
      : (await import("../messages/fr.json")).default;

  return (
    <ClerkProvider>
      <html
        lang={locale}
        dir={dir}
        suppressHydrationWarning
        className={`${sora.variable} ${dmSans.variable} ${notoSansArabic.variable}`}
      >
        <body className="font-sans" suppressHydrationWarning>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <QueryProvider>
              <AuthSync />
              <ServiceWorkerRegistrar />
              {children}
              <UpgradeModal />
              <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: "12px", fontSize: "14px" } }} />
            </QueryProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
