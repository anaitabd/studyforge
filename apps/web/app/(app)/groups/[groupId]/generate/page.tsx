import { GeneratePageClient } from "./_components/GeneratePageClient";

export const metadata = { title: "Generate content — StudyForge" };

export default function GeneratePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  return <GeneratePageClient params={params} />;
}
