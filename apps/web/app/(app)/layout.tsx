import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { LocaleSync } from "@/components/providers/locale-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <LocaleSync />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
