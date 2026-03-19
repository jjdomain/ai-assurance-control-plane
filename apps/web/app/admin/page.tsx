import Link from "next/link";
import { SectionHeader } from "../../components/console";
import { getAdminPageData } from "../../lib/data";

export default async function AdminPage() {
  const data = await getAdminPageData();

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Configuration surface"
        title="Admin Console"
        copy="Define the assurance logic, attach policy context, map controls, and trace how those definitions become findings, review work, incidents, and exportable audit output."
      />

      <section className="metrics-grid">
        {data.stats.map((item) => (
          <Link key={item.label} href={item.href} className="panel">
            <p className="metric-label">{item.label}</p>
            <strong>{item.value}</strong>
          </Link>
        ))}
      </section>

      <section className="overview-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Assurance chain</p>
              <h2>Definition to export</h2>
            </div>
          </div>
          <div className="mini-list">
            {data.flow.map((step) => (
              <Link key={step.title} href={step.href} className="list-card">
                <strong>{step.title}</strong>
                <p className="panel-subtitle">{step.copy}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Priority configuration</p>
              <h2>Rules, packs, and mappings in use</h2>
            </div>
          </div>
          <div className="mini-list">
            {data.highlightedRules.map((rule: any) => (
              <Link key={rule.id} href={`/rules?ruleId=${rule.id}`} className="list-card">
                <strong>{rule.name}</strong>
                <div className="queue-meta">
                  <span>{rule.eventType}</span>
                  <span>{rule.caseType ?? "RUNTIME_REVIEW"}</span>
                  <span>{rule.matchedFindingsCount} findings</span>
                </div>
              </Link>
            ))}
            {data.highlightedPacks.map((pack: any) => (
              <Link key={pack.id} href={`/policy-packs?packId=${pack.id}`} className="list-card">
                <strong>{pack.name}</strong>
                <div className="queue-meta">
                  <span>{pack.controls.length} controls</span>
                  <span>{pack.retentionPolicies.length} retention policies</span>
                </div>
              </Link>
            ))}
            {data.highlightedMappings.map((mapping: any) => (
              <Link key={mapping.id} href={`/control-mappings?mappingId=${mapping.id}`} className="list-card">
                <strong>{mapping.ruleName}</strong>
                <div className="queue-meta">
                  <span>{mapping.control.controlCode}</span>
                  <span>{mapping.caseType}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
