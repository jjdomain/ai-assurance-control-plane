import Link from "next/link";
import { getLandingPageData } from "../lib/data";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { overview, policyPacks, connectors, scenarios } = await getLandingPageData();

  return (
    <main className="console-page">
      <section className="panel">
        <p className="eyebrow">Portfolio Project · AI Security / Governance / Assurance</p>
        <h1>From agent runtime signals to accountable assurance workflows</h1>
        <p className="lede">
          AI Assurance Control Plane ingests signals from agent frameworks, telemetry tools, and security layers, then
          converts them into material findings, retained evidence, human review, incidents, and audit-ready outputs.
        </p>
        <div className="toolbar">
          <Link href="/overview" className="button-primary">
            Explore the workflow
          </Link>
          <Link href="/runs" className="button-secondary">
            View architecture
          </Link>
        </div>
        <div className="chip-row">
          {[
            "Framework-agnostic",
            "Evidence-first",
            "Human review built in",
            "Retention and legal hold aware",
            "Audit export ready"
          ].map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>
        <p className="panel-subtitle">
          Designed as a portfolio-grade control plane for AI assurance operations, not another generic observability dashboard.
        </p>
      </section>

      <section className="metrics-grid">
        {overview.kpis.map((item) => (
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
              <p className="eyebrow">What this project is</p>
              <h2>Assurance operations above traces, evals, and scanners</h2>
            </div>
          </div>
          <p className="lede">
            Most AI tooling stops at traces, eval results, or runtime policy decisions. This project focuses on what comes next:
            deciding what matters, preserving the right evidence, routing human review, escalating incidents, handling retention
            and legal hold, and assembling audit-ready assurance artifacts.
          </p>
          <div className="mini-list">
            {[
              "Ingests runtime and security signals",
              "Classifies material vs non-material events",
              "Maps findings to controls and policy packs",
              "Preserves evidence with provenance and review state",
              "Supports incidents, remediation, and recertification",
              "Exports audit-ready packets"
            ].map((item) => (
              <div key={item} className="list-card">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">How it works</p>
              <h2>Runtime signals become accountable records</h2>
            </div>
          </div>
          <div className="mini-list">
            {[
              ["Ingest signals", "Pull in runs, traces, tool activity, policy events, and external findings."],
              ["Classify what matters", "Apply rules and control mappings to distinguish noise from material assurance events."],
              ["Retain evidence and route review", "Preserve relevant evidence, assign owners, request reviewer decisions, and escalate when needed."],
              ["Export accountable outcomes", "Track incidents, recertification, and packet completeness so the record is usable later."]
            ].map(([title, body]) => (
              <div key={title} className="list-card">
                <strong>{title}</strong>
                <p className="panel-subtitle">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="overview-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Core capabilities</p>
              <h2>Evidence, review, incidents, retention, and audit packets</h2>
            </div>
          </div>
          <div className="mini-list">
            {[
              "Material findings convert runtime events into assurance work objects.",
              "Evidence records carry provenance, redaction state, retention labels, and approval posture.",
              "Review queues capture accountable decisions instead of leaving events stranded in monitoring feeds.",
              "Incident escalation ties source findings, remediation, and post-incident packet readiness together.",
              "Retention and legal hold logic separates ordinary snapshots from governed evidence.",
              "Audit packets bundle findings, evidence, decisions, and timelines into reusable exports."
            ].map((item) => (
              <div key={item} className="list-card">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Upstream signals, downstream accountability</p>
              <h2>Inputs and governance context</h2>
            </div>
          </div>
          <div className="mini-list">
            {connectors.slice(0, 3).map((connector) => (
              <div key={connector.id} className="list-card">
                <strong>{connector.name}</strong>
                <div className="queue-meta">
                  <span>{connector.status}</span>
                  <span>{connector.system?.name ?? "Framework-agnostic input"}</span>
                </div>
              </div>
            ))}
            {policyPacks.slice(0, 3).map((pack) => (
              <div key={pack.id} className="list-card">
                <strong>{pack.name}</strong>
                <div className="queue-meta">
                  <span>{pack.controls.length} controls</span>
                  <span>{pack.retentionPolicies.length} retention policies</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Example workflow</p>
            <h2>Runtime event to audit-ready record</h2>
          </div>
          <Link href="/demo-scenarios" className="inline-link">
            Open scenarios
          </Link>
        </div>
        <div className="mini-list">
          {scenarios.slice(0, 4).map((scenario) => (
            <Link key={scenario.runId} href={`/runs/${scenario.runId}`} className="list-card">
              <strong>{scenario.title}</strong>
              <p className="panel-subtitle">{scenario.summary}</p>
              <div className="queue-meta">
                <span>{scenario.systemName}</span>
                <span>{scenario.findingCount} findings</span>
                <span>{scenario.environment}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
