import type { Metadata } from "next";
import { Sora, DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthSync } from "@/components/providers/auth-sync";
import { UpgradeModal } from "@/components/providers/upgrade-modal";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-sora" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "StudyForge — Your courses. Your AI tutor. Your exam prep.",
  description: "AI-powered educational RAG platform with citation-backed answers, AI exams, and spaced-repetition flashcards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={`${sora.variable} ${dmSans.variable}`}>
        <body className="font-sans" suppressHydrationWarning>
          <QueryProvider>
            <AuthSync />
            {children}
            <UpgradeModal />
            <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: "12px", fontSize: "14px" } }} />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
