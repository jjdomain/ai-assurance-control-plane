import IncidentsPage from "../page";

export default async function IncidentDetailPage({
  params
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  return <IncidentsPage searchParams={Promise.resolve({ incidentId })} />;
}
