import { approveEvidenceAction, placeLegalHoldAction } from "../actions";
import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getEvidencePageData } from "../../lib/data";

export default async function EvidencePage({
  searchParams
}: {
  searchParams?: Promise<{ evidenceId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { evidence, selectedEvidence } = await getEvidencePageData(params.evidenceId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Evidence workspace"
        title="Evidence"
        copy="Governed evidence objects with freshness, approval, redaction, provenance, retention basis, and hold state."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Evidence</th>
                <th>Freshness</th>
                <th>Audit</th>
                <th>Retention</th>
                <th>Hold</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={`/evidence/${item.id}`}>{item.title ?? item.evidenceType}</a>
                    <div className="table-meta">{item.finding?.title ?? "Unlinked evidence"}</div>
                  </td>
                  <td><StatusPill value={item.freshnessState} /></td>
                  <td><StatusPill value={item.approvedForAudit ? "APPROVED" : "REVIEW_REQUIRED"} /></td>
                  <td><StatusPill value={item.retentionState} /></td>
                  <td><StatusPill value={item.legalHoldActive ? "HELD" : "ACTIVE"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedEvidence ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected evidence</p>
                <h2>{selectedEvidence.title ?? selectedEvidence.evidenceType}</h2>
                <p className="lede">{selectedEvidence.summary ?? selectedEvidence.contentPreview ?? "No preview available."}</p>
              </div>
              <DetailList
                items={[
                  { label: "Collection method", value: selectedEvidence.collectionMethod },
                  { label: "Sensitivity", value: selectedEvidence.sensitivityClass },
                  { label: "Redaction", value: selectedEvidence.redactionState },
                  { label: "Approved by", value: selectedEvidence.approvedByUser?.displayName },
                  { label: "Source window", value: selectedEvidence.sourceTimeWindowStart?.toLocaleString() }
                ]}
              />
              <div className="detail-block">
                <h3>Linked controls and finding</h3>
                <div className="chip-row">
                  {selectedEvidence.finding?.controlMappings.map((mapping) => (
                    <span key={mapping.id} className="chip">{mapping.policyControl.code}</span>
                  ))}
                </div>
                <p className="panel-subtitle">{selectedEvidence.finding?.title ?? "No linked finding"}</p>
              </div>
              <div className="detail-block">
                <h3>Retention and export posture</h3>
                {selectedEvidence.retentionDecisions.map((decision) => (
                  <div key={decision.id} className="list-card">
                    <strong>{decision.retentionPolicy.name}</strong>
                    <div className="queue-meta">
                      <StatusPill value={decision.state} />
                      <span>{decision.policyBasis ?? "Policy required"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-block">
                <h3>Actions</h3>
                <form action={approveEvidenceAction} className="action-form">
                  <input type="hidden" name="evidenceRecordId" value={selectedEvidence.id} />
                  <button type="submit" className="button-primary">Approve for audit</button>
                </form>
                <form action={placeLegalHoldAction} className="action-form">
                  <input type="hidden" name="evidenceRecordId" value={selectedEvidence.id} />
                  <input type="hidden" name="reason" value="Manual hold from evidence workspace." />
                  <button type="submit" className="button-secondary">Apply legal hold</button>
                </form>
              </div>
              <div className="detail-block">
                <h3>Provenance snapshot</h3>
                <pre className="json-block">{JSON.stringify(selectedEvidence.snapshotJson, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <p>No evidence available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
