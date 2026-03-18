import { placeLegalHoldAction } from "../actions";
import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getRetentionPageData } from "../../lib/data";

export default async function RetentionPage({
  searchParams
}: {
  searchParams?: Promise<{ evidenceId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { evidence, selectedEvidence } = await getRetentionPageData(params.evidenceId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Retention governance"
        title="Retention & Legal Hold"
        copy="Evidence retention is operationally visible: active, expiring, held, or superseded with policy basis and destruction scheduling."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Evidence</th>
                <th>Retention</th>
                <th>Hold</th>
                <th>Finding</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((item) => (
                <tr key={item.id}>
                  <td><a href={`/retention?evidenceId=${item.id}`}>{item.title ?? item.evidenceType}</a></td>
                  <td><StatusPill value={item.retentionState} /></td>
                  <td><StatusPill value={item.legalHoldActive ? "HELD" : "ACTIVE"} /></td>
                  <td>{item.finding?.title ?? "Unlinked"}</td>
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
                <p className="lede">{selectedEvidence.summary ?? "Retention basis, hold state, and deletion schedule."}</p>
              </div>
              <DetailList
                items={[
                  { label: "Retention state", value: selectedEvidence.retentionState },
                  { label: "Freshness", value: selectedEvidence.freshnessState },
                  { label: "Legal hold", value: selectedEvidence.legalHoldActive ? "Active" : "No" },
                  { label: "Expires", value: selectedEvidence.expiresAt?.toLocaleDateString() },
                  { label: "Last exported", value: selectedEvidence.lastExportedAt?.toLocaleString() }
                ]}
              />
              <div className="detail-block">
                <h3>Decision history</h3>
                {selectedEvidence.retentionDecisions.map((decision) => (
                  <div key={decision.id} className="list-card">
                    <strong>{decision.retentionPolicy.name}</strong>
                    <div className="queue-meta">
                      <StatusPill value={decision.state} />
                      <span>{decision.destructionScheduledAt?.toLocaleDateString() ?? "No deletion date"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-block">
                <h3>Hold action</h3>
                <form action={placeLegalHoldAction} className="action-form">
                  <input type="hidden" name="evidenceRecordId" value={selectedEvidence.id} />
                  <input type="hidden" name="reason" value="Retention workspace hold." />
                  <button type="submit" className="button-primary">Apply legal hold</button>
                </form>
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
