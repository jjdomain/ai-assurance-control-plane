import Link from "next/link";
import { acceptRiskAction, confirmRetentionDecisionAction } from "../actions";
import { DetailList, FilterLink, SectionHeader, StatusPill } from "../../components/console";
import { getFindingsPageData } from "../../lib/data";

export default async function FindingsPage({
  searchParams
}: {
  searchParams?: Promise<{ findingId?: string; severity?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { findings, selectedFinding } = await getFindingsPageData(params.findingId, params.severity);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Material events"
        title="Findings"
        copy="Runtime activity is only the input. Findings are the governed object: they carry materiality, evidence freshness, owners, review deadlines, incidents, and recertification state."
      />
      <div className="toolbar">
        <FilterLink href="/findings" label="All" active={!params.severity} />
        <FilterLink href="/findings?severity=CRITICAL" label="Critical" active={params.severity === "CRITICAL"} />
        <FilterLink href="/findings?severity=HIGH" label="High" active={params.severity === "HIGH"} />
        <FilterLink href="/findings?severity=MEDIUM" label="Medium" active={params.severity === "MEDIUM"} />
      </div>
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Finding</th>
                <th>Severity</th>
                <th>Materiality</th>
                <th>Owner</th>
                <th>Evidence</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => (
                <tr key={finding.id}>
                  <td>
                    <Link href={`/findings/${finding.id}`}>{finding.title}</Link>
                    <div className="table-meta">{finding.run.externalRunId}</div>
                  </td>
                  <td><StatusPill value={finding.severity} /></td>
                  <td><StatusPill value={finding.materialityLevel} /></td>
                  <td>{finding.ownerUser?.displayName ?? "Unassigned"}</td>
                  <td><StatusPill value={finding.evidenceFreshnessState} /></td>
                  <td><StatusPill value={finding.reviewCases[0]?.workflowStatus ?? "NOT_REQUIRED"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedFinding ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected finding</p>
                <h2>{selectedFinding.title}</h2>
                <p className="lede">{selectedFinding.summary}</p>
              </div>
              <DetailList
                items={[
                  { label: "Workflow", value: selectedFinding.workflowState },
                  { label: "Owner", value: selectedFinding.ownerUser?.displayName },
                  { label: "Review due", value: selectedFinding.reviewDueAt?.toLocaleString() },
                  { label: "Risk class", value: selectedFinding.sourceRiskClass },
                  { label: "Accepted risk until", value: selectedFinding.acceptedRiskUntil?.toLocaleDateString() }
                ]}
              />
              <div className="detail-block">
                <h3>Controls</h3>
                <div className="chip-row">
                  {selectedFinding.controlMappings.map((mapping) => (
                    <span key={mapping.id} className="chip">
                      {mapping.policyControl.code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="detail-block">
                <h3>Rule and why fired</h3>
                {selectedFinding.ruleMatches.map((match) => (
                  <pre key={match.id} className="json-block">
                    {JSON.stringify(match.explainabilityJson, null, 2)}
                  </pre>
                ))}
              </div>
              <div className="detail-block">
                <h3>Evidence and retention</h3>
                {selectedFinding.evidence.map((record) => (
                  <Link key={record.id} href={`/evidence/${record.id}`} className="list-card">
                    <strong>{record.title ?? record.evidenceType}</strong>
                    <div className="queue-meta">
                      <StatusPill value={record.freshnessState} />
                      <StatusPill value={record.approvedForAudit ? "APPROVED" : "UNAPPROVED"} />
                    </div>
                  </Link>
                ))}
                {selectedFinding.retentionDecisions.map((decision) => (
                  <form key={decision.id} action={confirmRetentionDecisionAction} className="action-form">
                    <input type="hidden" name="retentionDecisionId" value={decision.id} />
                    <span>{decision.retentionLabel}</span>
                    <button type="submit" className="button-secondary">Confirm retention</button>
                  </form>
                ))}
              </div>
              <div className="detail-block">
                <h3>Workflow actions</h3>
                <form action={acceptRiskAction} className="action-form">
                  <input type="hidden" name="findingId" value={selectedFinding.id} />
                  <button type="submit" className="button-primary">Accept risk with expiry</button>
                </form>
                {selectedFinding.recertificationTasks.map((task) => (
                  <Link key={task.id} href={`/recertifications/${task.id}`} className="list-card">
                    <strong>{task.title}</strong>
                    <div className="queue-meta">
                      <StatusPill value={task.status} />
                      <span>{task.triggerType}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p>No findings available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
