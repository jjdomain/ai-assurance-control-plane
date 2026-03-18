import Link from "next/link";
import { generateAuditPacketAction } from "../actions";
import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getIncidentsPageData } from "../../lib/data";

export default async function IncidentsPage({
  searchParams
}: {
  searchParams?: Promise<{ incidentId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { incidents, selectedIncident } = await getIncidentsPageData(params.incidentId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Incident response"
        title="Incidents"
        copy="Findings can escalate into incidents with inherited evidence, control mappings, remediation SLAs, and packet generation."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Packets</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <Link href={`/incidents/${incident.id}`}>{incident.title}</Link>
                    <div className="table-meta">{incident.summary}</div>
                  </td>
                  <td><StatusPill value={incident.severity} /></td>
                  <td><StatusPill value={incident.status} /></td>
                  <td>{incident.ownerUser?.displayName ?? "Unassigned"}</td>
                  <td>{incident.auditPackets.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedIncident ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected incident</p>
                <h2>{selectedIncident.title}</h2>
                <p className="lede">{selectedIncident.summary}</p>
              </div>
              <DetailList
                items={[
                  { label: "Source findings", value: selectedIncident.sourceFindingCount },
                  { label: "Remediation SLA", value: selectedIncident.remediationSlaAt?.toLocaleString() },
                  { label: "Control impact", value: selectedIncident.controlImpactSummary },
                  { label: "Post-incident packet", value: selectedIncident.needsPostIncidentPacket ? "Required" : "Optional" }
                ]}
              />
              <div className="detail-block">
                <h3>Inherited controls and evidence</h3>
                <div className="chip-row">
                  {selectedIncident.finding?.controlMappings.map((mapping) => (
                    <span key={mapping.id} className="chip">{mapping.policyControl.code}</span>
                  ))}
                </div>
                {selectedIncident.finding?.evidence.map((record) => (
                  <Link key={record.id} href={`/evidence/${record.id}`} className="list-card">
                    <strong>{record.title ?? record.evidenceType}</strong>
                    <div className="queue-meta">
                      <StatusPill value={record.freshnessState} />
                      <StatusPill value={record.legalHoldActive ? "HELD" : record.retentionState} />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="detail-block">
                <h3>Remediation</h3>
                {selectedIncident.remediationTasks.map((task) => (
                  <div key={task.id} className="list-card">
                    <strong>{task.title}</strong>
                    <div className="queue-meta">
                      <StatusPill value={task.status} />
                      <span>{task.dueAt?.toLocaleDateString() ?? "No due date"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-block">
                <h3>Packet actions</h3>
                <form action={generateAuditPacketAction} className="action-form">
                  <input type="hidden" name="incidentId" value={selectedIncident.id} />
                  <button type="submit" className="button-primary">Assemble packet</button>
                </form>
                {selectedIncident.auditPackets.map((packet) => (
                  <Link key={packet.id} href={`/audit-packets/${packet.id}`} className="list-card">
                    <strong>{packet.title ?? packet.packetKey}</strong>
                    <div className="queue-meta">
                      <StatusPill value={packet.status} />
                      <span>{packet.completenessPercent}% complete</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p>No incidents available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
