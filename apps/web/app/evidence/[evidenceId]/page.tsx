import EvidencePage from "../page";

export default async function EvidenceDetailPage({
  params
}: {
  params: Promise<{ evidenceId: string }>;
}) {
  const { evidenceId } = await params;
  return <EvidencePage searchParams={Promise.resolve({ evidenceId })} />;
}
