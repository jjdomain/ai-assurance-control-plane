import FindingsPage from "../page";

export default async function FindingDetailPage({
  params
}: {
  params: Promise<{ findingId: string }>;
}) {
  const { findingId } = await params;
  return <FindingsPage searchParams={Promise.resolve({ findingId })} />;
}
