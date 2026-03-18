import RunsPage from "../page";

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunsPage searchParams={Promise.resolve({ runId })} />;
}
