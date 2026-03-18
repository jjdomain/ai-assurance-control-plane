import Fastify from "fastify";
import {
  Prisma,
  PrismaClient,
  ReviewDisposition,
  ReviewStatus
} from "@prisma/client";
import { AuditEngine } from "@aiacp/audit-engine";
import { normalizeOpenClawPayload } from "@aiacp/connectors-openclaw";
import { AssuranceRepository } from "@aiacp/core-domain";
import { EvidenceEngine } from "@aiacp/evidence-engine";
import { buildPolicyCatalog } from "@aiacp/policy-packs";
import { evaluateInput, loadRuleBundle } from "@aiacp/rules-engine";
import path from "node:path";

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function buildServer(prisma = new PrismaClient()) {
  const server = Fastify({ logger: true });
  const auditEngine = new AuditEngine(prisma);
  const evidenceEngine = new EvidenceEngine(prisma);
  const repository = new AssuranceRepository(prisma);
  const ruleBundle = loadRuleBundle(path.resolve(process.cwd(), "../.."));

  server.get("/health", async () => ({
    status: "ok",
    service: "ai-assurance-api"
  }));

  server.get("/api/summary", async () => {
    const [organizations, workspaces, runs, findings, reviews, incidents] =
      await Promise.all([
        prisma.organization.count(),
        prisma.workspace.count(),
        prisma.run.count(),
        prisma.finding.count(),
        prisma.reviewCase.count(),
        prisma.incident.count()
      ]);

    return {
      organizations,
      workspaces,
      runs,
      findings,
      reviews,
      incidents
    };
  });

  server.get("/api/dashboard", async () => {
    const [findings, evidence, reviews, controls, incidents, packets, recertifications] =
      await Promise.all([
        prisma.finding.findMany(),
        prisma.evidenceRecord.findMany(),
        prisma.reviewCase.findMany(),
        prisma.policyControl.findMany(),
        prisma.incident.findMany(),
        prisma.auditPacket.findMany(),
        prisma.recertificationTask.findMany()
      ]);

    return {
      openMaterialFindings: findings.filter(
        (item) =>
          item.workflowStatus !== "CLOSED" &&
          ["MATERIAL", "URGENT"].includes(item.materialityLevel)
      ).length,
      evidenceFreshness: {
        fresh: evidence.filter((item) => item.freshnessState === "FRESH").length,
        warning: evidence.filter((item) => item.freshnessState === "WARNING").length,
        stale: evidence.filter((item) => item.freshnessState === "STALE").length,
        missing: evidence.filter((item) => item.freshnessState === "MISSING").length,
        held: evidence.filter((item) => item.freshnessState === "HELD").length
      },
      reviewsAtRisk: reviews.filter((item) => item.slaState === "AT_RISK" || item.slaState === "BREACHED").length,
      controlsAtRisk: controls.filter((item) => item.controlHealth === "AT_RISK" || item.controlHealth === "FAILING").length,
      incidentsRequiringAction: incidents.filter((item) => item.status !== "CLOSED").length,
      recertificationsDue: recertifications.filter((item) => item.status === "OPEN" || item.status === "OVERDUE").length,
      packetReadiness: packets.map((packet) => ({
        id: packet.id,
        status: packet.status,
        completenessPercent: packet.completenessPercent,
        missingEvidenceCount: packet.missingEvidenceCount,
        missingApprovalCount: packet.missingApprovalCount
      }))
    };
  });

  server.get("/api/runs/:externalRunId/evaluation", async (request, reply) => {
    const { externalRunId } = request.params as { externalRunId: string };
    const run = await prisma.run.findFirst({
      where: { externalRunId },
      include: {
        events: {
          orderBy: {
            eventTime: "asc"
          }
        }
      }
    });

    if (!run) {
      return reply.code(404).send({ error: "Run not found" });
    }

    return {
      runId: run.id,
      externalRunId: run.externalRunId,
      matches: evaluateInput(ruleBundle, { run, events: run.events })
    };
  });

  server.get("/api/runs", async () => {
    return prisma.run.findMany({
      include: {
        system: true,
        findings: true,
        evidence: true,
        events: {
          orderBy: {
            eventTime: "asc"
          }
        }
      },
      orderBy: {
        startedAt: "desc"
      }
    });
  });

  server.get("/api/findings", async () => {
    return prisma.finding.findMany({
      include: {
        run: true,
        currentIncident: true,
        primaryReviewCase: true,
        ownerUser: true,
        evidence: true,
        controlMappings: {
          include: {
            policyControl: true
          }
        },
        reviewCases: true,
        incidents: true,
        ruleMatches: true,
        retentionDecisions: {
          include: {
            retentionPolicy: true
          }
        },
        recertificationTasks: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  });

  server.get("/api/reviews", async () => {
    return prisma.reviewCase.findMany({
      include: {
        finding: {
          include: {
            run: true,
            ownerUser: true,
            evidence: true,
            controlMappings: {
              include: {
                policyControl: true
              }
            }
          }
        },
        decisions: true,
        approvalRequests: true,
        reviewerUser: true,
        approverUser: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  });

  server.get("/api/incidents", async () => {
    return prisma.incident.findMany({
      include: {
        finding: {
          include: {
            run: true,
            evidence: true,
            controlMappings: {
              include: {
                policyControl: true
              }
            }
          }
        },
        remediationTasks: true,
        auditPackets: true,
        ownerUser: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  });

  server.get("/api/audit-packets", async () => {
    return prisma.auditPacket.findMany({
      include: {
        incident: true,
        exportJobs: true,
        approvalRequests: true,
        ownerUser: true,
        reviewerUser: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  });

  server.get("/api/evidence", async () => {
    return prisma.evidenceRecord.findMany({
      include: {
        finding: {
          include: {
            ownerUser: true,
            controlMappings: {
              include: {
                policyControl: true
              }
            }
          }
        },
        legalHolds: true,
        retentionDecisions: {
          include: {
            retentionPolicy: true,
            approvedByUser: true
          }
        },
        approvedByUser: true
      },
      orderBy: { createdAt: "desc" }
    });
  });

  server.get("/api/controls", async () => {
    return prisma.policyControl.findMany({
      include: {
        policyPack: true,
        controlMappings: {
          include: {
            finding: {
              include: {
                ownerUser: true,
                evidence: true
              }
            }
          }
        },
        statusSnapshots: true,
        recertificationTasks: true
      },
      orderBy: { code: "asc" }
    });
  });

  server.get("/api/recertifications", async () => {
    return prisma.recertificationTask.findMany({
      include: {
        ownerUser: true,
        finding: true,
        policyControl: true,
        evidenceRecord: true
      },
      orderBy: { createdAt: "desc" }
    });
  });

  server.get("/api/policy-packs", async () => {
    return prisma.policyPack.findMany({
      include: {
        controls: {
          orderBy: { code: "asc" }
        },
        retentionPolicies: true
      },
      orderBy: { name: "asc" }
    });
  });

  server.get("/api/connectors", async () => {
    return prisma.connector.findMany({
      include: {
        system: true,
        connectorRuns: {
          orderBy: { ingestedAt: "desc" },
          take: 3
        }
      },
      orderBy: { createdAt: "asc" }
    });
  });

  server.get("/api/demo-scenarios", async () => {
    const runs = await prisma.run.findMany({
      include: {
        system: true,
        findings: true
      },
      orderBy: { startedAt: "desc" }
    });

    return runs.map((run) => {
      const metadata = (run.metadataJson ?? {}) as Record<string, unknown>;
      return {
        runId: run.id,
        externalRunId: run.externalRunId,
        title: metadata.label ?? run.externalRunId,
        summary: metadata.summary ?? "Seeded assurance workflow scenario.",
        scenarioId: metadata.scenarioId ?? run.externalRunId,
        systemName: run.system?.name ?? "Unassigned system",
        findingCount: run.findings.length,
        environment: run.environment
      };
    });
  });

  server.get("/api/settings", async () => {
    return prisma.workspace.findMany({
      include: {
        organization: true
      }
    });
  });

  server.post("/api/connectors", async (request) => {
    const body = request.body as {
      organizationSlug?: string;
      workspaceSlug?: string;
      systemSlug?: string;
      name: string;
      type: string;
      config?: Record<string, unknown>;
    };

    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        slug: body.organizationSlug ?? "demo-org"
      }
    });

    const workspace = await prisma.workspace.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        slug: body.workspaceSlug ?? "openclaw-oversight-demo"
      }
    });

    const system = body.systemSlug
      ? await prisma.system.findFirst({
          where: {
            workspaceId: workspace.id,
            slug: body.systemSlug
          }
        })
      : null;

    const connector = await prisma.connector.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        systemId: system?.id ?? null,
        name: body.name,
        connectorType: body.type,
        status: "ACTIVE",
        configJson: asJson(body.config ?? {})
      }
    });

    return { connector };
  });

  server.post("/api/ingest/openclaw", async (request, reply) => {
    const body = request.body as {
      connectorType?: string;
      tenantSlug?: string;
      projectSlug?: string;
      systemSlug?: string;
      run?: Record<string, unknown>;
      spans?: Array<Record<string, unknown>>;
      connectorName?: string;
    };

    if (!body.run || !Array.isArray(body.spans)) {
      return reply.code(400).send({ error: "run and spans are required" });
    }

    const organization = await prisma.organization.findFirstOrThrow({
      where: {
        slug: body.tenantSlug ?? "demo-org"
      }
    });

    const workspace = await prisma.workspace.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        slug: body.projectSlug ?? "openclaw-oversight-demo"
      }
    });

    const system = await prisma.system.findFirstOrThrow({
      where: {
        workspaceId: workspace.id,
        slug: body.systemSlug ?? "openclaw-control-ui-agent"
      }
    });

    const connector =
      (await prisma.connector.findFirst({
        where: {
          workspaceId: workspace.id,
          connectorType: body.connectorType ?? "OPENCLAW_OPIK"
        }
      })) ??
      (await prisma.connector.create({
        data: {
          organizationId: organization.id,
          workspaceId: workspace.id,
          systemId: system.id,
          connectorType: body.connectorType ?? "OPENCLAW_OPIK",
          name: body.connectorName ?? "OpenClaw via Opik",
          status: "ACTIVE",
          configJson: asJson({ source: "api-ingest" })
        }
      }));

    const normalized = normalizeOpenClawPayload({
      sourcePlatform: "OPENCLAW",
      externalRunId: String((body.run as { externalRunId?: string }).externalRunId),
      sessionId: (body.run as { sessionId?: string }).sessionId,
      agentSystem: {
        name: system.name,
        platform: "OPENCLAW",
        environment: String((body.run as { environment?: string }).environment ?? workspace.environment)
      },
      run: {
        ...(body.run as Record<string, unknown>),
        actorType: String((body.run as { rootActorType?: string }).rootActorType ?? "AGENT"),
        metrics: (body.run as { metrics?: Record<string, unknown> }).metrics ?? {}
      } as {
        status: string;
        startedAt: string;
        endedAt?: string;
        actorType?: string;
        actorId?: string;
        promptVersionId?: string;
        modelProvider?: string;
        modelName?: string;
        metrics?: Record<string, unknown>;
        [key: string]: unknown;
      },
      spans: body.spans as Array<{
        externalSpanId: string;
        parentExternalSpanId?: string | null;
        spanType?: string;
        type?: string;
        name: string;
        startedAt: string;
        endedAt?: string;
        success?: boolean;
        status?: string;
        attributes?: Record<string, unknown>;
      }>
    });

    const connectorRun = await prisma.connectorRun.create({
      data: {
        organizationId: organization.id,
        workspaceId: workspace.id,
        connectorId: connector.id,
        sourceRunKey: normalized.externalRunId,
        ingestStatus: "NORMALIZED",
        rawPayloadJson: asJson(body as Record<string, unknown>)
      }
    });

    const run = await repository.ingestCanonicalRun({
      organizationId: organization.id,
      workspaceId: workspace.id,
      systemId: system.id,
      connectorId: connector.id,
      connectorRunId: connectorRun.id,
      run: normalized
    });

    const policyCatalog = await buildPolicyCatalog(prisma, organization.id);
    const matches = evaluateInput(ruleBundle, {
      run,
      events: run.events
    });

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
          ingestPayload: body as Record<string, unknown>,
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

    return {
      runId: run.id,
      externalRunId: run.externalRunId,
      findingsCreated: matches.length
    };
  });

  server.post("/api/legal-holds", async (request, reply) => {
    const body = request.body as { evidenceRecordId?: string; reason?: string };
    if (!body.evidenceRecordId || !body.reason) {
      return reply.code(400).send({ error: "evidenceRecordId and reason are required" });
    }

    const evidence = await prisma.evidenceRecord.findUnique({
      where: { id: body.evidenceRecordId },
      include: {
        finding: true
      }
    });

    if (!evidence || !evidence.finding) {
      return reply.code(404).send({ error: "Evidence record not found" });
    }

    const hold = await prisma.legalHold.create({
      data: {
        organizationId: evidence.finding.organizationId,
        workspaceId: evidence.finding.workspaceId,
        evidenceRecordId: evidence.id,
        holdReason: body.reason,
        status: "ACTIVE"
      }
    });

    return { hold };
  });

  server.post("/api/reviews/:reviewCaseId/decisions", async (request, reply) => {
    const { reviewCaseId } = request.params as { reviewCaseId: string };
    const body = request.body as {
      disposition?: keyof typeof ReviewDisposition;
      rationale?: string;
    };

    const review = await prisma.reviewCase.findUnique({
      where: {
        id: reviewCaseId
      }
    });

    if (!review || !body.disposition || !body.rationale) {
      return reply.code(400).send({ error: "Valid review case, disposition, and rationale are required" });
    }

    const decision = await prisma.reviewDecision.create({
      data: {
        reviewCaseId,
        statusBefore: review.status,
        statusAfter: ReviewStatus.CLOSED,
        disposition: ReviewDisposition[body.disposition],
        rationale: body.rationale
      }
    });

    await prisma.reviewCase.update({
      where: {
        id: reviewCaseId
      },
      data: {
        status: ReviewStatus.CLOSED
      }
    });

    return { decision };
  });

  server.post("/api/audit-packets/incidents/:incidentId", async (request, reply) => {
    const { incidentId } = request.params as { incidentId: string };
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });

    if (!incident) {
      return reply.code(404).send({ error: "Incident not found" });
    }

    const packet = await auditEngine.createIncidentPacket(incidentId);
    return { packet };
  });

  server.get("/api/audit-packets/:packetId", async (request, reply) => {
    const { packetId } = request.params as { packetId: string };
    const packet = await prisma.auditPacket.findUnique({
      where: { id: packetId }
    });

    if (!packet) {
      return reply.code(404).send({ error: "Audit packet not found" });
    }

    return { packet };
  });

  return server;
}
