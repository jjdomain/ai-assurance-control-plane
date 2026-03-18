import Link from "next/link";
import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getControlsPageData } from "../../lib/data";

export default async function ControlsPage({
  searchParams
}: {
  searchParams?: Promise<{ controlId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { controls, selectedControl } = await getControlsPageData(params.controlId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Continuous controls monitoring"
        title="Controls"
        copy="Controls expose health, evidence freshness dependencies, mapped findings, recertification triggers, and attestation timing."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Control</th>
                <th>Pack</th>
                <th>Health</th>
                <th>Next review</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((control) => (
                <tr key={control.id}>
                  <td>
                    <Link href={`/controls/${control.id}`}>{control.code}</Link>
                    <div className="table-meta">{control.title}</div>
                  </td>
                  <td>{control.policyPack.name}</td>
                  <td><StatusPill value={control.controlHealth} /></td>
                  <td>{control.nextReviewDueAt?.toLocaleDateString() ?? "Not set"}</td>
                  <td>{control.controlMappings.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedControl ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected control</p>
                <h2>{selectedControl.code}</h2>
                <p className="lede">{selectedControl.title}</p>
              </div>
              <DetailList
                items={[
                  { label: "Health", value: selectedControl.controlHealth },
                  { label: "Risk category", value: selectedControl.riskCategory },
                  { label: "Evidence freshness", value: selectedControl.evidenceFreshnessRequirement },
                  { label: "Last attested", value: selectedControl.lastAttestedAt?.toLocaleDateString() },
                  { label: "Human approval", value: selectedControl.requiresHumanApproval ? "Required" : "Not required" }
                ]}
              />
              <div className="detail-block">
                <h3>Mapped findings</h3>
                {selectedControl.controlMappings.map((mapping) => (
                  <Link key={mapping.id} href={`/findings/${mapping.finding.id}`} className="list-card">
                    <strong>{mapping.finding.title}</strong>
                    <div className="queue-meta">
                      <StatusPill value={mapping.finding.evidenceFreshnessState} />
                      <span>{mapping.finding.ownerUser?.displayName ?? "Unassigned"}</span>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="detail-block">
                <h3>Snapshot history</h3>
                {selectedControl.statusSnapshots.map((snapshot) => (
                  <div key={snapshot.id} className="list-card">
                    <strong>{snapshot.capturedAt.toLocaleString()}</strong>
                    <div className="queue-meta">
                      <StatusPill value={snapshot.controlHealth} />
                      <StatusPill value={snapshot.freshnessState ?? "UNKNOWN"} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No controls available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
