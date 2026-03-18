import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

type DemoDataShape = {
  dashboard: any;
  findings: any[];
  reviews: any[];
  controls: any[];
  packets: any[];
  recertifications: any[];
  incidents: any[];
  evidence: any[];
};

let demoDataCache: DemoDataShape | null = null;

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, reviveDates(nested)])
    ) as T;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value) as T;
  }

  return value;
}

async function getDemoData() {
  if (demoDataCache) {
    return demoDataCache;
  }

  const filePath = path.join(process.cwd(), "lib", "demo-data.json");
  const raw = await fs.readFile(filePath, "utf8");
  demoDataCache = reviveDates(JSON.parse(raw)) as DemoDataShape;
  return demoDataCache;
}

function selectById<T extends { id: string }>(items: T[], selectedId?: string) {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

async function getNormalizedData() {
  const demoData = await getDemoData();
  const findings = demoData.findings.map((finding) => ({
    ...finding,
    evidence: finding.evidence ?? demoData.evidence.filter((item) => item.findingId === finding.id),
    reviewCases:
      finding.reviewCases?.length
        ? finding.reviewCases
        : demoData.reviews.filter((review) => review.finding?.id === finding.id || review.findingId === finding.id),
    incidents:
      finding.incidents?.length
        ? finding.incidents
        : demoData.incidents.filter((incident) => incident.finding?.id === finding.id || incident.findingId === finding.id),
    retentionDecisions:
      finding.retentionDecisions ??
      demoData.evidence
        .filter((item) => item.findingId === finding.id)
        .flatMap((item) => item.retentionDecisions ?? []),
    recertificationTasks:
      finding.recertificationTasks ??
      demoData.recertifications.filter((task) => task.finding?.id === finding.id || task.findingId === finding.id),
    ruleMatches: finding.ruleMatches ?? [],
    controlMappings: finding.controlMappings ?? [],
    run: finding.run ?? null
  }));

  const evidence = demoData.evidence.map((item) => ({
    ...item,
    finding: item.finding ?? findings.find((finding) => finding.id === item.findingId) ?? null,
    retentionDecisions: item.retentionDecisions ?? [],
    legalHolds: item.legalHolds ?? []
  }));

  const reviews = demoData.reviews.map((review) => ({
    ...review,
    finding: review.finding ?? findings.find((finding) => finding.id === review.findingId) ?? null,
    approvalRequests: review.approvalRequests ?? [],
    decisions: review.decisions ?? []
  }));

  const incidents = demoData.incidents.map((incident) => ({
    ...incident,
    finding: incident.finding ?? findings.find((finding) => finding.id === incident.findingId) ?? null,
    remediationTasks: incident.remediationTasks ?? [],
    auditPackets:
      incident.auditPackets?.length
        ? incident.auditPackets
        : demoData.packets.filter((packet) => packet.incident?.id === incident.id || packet.incidentId === incident.id)
  }));

  const controls = demoData.controls.map((control) => ({
    ...control,
    policyPack: control.policyPack ?? { id: `pack-${control.code}`, name: "Policy Pack" },
    controlMappings: control.controlMappings ?? [],
    statusSnapshots: control.statusSnapshots ?? [],
    recertificationTasks: control.recertificationTasks ?? []
  }));

  const packets = demoData.packets.map((packet) => ({
    ...packet,
    approvalRequests: packet.approvalRequests ?? [],
    exportJobs: packet.exportJobs ?? []
  }));

  const recertifications = demoData.recertifications.map((task) => ({
    ...task,
    finding: task.finding ?? findings.find((finding) => finding.id === task.findingId) ?? null,
    policyControl: task.policyControl ?? controls.find((control) => control.id === task.policyControlId) ?? null,
    evidenceRecord: task.evidenceRecord ?? evidence.find((item) => item.id === task.evidenceRecordId) ?? null
  }));

  const runs = Array.from(
    new Map(
      findings
        .filter((finding) => finding.run)
        .map((finding) => [
          finding.run.id,
          {
            ...finding.run,
            findings: [],
            evidence: [],
            events: finding.run.events ?? []
          }
        ])
    ).values()
  ).map((run: any) => ({
    ...run,
    findings: findings.filter((finding) => finding.runId === run.id),
    evidence: evidence.filter((item) => item.runId === run.id),
    events: run.events ?? []
  }));

  return {
    dashboard: demoData.dashboard,
    findings,
    evidence,
    reviews,
    incidents,
    controls,
    packets,
    recertifications,
    runs
  };
}

export async function getOverviewPageData() {
  const { dashboard, findings, reviews, controls, packets, recertifications, incidents } = await getNormalizedData();

  return {
    dashboard,
    kpis: [
      { label: "Open Review Cases", value: reviews.filter((item) => item.workflowStatus !== "CLOSED").length, href: "/reviews" },
      { label: "Material Findings", value: dashboard.openMaterialFindings, href: "/findings" },
      { label: "Stale Evidence", value: dashboard.evidenceFreshness.stale, href: "/evidence" },
      { label: "Incidents Requiring Action", value: dashboard.incidentsRequiringAction, href: "/incidents" },
      { label: "Controls Impacted", value: dashboard.controlsAtRisk, href: "/controls" },
      { label: "Recertifications Due", value: dashboard.recertificationsDue, href: "/recertifications" },
      {
        label: "Audit Packet Completeness",
        value: dashboard.packetReadiness.length
          ? `${Math.round(
              dashboard.packetReadiness.reduce((sum: number, packet: any) => sum + packet.completenessPercent, 0) /
                dashboard.packetReadiness.length
            )}%`
          : "0%",
        href: "/audit-packets"
      }
    ],
    freshnessBreakdown: [
      { state: "FRESH", count: dashboard.evidenceFreshness.fresh, href: "/evidence?freshness=FRESH" },
      { state: "WARNING", count: dashboard.evidenceFreshness.warning, href: "/evidence?freshness=WARNING" },
      { state: "STALE", count: dashboard.evidenceFreshness.stale, href: "/evidence?freshness=STALE" },
      { state: "MISSING", count: dashboard.evidenceFreshness.missing, href: "/evidence?freshness=MISSING" },
      { state: "HELD", count: dashboard.evidenceFreshness.held, href: "/evidence?freshness=HELD" }
    ],
    attentionFindings: findings.slice(0, 6),
    reviewLoad: reviews.slice(0, 5),
    atRiskControls: controls.filter((item) => item.controlHealth !== "HEALTHY").slice(0, 5),
    incidents: incidents.slice(0, 5),
    recertifications: recertifications.slice(0, 5),
    packets: packets.slice(0, 5)
  };
}

export async function getLandingPageData() {
  const demoData = await getNormalizedData();
  const overview = await getOverviewPageData();

  const policyPacks =
    Array.from(
      new Map(
        demoData.controls.map((control) => [
          control.policyPack?.id ?? control.policyPack?.name ?? control.code,
          {
            id: control.policyPack?.id ?? control.policyPack?.name ?? control.code,
            name: control.policyPack?.name ?? "Policy Pack",
            version: "seeded",
            sourceType: "SEED",
            controls: demoData.controls.filter((item) => item.policyPack?.name === control.policyPack?.name),
            retentionPolicies: []
          }
        ])
      ).values()
    ).slice(0, 6) ?? [];

  const connectors = [
    {
      id: "seed-openclaw",
      name: "OpenClaw via Opik",
      status: "ACTIVE",
      connectorType: "OPENCLAW_OPIK",
      system: { name: "Framework-agnostic seeded connector" }
    }
  ];

  const scenarios = demoData.findings.slice(0, 6).map((finding) => ({
    runId: finding.runId,
    title: finding.run?.metadataJson?.label ?? finding.title,
    summary: finding.run?.metadataJson?.summary ?? finding.summary,
    systemName: finding.run?.metadataJson?.agentSystem?.name ?? "Seeded system",
    findingCount: demoData.findings.filter((item) => item.runId === finding.runId).length,
    environment: finding.run?.environment ?? "PROD"
  }));

  return {
    overview,
    policyPacks,
    connectors,
    scenarios
  };
}

export async function getRunsPageData(selectedRunId?: string, environment?: string) {
  const demoData = await getNormalizedData();
  const runs = demoData.runs.filter((run) => (environment ? run.environment === environment : true));

  return {
    runs,
    selectedRun: selectById(runs, selectedRunId)
  };
}

export async function getFindingsPageData(selectedFindingId?: string, severity?: string) {
  const demoData = await getNormalizedData();
  const findings = demoData.findings.filter((finding) => (severity ? finding.severity === severity : true));

  return {
    findings,
    selectedFinding: selectById(findings, selectedFindingId)
  };
}

export async function getEvidencePageData(selectedEvidenceId?: string, freshness?: string) {
  const demoData = await getNormalizedData();
  const evidence = demoData.evidence.filter((item) => (freshness ? item.freshnessState === freshness : true));

  return {
    evidence,
    selectedEvidence: selectById(evidence, selectedEvidenceId)
  };
}

export async function getReviewsPageData(selectedReviewId?: string, status?: string) {
  const demoData = await getNormalizedData();
  const reviews = demoData.reviews.filter((review) => (status ? review.workflowStatus === status : true));

  return {
    reviews,
    selectedReview: selectById(reviews, selectedReviewId)
  };
}

export async function getIncidentsPageData(selectedIncidentId?: string) {
  const demoData = await getNormalizedData();
  return {
    incidents: demoData.incidents,
    selectedIncident: selectById(demoData.incidents, selectedIncidentId)
  };
}

export async function getControlsPageData(selectedControlId?: string) {
  const demoData = await getNormalizedData();
  return {
    controls: demoData.controls,
    selectedControl: selectById(demoData.controls, selectedControlId)
  };
}

export async function getRetentionPageData(selectedEvidenceId?: string) {
  const demoData = await getNormalizedData();
  return {
    evidence: demoData.evidence,
    selectedEvidence: selectById(demoData.evidence, selectedEvidenceId)
  };
}

export async function getAuditPacketsPageData(selectedPacketId?: string) {
  const demoData = await getNormalizedData();
  return {
    packets: demoData.packets,
    selectedPacket: selectById(demoData.packets, selectedPacketId)
  };
}

export async function getRecertificationsPageData(selectedTaskId?: string) {
  const demoData = await getNormalizedData();
  return {
    tasks: demoData.recertifications,
    selectedTask: selectById(demoData.recertifications, selectedTaskId)
  };
}

export async function getPolicyPacksPageData(selectedPackId?: string) {
  const { policyPacks } = await getLandingPageData();
  return {
    packs: policyPacks,
    selectedPack: selectById(policyPacks, selectedPackId)
  };
}

export async function getConnectorsPageData() {
  const { connectors } = await getLandingPageData();
  return {
    connectors,
    workspaces: [
      {
        id: "seed-workspace",
        name: "OpenClaw Oversight Demo",
        environment: "PROD",
        organization: { name: "Demo Org" }
      }
    ]
  };
}

export async function getDemoScenariosPageData() {
  const { scenarios } = await getLandingPageData();
  return { scenarios };
}

export async function getSettingsPageData() {
  return {
    workspaces: [
      {
        id: "seed-workspace",
        name: "OpenClaw Oversight Demo",
        environment: "PROD",
        organization: { name: "Demo Org" },
        metadataJson: {
          profile: "OPENCLAW_V1",
          governanceContext: {
            reviewTemplates: ["reviewer_material_finding_default", "reviewer_privacy_retention_decision"],
            incidentPlaybooks: ["unsafe_external_action_playbook", "approval_checkpoint_failure_playbook"],
            auditPacketPresets: ["internal_assurance_review", "post_incident_internal_review"]
          }
        }
      }
    ]
  };
}
