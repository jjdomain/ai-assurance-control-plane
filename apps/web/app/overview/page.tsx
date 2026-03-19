import Link from "next/link";
import { getOverviewPageData } from "../../lib/data";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const data = await getOverviewPageData();

  return (
    <main className="console-page">
      <section className="panel">
        <p className="eyebrow">Assurance operations system of record</p>
        <h1>Dashboard</h1>
        <p className="lede">
          Readiness-first posture across review workload, material findings, evidence freshness, incidents, recertification, and audit packet blockers.
        </p>
      </section>

      <section className="metrics-grid">
        {data.kpis.map((item) => (
          <Link key={item.label} href={item.href} className="panel">
            <p className="metric-label">{item.label}</p>
            <strong>{item.value}</strong>
          </Link>
        ))}
      </section>

      <section className="overview-grid">
        <div className="stack-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Attention Queue</p>
                <h2>Material findings requiring action</h2>
              </div>
              <Link href="/findings" className="inline-link">
                Open queue
              </Link>
            </div>
            <div className="queue-list">
              {data.attentionFindings.map((finding) => (
                <Link key={finding.id} href={`/findings/${finding.id}`} className="queue-item">
                  <div className="queue-topline">
                    <strong>{finding.title}</strong>
                    <span className="status-pill warning">{finding.materialityLevel}</span>
                  </div>
                  <p className="panel-subtitle">{finding.summary}</p>
                  <div className="queue-meta">
                    <span>{finding.ownerUser?.displayName ?? "Unassigned"}</span>
                    <span>{finding.controlMappings.length} controls</span>
                    <span>{finding.evidenceFreshnessState}</span>
                    <span>{finding.reviewCases[0]?.workflowStatus ?? "No review"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Evidence Freshness</p>
                <h2>Freshness by assurance state</h2>
              </div>
              <Link href="/evidence" className="inline-link">
                Inspect evidence
              </Link>
            </div>
            <div className="segmented-list">
              {data.freshnessBreakdown.map((item) => (
                <Link key={item.state} href={item.href} className="segmented-row">
                  <span>{item.state.replaceAll("_", " ")}</span>
                  <span className="status-pill">{item.count}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="stack-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Review Workload</p>
                <h2>Approvals and due decisions</h2>
              </div>
              <Link href="/reviews?status=PENDING_APPROVER" className="inline-link">
                Review queue
              </Link>
            </div>
            <div className="mini-list">
              {data.reviewLoad.map((review) => (
                <Link key={review.id} href={`/reviews/${review.id}`} className="list-card">
                  <strong>{review.title ?? review.finding?.title ?? review.id}</strong>
                  <div className="queue-meta">
                    <span>{review.workflowStatus}</span>
                    <span>{review.slaState}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Controls</p>
                <h2>Drift and freshness dependencies</h2>
              </div>
              <Link href="/controls" className="inline-link">
                Open controls
              </Link>
            </div>
            <div className="mini-list">
              {data.atRiskControls.map((control) => (
                <Link key={control.id} href={`/controls/${control.id}`} className="list-card">
                  <strong>{control.code}</strong>
                  <div className="queue-meta">
                    <span>{control.title}</span>
                    <span>{control.controlHealth}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Audit Readiness</p>
                <h2>Packets, incidents, and recertifications</h2>
              </div>
            </div>
            <div className="mini-list">
              {data.packets.map((packet) => (
                <Link key={packet.id} href={`/audit-packets/${packet.id}`} className="list-card">
                  <strong>{packet.title ?? packet.packetKey}</strong>
                  <div className="queue-meta">
                    <span>{packet.status}</span>
                    <span>{packet.completenessPercent}% complete</span>
                  </div>
                </Link>
              ))}
              {data.recertifications.map((task) => (
                <Link key={task.id} href={`/recertifications/${task.id}`} className="list-card">
                  <strong>{task.title}</strong>
                  <div className="queue-meta">
                    <span>{task.status}</span>
                    <span>{task.ownerUser?.displayName ?? "Unassigned"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
