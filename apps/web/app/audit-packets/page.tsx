import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getAuditPacketsPageData } from "../../lib/data";

export default async function AuditPacketsPage({
  searchParams
}: {
  searchParams?: Promise<{ packetId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { packets, selectedPacket } = await getAuditPacketsPageData(params.packetId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Audit workspace"
        title="Audit Packets"
        copy="Assessment packets behave like reviewable work objects with scope, blockers, owner assignment, approvals, and export history."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Packet</th>
                <th>Status</th>
                <th>Scope</th>
                <th>Completeness</th>
                <th>Blockers</th>
              </tr>
            </thead>
            <tbody>
              {packets.map((packet) => (
                <tr key={packet.id}>
                  <td>
                    <a href={`/audit-packets/${packet.id}`}>{packet.title ?? packet.packetKey}</a>
                    <div className="table-meta">{packet.incident?.title ?? "Custom scope"}</div>
                  </td>
                  <td><StatusPill value={packet.status} /></td>
                  <td><StatusPill value={packet.scopeType} /></td>
                  <td>{packet.completenessPercent}%</td>
                  <td>{packet.missingEvidenceCount + packet.missingApprovalCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedPacket ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected packet</p>
                <h2>{selectedPacket.title ?? selectedPacket.packetKey}</h2>
                <p className="lede">{selectedPacket.description ?? "Assembled from incidents, findings, evidence, and review decisions."}</p>
              </div>
              <DetailList
                items={[
                  { label: "Owner", value: selectedPacket.ownerUser?.displayName },
                  { label: "Reviewer", value: selectedPacket.reviewerUser?.displayName },
                  { label: "Missing evidence", value: selectedPacket.missingEvidenceCount },
                  { label: "Missing approvals", value: selectedPacket.missingApprovalCount },
                  { label: "Latest export", value: selectedPacket.latestExportAt?.toLocaleString() }
                ]}
              />
              <div className="detail-block">
                <h3>Approval state</h3>
                {selectedPacket.approvalRequests.map((approval) => (
                  <div key={approval.id} className="list-card">
                    <strong>{approval.approvalType}</strong>
                    <div className="queue-meta">
                      <StatusPill value={approval.status} />
                      <span>{approval.dueAt?.toLocaleString() ?? "No due date"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-block">
                <h3>Manifest and blockers</h3>
                <pre className="json-block">{JSON.stringify(selectedPacket.manifestJson, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <p>No audit packets available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
