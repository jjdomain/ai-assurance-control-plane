import RecertificationsPage from "../page";

export default async function RecertificationDetailPage({
  params
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <RecertificationsPage searchParams={Promise.resolve({ taskId })} />;
}
