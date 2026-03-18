import Link from "next/link";
import { FilterLink, SectionHeader, StatusPill } from "../../components/console";
import { getRunsPageData } from "../../lib/data";

export default async function RunsPage({
  searchParams
}: {
  searchParams?: Promise<{ runId?: string; environment?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { runs, selectedRun } = await getRunsPageData(params.runId, params.environment);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="OpenClaw v1"
        title="Runs"
        copy="Normalized OpenClaw runs with event timelines, findings, and linked evidence."
      />
      <div className="toolbar">
        <FilterLink href="/runs" label="All" active={!params.environment} />
        <FilterLink href="/runs?environment=PROD" label="PROD" active={params.environment === "PROD"} />
        <FilterLink href="/runs?environment=STAGING" label="STAGING" active={params.environment === "STAGING"} />
      </div>
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Env</th>
                <th>Status</th>
                <th>Findings</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td><Link href={`/runs/${run.id}`}>{run.externalRunId}</Link></td>
                  <td>{run.environment}</td>
                  <td><StatusPill value={run.status} /></td>
                  <td>{run.findings.length}</td>
                  <td>{new Date(run.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedRun ? (
            <>
              <div className="detail-block">
                <p className="eyebrow">Selected run</p>
                <h2>{selectedRun.externalRunId}</h2>
                <p>{selectedRun.environment} · {selectedRun.modelRef ?? "Unknown model"}</p>
              </div>
              <div className="metric-row">
                <div><span className="metric-label">Events</span><strong>{selectedRun.events.length}</strong></div>
                <div><span className="metric-label">Findings</span><strong>{selectedRun.findings.length}</strong></div>
                <div><span className="metric-label">Evidence</span><strong>{selectedRun.evidence.length}</strong></div>
              </div>
              <div className="detail-block">
                <h3>Timeline</h3>
                <div className="timeline">
                  {selectedRun.events.map((event) => (
                    <div key={event.id} className="timeline-item">
                      <div className="timeline-marker" />
                      <div>
                        <p className="timeline-title">{event.eventType}</p>
                        <p className="timeline-copy">{new Date(event.eventTime).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="detail-block">
                <h3>Linked findings</h3>
                {selectedRun.findings.map((finding) => (
                  <Link key={finding.id} href={`/findings/${finding.id}`} className="list-card">
                    <span>{finding.title}</span>
                    <StatusPill value={finding.severity} />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p>No runs available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
