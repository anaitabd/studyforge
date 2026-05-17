import { OrgSidebar } from "@/components/org/org-sidebar";
import { redirect } from "next/navigation";

const RESERVED_ORG_SLUG_REDIRECTS: Record<string, string> = {
  super_admin: "/admin/health",
};

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const redirectTo = RESERVED_ORG_SLUG_REDIRECTS[slug];

  if (redirectTo) {
    redirect(redirectTo);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <OrgSidebar slug={slug} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
