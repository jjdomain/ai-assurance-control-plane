import ControlsPage from "../page";

export default async function ControlDetailPage({
  params
}: {
  params: Promise<{ controlId: string }>;
}) {
  const { controlId } = await params;
  return <ControlsPage searchParams={Promise.resolve({ controlId })} />;
}
