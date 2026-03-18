import AuditPacketsPage from "../page";

export default async function AuditPacketDetailPage({
  params
}: {
  params: Promise<{ packetId: string }>;
}) {
  const { packetId } = await params;
  return <AuditPacketsPage searchParams={Promise.resolve({ packetId })} />;
}
