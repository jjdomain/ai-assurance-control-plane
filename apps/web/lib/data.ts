import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import { prisma } from "./prisma";

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

type RuleDocumentShape = {
  schemaVersion: number;
  generatedAt: string;
  defaultRuleEngineConfig?: Record<string, unknown>;
  rules?: Array<Record<string, any>>;
};

type PolicyDocumentShape = {
  schemaVersion: number;
  generatedAt: string;
  packs?: Array<Record<string, any>>;
};

let demoDataCache: DemoDataShape | null = null;
let ruleDocumentCache: RuleDocumentShape | null = null;
let policyDocumentCache: PolicyDocumentShape | null = null;

function getWorkspaceRoot() {
  return path.resolve(process.cwd(), "..", "..");
}

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

async function getRuleDocument() {
  if (ruleDocumentCache) {
    return ruleDocumentCache;
  }

  const filePath = path.join(getWorkspaceRoot(), "sample_rules.yaml");
  const raw = await fs.readFile(filePath, "utf8");
  ruleDocumentCache = yaml.parse(raw) as RuleDocumentShape;
  return ruleDocumentCache;
}

async function getPolicyDocument() {
  if (policyDocumentCache) {
    return policyDocumentCache;
  }

  const filePath = path.join(getWorkspaceRoot(), "sample_policy_packs.yaml");
  const raw = await fs.readFile(filePath, "utf8");
  policyDocumentCache = yaml.parse(raw) as PolicyDocumentShape;
  return policyDocumentCache;
}

function selectById<T extends { id: string }>(items: T[], selectedId?: string) {
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

async function getAdminWorkspace() {
  return prisma.workspace.findFirst({
    include: {
      organization: true
    }
  });
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

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
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
  const workspace = await getAdminWorkspace();
  if (!workspace) {
    return { packs: [], selectedPack: null };
  }

  const packs = await prisma.policyPack.findMany({
    where: { organizationId: workspace.organizationId },
    include: {
      controls: {
        orderBy: { code: "asc" }
      },
      retentionPolicies: {
        orderBy: { name: "asc" }
      }
    },
    orderBy: [{ slug: "asc" }, { version: "desc" }]
  });

  const packsWithConfig = packs.map((pack) => {
    const rawJson = asRecord(pack.rawJson);
    return {
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      version: pack.version,
      sourceType: pack.sourceType,
      isActive: pack.isActive,
      description: rawJson.description ?? "Policy and control context for assurance workflows.",
      categories: rawJson.categories ?? [],
      retentionPolicies: pack.retentionPolicies,
      controls: pack.controls.map((control) => ({
        id: control.id,
        code: control.code,
        title: control.title,
        category: control.categoryCode,
        impactLevel: control.impactLevel,
        relatedEventTypes: asRecord(control.metadataJson).relatedEventTypes ?? [],
        evidenceRequirements: asRecord(control.metadataJson).evidenceRequirements ?? [],
        reviewRequirements: asRecord(control.metadataJson).reviewRequirements ?? [],
        controlHealth: control.controlHealth,
        description: control.description,
        reviewCadence: control.reviewCadence,
        evidenceFreshnessRequirement: control.evidenceFreshnessRequirement,
        requiresHumanApproval: control.requiresHumanApproval,
        requiredEvidenceTypesJson: control.requiredEvidenceTypesJson
      }))
    };
  });
  return {
    packs: packsWithConfig,
    selectedPack: selectById(packsWithConfig, selectedPackId)
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
  const workspace = await getAdminWorkspace();
  return {
    workspaces: workspace ? [workspace] : []
  };
}

export async function getRulesPageData(selectedRuleId?: string) {
  const workspace = await getAdminWorkspace();
  if (!workspace) {
    return { rules: [], selectedRule: null, config: {}, testingRuns: [] };
  }

  const [ruleDefinitions, controls, runs] = await Promise.all([
    prisma.ruleDefinition.findMany({
      where: { organizationId: workspace.organizationId },
      orderBy: [{ slug: "asc" }, { version: "desc" }]
    }),
    prisma.policyControl.findMany({
      where: {
        policyPack: { organizationId: workspace.organizationId }
      },
      include: { policyPack: true }
    }),
    prisma.run.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { startedAt: "desc" },
      take: 12
    })
  ]);

  const controlsByCode = new Map(
    controls.map((control) => [
      control.code,
      {
        code: control.code,
        title: control.title,
        category: control.categoryCode,
        packName: control.policyPack.name
      }
    ])
  );

  const rules: any[] = await Promise.all(
    ruleDefinitions.map(async (ruleDefinition) => {
      const rawJson = asRecord(ruleDefinition.rawJson);
      return {
        id: ruleDefinition.id,
        slug: ruleDefinition.slug,
        name: ruleDefinition.name,
        version: ruleDefinition.version,
        isActive: ruleDefinition.isActive,
        sourceType: ruleDefinition.sourceType,
        matchedFindingsCount: await prisma.findingRuleMatch.count({
          where: { ruleDefinitionId: ruleDefinition.id }
        }),
        triggeredRunsCount: 0,
        linkedControls: (rawJson.controlMappings ?? []).map((code: string) => controlsByCode.get(code) ?? {
          code,
          title: "Reference-only control",
          category: "REFERENCE",
          packName: "Reference pack"
        }),
        ...rawJson
      };
    })
  );

  return {
    rules,
    selectedRule: selectById(rules, selectedRuleId),
    config: asRecord(workspace.metadataJson).governanceContext?.ruleEngineConfig ?? {},
    testingRuns: runs
  };
}

export async function getControlMappingsPageData(selectedMappingId?: string) {
  const workspace = await getAdminWorkspace();
  if (!workspace) {
    return { mappings: [], selectedMapping: null, availableControls: [], availableRetentionPolicies: [] };
  }

  const [ruleDefinitions, policyControls, retentionPolicies] = await Promise.all([
    prisma.ruleDefinition.findMany({
      where: { organizationId: workspace.organizationId },
      orderBy: [{ slug: "asc" }, { version: "desc" }]
    }),
    prisma.policyControl.findMany({
      where: {
        policyPack: { organizationId: workspace.organizationId }
      },
      include: { policyPack: true }
    }),
    prisma.retentionPolicy.findMany({
      where: { organizationId: workspace.organizationId },
      orderBy: { name: "asc" }
    })
  ]);

  const controlsByCode = new Map(
    policyControls.map((control) => [
      control.code,
      {
        controlCode: control.code,
        title: control.title,
        packName: control.policyPack.name,
        impactLevel: control.impactLevel,
        evidenceRequirements: asRecord(control.metadataJson).evidenceRequirements ?? [],
        reviewRequirements: asRecord(control.metadataJson).reviewRequirements ?? [],
        relatedEventTypes: asRecord(control.metadataJson).relatedEventTypes ?? []
      }
    ])
  );

  const mappingGroups = await Promise.all(
    ruleDefinitions.map(async (ruleDefinition) => {
      const rawJson = asRecord(ruleDefinition.rawJson);
      const controlMappings = Array.isArray(rawJson.controlMappings) ? rawJson.controlMappings : [];

      return Promise.all(
        controlMappings.map(async (controlCode: string) => ({
          id: `${ruleDefinition.id}__${controlCode}`,
          ruleDefinitionId: ruleDefinition.id,
          ruleId: ruleDefinition.slug,
          ruleName: ruleDefinition.name,
          eventType: rawJson.eventType,
          severityBase: rawJson.severityBase,
          caseType: rawJson.caseType ?? "RUNTIME_REVIEW",
          retentionPolicy: rawJson.retentionPolicy
            ? retentionPolicies.find((policy) => policy.name === rawJson.retentionPolicy) ?? { name: rawJson.retentionPolicy }
            : null,
          control:
            controlsByCode.get(controlCode) ?? {
              controlCode,
              title: "Reference-only control",
              packName: "Reference pack",
              impactLevel: "UNKNOWN",
              evidenceRequirements: [],
              reviewRequirements: [],
              relatedEventTypes: []
            },
          matchedFindingsCount: await prisma.finding.count({
            where: {
              ruleMatches: { some: { ruleDefinitionId: ruleDefinition.id } },
              controlMappings: { some: { policyControl: { code: controlCode } } }
            }
          }),
          incidentsCount: await prisma.incident.count({
            where: {
              finding: {
                ruleMatches: { some: { ruleDefinitionId: ruleDefinition.id } },
                controlMappings: { some: { policyControl: { code: controlCode } } }
              }
            }
          }),
          packetsCount: await prisma.auditPacket.count({
            where: {
              incident: {
                finding: {
                  ruleMatches: { some: { ruleDefinitionId: ruleDefinition.id } },
                  controlMappings: { some: { policyControl: { code: controlCode } } }
                }
              }
            }
          })
        }))
      );
    })
  );

  const mappings = mappingGroups.flat();

  return {
    mappings,
    selectedMapping: selectById(mappings, selectedMappingId),
    availableControls: policyControls.map((control) => ({
      code: control.code,
      label: `${control.code} - ${control.title}`
    })),
    availableRetentionPolicies: retentionPolicies.map((policy) => policy.name)
  };
}

export async function getAdminPageData() {
  const workspace = await getAdminWorkspace();
  const [rulesData, policyData, mappingsData, overviewData] = await Promise.all([
    getRulesPageData(),
    getPolicyPacksPageData(),
    getControlMappingsPageData(),
    getOverviewPageData()
  ]);

  return {
    stats: [
      { label: "Active Rules", value: rulesData.rules.length, href: "/rules" },
      { label: "Policy Packs", value: policyData.packs.length, href: "/policy-packs" },
      { label: "Rule-Control Mappings", value: mappingsData.mappings.length, href: "/control-mappings" },
      { label: "Material Findings", value: overviewData.kpis.find((item) => item.label === "Material Findings")?.value ?? 0, href: "/findings" },
      { label: "Open Reviews", value: overviewData.kpis.find((item) => item.label === "Open Review Cases")?.value ?? 0, href: "/reviews" },
      { label: "Audit Packets", value: overviewData.packets.length, href: "/audit-packets" },
      { label: "Workspace", value: workspace?.name ?? "No workspace", href: "/settings" }
    ],
    flow: [
      {
        title: "1. Define Rules",
        copy: "Author deterministic logic for material patterns, thresholds, case types, and downstream retention.",
        href: "/rules"
      },
      {
        title: "2. Attach Policy Context",
        copy: "Bundle controls, categories, and retention schedules inside policy packs that explain why the logic matters.",
        href: "/policy-packs"
      },
      {
        title: "3. Map Logic to Controls",
        copy: "Connect each rule to concrete controls and review consequences so matches become governed work objects.",
        href: "/control-mappings"
      },
      {
        title: "4. Operate the Workflow",
        copy: "Matched activity becomes findings, evidence, reviews, incidents, recertifications, and retention decisions.",
        href: "/findings"
      },
      {
        title: "5. Export the Record",
        copy: "Audit packets assemble the resulting evidence, approvals, incidents, and rationale into exportable output.",
        href: "/audit-packets"
      }
    ],
    highlightedRules: rulesData.rules.slice(0, 5),
    highlightedPacks: policyData.packs.slice(0, 3),
    highlightedMappings: mappingsData.mappings.slice(0, 6)
  };
}
