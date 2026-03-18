import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { AuditEngine } from "@aiacp/audit-engine";
import { normalizeOpenClawRun } from "@aiacp/connectors-openclaw";
import { AssuranceRepository } from "@aiacp/core-domain";
import { EvidenceEngine } from "@aiacp/evidence-engine";
import {
  buildPolicyCatalog,
  loadPolicyFixtures
} from "@aiacp/policy-packs";
import { evaluateInput, loadRuleBundle } from "@aiacp/rules-engine";
import yaml from "yaml";

const prisma = new PrismaClient();
const rootDir = process.cwd();

function loadFixtureFile<T>(relativePath: string): T {
  const absolutePath = path.join(rootDir, relativePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  if (relativePath.endsWith(".json")) {
    return JSON.parse(raw) as T;
  }

  return yaml.parse(raw) as T;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferSystemSlugFromRun(fixture: any) {
  const agentName = String(fixture?.ingestPayload?.agentSystem?.name ?? "");
  const scenarioId = String(fixture?.ingestPayload?.scenarioId ?? fixture?.scenarioId ?? "");
  const normalized = slugify(agentName);

  if (normalized.includes("research")) {
    return "research-agent-external-tools";
  }
  if (normalized.includes("legal") || normalized.includes("contract")) {
    return "contract-review-agent";
  }
  if (normalized.includes("support") || normalized.includes("memory")) {
    return "customer-support-agent-memory";
  }
  if (normalized.includes("orchestr")) {
    return "multi-agent-orchestrator";
  }
  if (normalized.includes("deal") || normalized.includes("outbound")) {
    return "outbound-action-agent";
  }
  if (scenarioId.includes("delegation")) {
    return "multi-agent-orchestrator";
  }

  return "internal-coding-ops-assistant";
}

async function resetDatabase() {
  await prisma.attachment.deleteMany();
  await prisma.controlStatusSnapshot.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.recertificationTask.deleteMany();
  await prisma.exportJob.deleteMany();
  await prisma.auditPacket.deleteMany();
  await prisma.legalHold.deleteMany();
  await prisma.retentionDecision.deleteMany();
  await prisma.remediationTask.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.reviewDecision.deleteMany();
  await prisma.reviewCase.deleteMany();
  await prisma.evidenceRecord.deleteMany();
  await prisma.controlMapping.deleteMany();
  await prisma.findingRuleMatch.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.event.deleteMany();
  await prisma.run.deleteMany();
  await prisma.connectorRun.deleteMany();
  await prisma.connector.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.retentionPolicy.deleteMany();
  await prisma.policyControl.deleteMany();
  await prisma.policyPack.deleteMany();
  await prisma.ruleDefinition.deleteMany();
  await prisma.system.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.organization.deleteMany();
}

async function loadPolicyFixturesForOrganization(organizationId: string) {
  const policyFixtures = loadPolicyFixtures(rootDir);

  for (const pack of policyFixtures) {
    const policyPack = await prisma.policyPack.create({
      data: {
        organizationId,
        slug: pack.slug,
        name: pack.name,
        version: String(pack.version),
        sourceType: String(pack.sourceType ?? "SYSTEM"),
        isActive: Boolean(pack.isActive),
        rawJson: pack
      }
    });

    for (const retentionPolicy of pack.retentionPolicies ?? []) {
      await prisma.retentionPolicy.create({
        data: {
          organizationId,
          policyPackId: policyPack.id,
          name: String(retentionPolicy.name),
          scope: String(retentionPolicy.scope),
          retentionClass: String(retentionPolicy.retentionClass),
          retentionDays:
            retentionPolicy.retentionDays == null ? null : Number(retentionPolicy.retentionDays),
          legalHoldAllowed: Boolean(retentionPolicy.legalHoldAllowed),
          deleteMode: String(retentionPolicy.deleteMode),
          triggerSummary: String(retentionPolicy.triggerSummary ?? "")
        }
      });
    }

    for (const control of pack.controls ?? []) {
      await prisma.policyControl.create({
        data: {
          policyPackId: policyPack.id,
          code: String(control.controlCode),
          categoryCode: String(control.category ?? ""),
          title: String(control.title),
          impactLevel: String(control.impactLevel ?? ""),
          description: String(control.description ?? ""),
          metadataJson: control,
          reviewCadence: "Quarterly",
          evidenceFreshnessRequirement: "No older than 7 days",
          requiresHumanApproval: String(control.category ?? "").toUpperCase().includes("HUMAN"),
          requiredEvidenceTypesJson: [String(control.controlCode), "RUN_SNAPSHOT"],
          riskCategory: "AUDITABILITY"
        }
      });
    }
  }
}

async function loadRuleDefinitions(organizationId: string) {
  const ruleBundle = loadRuleBundle(rootDir);

  for (const rule of ruleBundle.rules) {
    await prisma.ruleDefinition.create({
      data: {
        organizationId,
        slug: rule.id,
        name: rule.name,
        version: "1.0.0",
        isActive: true,
        sourceType: "OPENCLAW_OPIK",
        rawJson: rule
      }
    });
  }

  return ruleBundle;
}

async function main() {
  const repository = new AssuranceRepository(prisma);
  const evidenceEngine = new EvidenceEngine(prisma);
  const auditEngine = new AuditEngine(prisma);
  const demoRuns = JSON.parse(
    fs.readFileSync(path.join(rootDir, "seed_demo_runs.json"), "utf8")
  ) as { runs: Array<any> };
  const systemInventory = loadFixtureFile<Array<Record<string, unknown>>>(
    "seed/fixtures/seed_system_inventory.yaml"
  );
  const riskClassifications = loadFixtureFile<{ risk_tiers: Array<Record<string, unknown>> }>(
    "seed/fixtures/seed_risk_classifications.yaml"
  );
  const reviewTemplates = loadFixtureFile<Array<Record<string, unknown>>>(
    "seed/fixtures/seed_review_templates.yaml"
  );
  const incidentPlaybooks = loadFixtureFile<Array<Record<string, unknown>>>(
    "seed/fixtures/seed_incident_playbooks.yaml"
  );
  const auditPacketPresets = loadFixtureFile<Array<Record<string, unknown>>>(
    "seed/fixtures/seed_audit_packet_presets.yaml"
  );
  const governanceNotes = loadFixtureFile<Array<Record<string, unknown>>>(
    "seed/fixtures/seed_governance_notes.json"
  );

  await resetDatabase();

  const organization = await prisma.organization.create({
    data: {
      slug: "demo-org",
      name: "Demo Org"
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      organizationId: organization.id,
      slug: "openclaw-oversight-demo",
      name: "OpenClaw Oversight Demo",
      environment: "PROD",
      metadataJson: {
        profile: "OPENCLAW_V1",
        governanceContext: {
          riskTiers: riskClassifications.risk_tiers,
          reviewTemplates: reviewTemplates.map((item) => item.key),
          incidentPlaybooks: incidentPlaybooks.map((item) => item.key),
          auditPacketPresets: auditPacketPresets.map((item) => item.key)
        }
      }
    }
  });

  const seededSystems = new Map<string, { id: string; name: string }>();
  for (const systemFixture of systemInventory) {
    const createdSystem = await prisma.system.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        slug: String(systemFixture.slug),
        name: String(systemFixture.name),
        systemType: "AGENT",
        criticalityTier:
          String(systemFixture.risk_tier) === "high"
            ? 5
            : String(systemFixture.risk_tier) === "elevated"
              ? 4
              : 2,
        metadataJson: systemFixture
      }
    });

    seededSystems.set(String(systemFixture.slug), {
      id: createdSystem.id,
      name: createdSystem.name
    });
  }

  const connector = await prisma.connector.create({
    data: {
      organizationId: organization.id,
      workspaceId: workspace.id,
      systemId: null,
      connectorType: "OPENCLAW_OPIK",
      name: "OpenClaw via Opik",
      status: "ACTIVE",
      configJson: {
        source: "seed-demo",
        seededInventoryCount: systemInventory.length
      }
    }
  });

  const users = [
    { email: "admin@example.com", displayName: "Alex Admin", roleCode: "ORG_ADMIN" },
    { email: "sec@example.com", displayName: "Sam Security", roleCode: "SECURITY_REVIEWER" },
    { email: "gov@example.com", displayName: "Gina Governance", roleCode: "GOVERNANCE_REVIEWER" },
    { email: "legal@example.com", displayName: "Lee Legal", roleCode: "LEGAL_REVIEWER" }
  ];

  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: userData.email,
        displayName: userData.displayName
      }
    });

    await prisma.membership.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        userId: user.id,
        roleCode: userData.roleCode
      }
    });
  }

  await loadPolicyFixturesForOrganization(organization.id);
  const ruleBundle = await loadRuleDefinitions(organization.id);
  const policyCatalog = await buildPolicyCatalog(prisma, organization.id);

  for (const fixture of demoRuns.runs ?? []) {
    const normalizedRun = normalizeOpenClawRun(fixture);
    const systemSlug = inferSystemSlugFromRun(fixture);
    const mappedSystem = seededSystems.get(systemSlug) ?? Array.from(seededSystems.values())[0];
    const connectorRun = await prisma.connectorRun.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        connectorId: connector.id,
        sourceRunKey: normalizedRun.externalRunId,
        ingestStatus: "NORMALIZED",
        rawPayloadJson: fixture.ingestPayload
      }
    });

    await repository.ingestCanonicalRun({
      organizationId: organization.id,
      workspaceId: workspace.id,
      systemId: mappedSystem.id,
      connectorId: connector.id,
      connectorRunId: connectorRun.id,
      run: normalizedRun
    });
  }

  const seededRuns = await prisma.run.findMany({
    include: {
      events: {
        orderBy: {
          eventTime: "asc"
        }
      }
    },
    orderBy: {
      startedAt: "asc"
    }
  });

  for (const run of seededRuns) {
    const matches = evaluateInput(ruleBundle, {
      run,
      events: run.events
    });

    const scenario = demoRuns.runs.find(
      (item) => item.ingestPayload.externalRunId === run.externalRunId
    );

    for (const match of matches) {
      const rule = await prisma.ruleDefinition.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          slug: match.ruleId
        }
      });

      const retentionPolicy = match.retentionPolicy
        ? policyCatalog.retentionPoliciesByName.get(match.retentionPolicy)
        : null;

      const graph = await repository.createFindingGraph({
        organizationId: organization.id,
        workspaceId: workspace.id,
        runId: run.id,
        primaryEventId: match.primaryEventId ?? undefined,
        ruleId: rule.id,
        title: match.title,
        summary: match.summary,
        eventType: match.eventType,
        severity: match.severity,
        materialityLevel: match.materialityLevel,
        materialityScore: match.materialityScore,
        evidenceScore: match.evidenceScore,
        confidenceScore: match.confidenceScore,
        controlCodes: match.controlMappings.filter((code) =>
          policyCatalog.controlsByCode.has(code)
        ),
        retentionPolicyId: retentionPolicy?.id,
        reviewRequired: match.reviewRequired,
        reviewDueHours: match.reviewDueHours,
        reviewType: match.caseType ?? "RUNTIME_REVIEW",
        controlHealthImpact: match.controlHealthImpact as never,
        approvalRequired: match.approvalRequired,
        recertificationRequired: Boolean(match.recertificationTrigger),
        recertificationReason: match.recertificationTrigger,
        sourceRiskClass: match.sourceRiskClass,
        incidentRequired: match.incidentRequired,
        evidenceSnapshot: evidenceEngine.buildSnapshot({
          ingestPayload: scenario?.ingestPayload ?? {},
          match
        }),
        recommendedActions: match.recommendedActions,
        explainability: match.explainability
      });

      await evidenceEngine.applyPostFindingWorkflow({
        findingId: graph.findingId,
        evidenceId: graph.evidenceId,
        retentionPolicyId: retentionPolicy?.id,
        match
      });
    }
  }

  const incidents = await prisma.incident.findMany();
  for (const incident of incidents) {
    await auditEngine.createIncidentPacket(incident.id);
  }

  const [admin, security, governance, legal] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: "admin@example.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "sec@example.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "gov@example.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "legal@example.com" } })
  ]);

  const findings = await prisma.finding.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      evidence: true,
      reviewCases: true,
      incidents: true,
      controlMappings: { include: { policyControl: true } }
    }
  });

  const controls = await prisma.policyControl.findMany({
    include: { controlMappings: true },
    orderBy: { code: "asc" }
  });

  if (findings[0]) {
    await prisma.finding.update({
      where: { id: findings[0].id },
      data: {
        ownerUserId: security.id,
        materialityLevel: "URGENT",
        workflowState: "NEEDS_APPROVAL",
        reviewDueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
        controlHealthImpact: "AT_RISK",
        sourceRiskClass: "EXTERNAL_ACTIONS"
      }
    });

    if (findings[0].evidence[0]) {
      await prisma.evidenceRecord.update({
        where: { id: findings[0].evidence[0].id },
        data: {
          approvedForAudit: true,
          approvedByUserId: governance.id,
          approvedAt: new Date(),
          reviewComments: "Fresh snapshot approved for audit use.",
          requiredByControlCount: findings[0].controlMappings.length,
          freshnessState: "FRESH"
        }
      });
    }

    if (findings[0].reviewCases[0]) {
      await prisma.reviewCase.update({
        where: { id: findings[0].reviewCases[0].id },
        data: {
          workflowStatus: "PENDING_APPROVER",
          reviewerUserId: governance.id,
          approverUserId: admin.id,
          requiresSecondApprover: true,
          dueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
          slaState: "AT_RISK",
          summary: "Structured from the seeded approval bypass review template.",
          requiredEvidenceChecklistJson: [
            { label: "Locked snapshot", status: "complete" },
            { label: "Approver signoff", status: "pending" },
            { label: "Business impact summary", status: "complete" }
          ],
          decisionSummary: `${String(reviewTemplates[2]?.title ?? "Approval Bypass Review")} is waiting on second approver signoff.`
        }
      });
    }
  }

  if (findings[1]) {
    await prisma.finding.update({
      where: { id: findings[1].id },
      data: {
        ownerUserId: governance.id,
        workflowStatus: "ACCEPTED_RISK",
        workflowState: "ACCEPTED_RISK_ACTIVE",
        acceptedRiskUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        acceptedRiskRationale: "Business continuity risk accepted pending connector hardening.",
        materialityLevel: "MATERIAL"
      }
    });

    if (findings[1].reviewCases[0]) {
      await prisma.reviewCase.update({
        where: { id: findings[1].reviewCases[0].id },
        data: {
          workflowStatus: "DECIDED",
          decisionType: "ACCEPT_RISK",
          decisionRationale: "Short-term exception approved with expiry.",
          decisionSummary: "Accepted risk expires within seven days.",
          acceptedRiskUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          approverUserId: admin.id,
          reviewerUserId: governance.id
        }
      });
    }
  }

  if (findings[2]?.evidence[0]) {
    await prisma.evidenceRecord.update({
      where: { id: findings[2].evidence[0].id },
      data: {
        freshnessState: "STALE",
        staleAfterAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        reviewComments: "Stale evidence is blocking current packet readiness."
      }
    });
  }

  const packetToBlock = await prisma.auditPacket.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (packetToBlock) {
    await prisma.auditPacket.update({
      where: { id: packetToBlock.id },
      data: {
        status: "BLOCKED",
        completenessPercent: 62,
        missingEvidenceCount: 1,
        missingApprovalCount: 1
      }
    });
  }

  if (controls[0]) {
    await prisma.policyControl.update({
      where: { id: controls[0].id },
      data: {
        controlHealth: "AT_RISK",
        lastAttestedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        nextReviewDueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        riskCategory: "EXTERNAL_ACTIONS"
      }
    });

    await prisma.controlStatusSnapshot.create({
      data: {
        policyControlId: controls[0].id,
        controlHealth: "AT_RISK",
        freshnessState: "STALE",
        openFindings: controls[0].controlMappings.length || 1,
        notes: "Open findings plus stale evidence are keeping this control at risk."
      }
    });
  }

  if (controls[1]) {
    await prisma.policyControl.update({
      where: { id: controls[1].id },
      data: {
        controlHealth: "HEALTHY",
        lastAttestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        nextReviewDueAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        riskCategory: "AUDITABILITY"
      }
    });
  }

  if (findings[3]) {
    await prisma.recertificationTask.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        findingId: findings[3].id,
        policyControlId: findings[3].controlMappings[0]?.policyControlId ?? null,
        evidenceRecordId: findings[3].evidence[0]?.id ?? null,
        ownerUserId: governance.id,
        status: "OPEN",
        triggerType: "MODEL_CHANGE",
        triggerRefType: "RUN",
        triggerRefId: findings[3].runId,
        title: "Model version change requires recertification",
        reason: "A model update changed the assurance assumptions for this control set.",
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      }
    });

    await prisma.finding.update({
      where: { id: findings[3].id },
      data: {
        recertificationRequired: true,
        recertificationReason: "MODEL_CHANGE",
        workflowState: "RECERTIFICATION_OPEN"
      }
    });
  }

  const evidenceForHold = findings.find((finding) => finding.evidence[0])?.evidence[0];
  if (evidenceForHold) {
    await prisma.evidenceRecord.update({
      where: { id: evidenceForHold.id },
      data: {
        legalHoldActive: true,
        retentionState: "HELD",
        freshnessState: "HELD",
        approvedForAudit: true,
        approvedByUserId: legal.id,
        approvedAt: new Date(),
        redactionState: "REDACTED",
        sensitivityClass: "RESTRICTED"
      }
    });

    await prisma.legalHold.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        evidenceRecordId: evidenceForHold.id,
        holdReason: "Legal hold applied for packet and incident preservation.",
        status: "ACTIVE"
      }
    }).catch(() => undefined);
  }

  const incidentsWithContext = await prisma.incident.findMany({
    include: {
      finding: {
        include: {
          run: {
            include: {
              system: true
            }
          }
        }
      }
    }
  });

  for (const incident of incidentsWithContext) {
    const playbook =
      incident.severity === "CRITICAL" || incident.severity === "HIGH"
        ? incidentPlaybooks.find((item) => item.key === "unsafe_external_action_playbook")
        : incidentPlaybooks.find((item) => item.key === "approval_checkpoint_failure_playbook");

    await prisma.incident.update({
      where: { id: incident.id },
      data: {
        controlImpactSummary:
          `${incident.finding?.run.system?.name ?? "Seeded AI system"} is using the ${String(playbook?.title ?? "incident")} playbook.`,
        needsPostIncidentPacket: true
      }
    });

    await prisma.timelineEvent.createMany({
      data: (Array.isArray(playbook?.required_timeline_events) ? playbook.required_timeline_events : []).map(
        (eventType) => ({
          incidentId: incident.id,
          eventType: String(eventType).toUpperCase(),
          body: `${String(playbook?.title ?? "Incident playbook")} step recorded for seeded demo flow.`
        })
      )
    });
  }

  const reviewCases = await prisma.reviewCase.findMany({
    include: {
      finding: {
        include: {
          run: {
            include: {
              system: true
            }
          }
        }
      }
    }
  });

  for (const reviewCase of reviewCases) {
    const template =
      reviewCase.finding?.sourceRiskClass === "DATA_RETENTION"
        ? reviewTemplates.find((item) => item.key === "reviewer_privacy_retention_decision")
        : reviewTemplates.find((item) => item.key === "reviewer_material_finding_default");

    await prisma.reviewCase.update({
      where: { id: reviewCase.id },
      data: {
        summary:
          reviewCase.summary ??
          `${String(template?.title ?? "Review template")} for ${reviewCase.finding?.run.system?.name ?? "seeded system"}.`,
        requiredEvidenceChecklistJson:
          reviewCase.requiredEvidenceChecklistJson ??
          (Array.isArray(template?.required_inputs)
            ? template.required_inputs.map((item) => ({
                label: String(item).replaceAll("_", " "),
                status: "pending"
              }))
            : [])
      }
    });
  }

  const packets = await prisma.auditPacket.findMany({
    include: {
      incident: {
        include: {
          finding: {
            include: {
              run: {
                include: {
                  system: true
                }
              }
            }
          }
        }
      }
    }
  });

  for (const packet of packets) {
    const preset =
      packet.status === "BLOCKED"
        ? auditPacketPresets.find((item) => item.key === "post_incident_internal_review")
        : auditPacketPresets.find((item) => item.key === "internal_assurance_review");

    await prisma.auditPacket.update({
      where: { id: packet.id },
      data: {
        title:
          packet.title ??
          `${String(preset?.title ?? "Audit packet")} for ${packet.incident?.finding?.run.system?.name ?? "seeded system"}`,
        description:
          packet.description ??
          `Preset ${String(preset?.key ?? "internal_assurance_review")} bundles evidence, approvals, and control mappings.`
      }
    });

    await prisma.exportJob.updateMany({
      where: { auditPacketId: packet.id },
      data: {
        outputRef: `seed://${String(preset?.key ?? "internal_assurance_review")}/${packet.packetKey}.json`
      }
    });
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      metadataJson: {
        profile: "OPENCLAW_V1",
        governanceContext: {
          riskTiers: riskClassifications.risk_tiers,
          reviewTemplates,
          incidentPlaybooks,
          auditPacketPresets,
          governanceNotes
        }
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
