import {
  ApprovalStatus,
  ApprovalType,
  AuditPacketStatus,
  ControlHealth,
  EvidenceFreshnessState,
  FindingStatus,
  MaterialityLevel,
  MappingSource,
  Prisma,
  PrismaClient,
  ReviewCaseStatus,
  ReviewDecisionType,
  ReviewDisposition,
  ReviewStatus,
  SlaState,
  WorkflowState
} from "@prisma/client";
import type { CanonicalRunInput } from "@aiacp/shared-types";

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class AssuranceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ingestCanonicalRun(params: {
    organizationId: string;
    workspaceId: string;
    systemId: string;
    connectorId: string;
    connectorRunId: string;
    run: CanonicalRunInput;
  }) {
    return this.prisma.run.create({
      data: {
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        systemId: params.systemId,
        connectorId: params.connectorId,
        connectorRunId: params.connectorRunId,
        sourcePlatform: params.run.sourcePlatform,
        externalRunId: params.run.externalRunId,
        sessionId: params.run.sessionId,
        environment: params.run.environment,
        status: params.run.status,
        actorType: params.run.actorType,
        actorId: params.run.actorId,
        modelRef: params.run.modelRef,
        promptVersionRef: params.run.promptVersionRef,
        startedAt: new Date(params.run.startedAt),
        endedAt: params.run.endedAt ? new Date(params.run.endedAt) : null,
        metricsJson: asJson(params.run.metrics),
        metadataJson: asJson(params.run.metadata),
        events: {
          createMany: {
            data: params.run.events.map((event) => ({
              organizationId: params.organizationId,
              externalEventId: event.externalEventId,
              eventType: event.eventType,
              eventTime: new Date(event.eventTime),
              actorType: event.actorType,
              targetRef: event.targetRef,
              status: event.status,
              attributesJson: asJson(event.attributes),
              normalizedPayloadJson: asJson(event.attributes)
            }))
          }
        }
      },
      include: {
        events: true
      }
    });
  }

  async createFindingGraph(params: {
    organizationId: string;
    workspaceId: string;
    runId: string;
    ruleId: string;
    title: string;
    summary: string;
    eventType: string;
    severity: string;
    materialityLevel: MaterialityLevel;
    materialityScore: number;
    evidenceScore: number;
    confidenceScore: number;
    controlCodes: string[];
    retentionPolicyId?: string;
    reviewRequired: boolean;
    reviewDueHours?: number | null;
    reviewType?: string;
    controlHealthImpact?: ControlHealth;
    approvalRequired?: boolean;
    recertificationRequired?: boolean;
    recertificationReason?: string | null;
    sourceRiskClass?: Prisma.InputJsonValue | string | null;
    incidentRequired: boolean;
    primaryEventId?: string;
    evidenceSnapshot: Record<string, unknown>;
    recommendedActions?: Array<Record<string, unknown>>;
    explainability?: Record<string, unknown>;
  }) {
    const finding = await this.prisma.finding.create({
      data: {
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        runId: params.runId,
        primaryEventId: params.primaryEventId ?? null,
        title: params.title,
        summary: params.summary,
        eventType: params.eventType,
        severity: params.severity,
        status: "OPEN",
        workflowStatus: FindingStatus.OPEN,
        materialityLevel: params.materialityLevel,
        workflowState: params.reviewRequired ? WorkflowState.NEEDS_REVIEW : WorkflowState.TRIAGE,
        reviewRequired: params.reviewRequired,
        reviewDueAt:
          params.reviewDueHours == null
            ? null
            : new Date(Date.now() + params.reviewDueHours * 60 * 60 * 1000),
        evidenceFreshnessState: EvidenceFreshnessState.FRESH,
        controlHealthImpact: params.controlHealthImpact ?? ControlHealth.UNKNOWN,
        incidentSuggested: params.incidentRequired,
        incidentCreated: params.incidentRequired,
        recertificationRequired: Boolean(params.recertificationRequired),
        recertificationReason: params.recertificationReason ?? null,
        sourceRiskClass:
          typeof params.sourceRiskClass === "string"
            ? (params.sourceRiskClass as never)
            : undefined,
        lastEvaluatedAt: new Date(),
        materialityScore: params.materialityScore,
        evidenceScore: params.evidenceScore,
        confidenceScore: params.confidenceScore,
        recommendedActionsJson: (
          params.recommendedActions ??
          params.controlCodes.map((code) => ({
            type: "CONTROL_REVIEW",
            code
          }))
        ) as Prisma.InputJsonValue
      }
    });

    await this.prisma.findingRuleMatch.create({
      data: {
        findingId: finding.id,
        ruleDefinitionId: params.ruleId,
        explainabilityJson: (
          params.explainability ?? {
            source: "seeded-expected-finding",
            controlCodes: params.controlCodes
          }
        ) as Prisma.InputJsonValue,
        matchedAt: new Date()
      }
    });

    if (params.controlCodes.length > 0) {
      const controls = await this.prisma.policyControl.findMany({
        where: {
          code: {
            in: params.controlCodes
          }
        }
      });

      await this.prisma.controlMapping.createMany({
        data: controls.map((control) => ({
          findingId: finding.id,
          policyControlId: control.id,
          mappingSource: MappingSource.FIXTURE
        }))
      });
    }

    const evidence = await this.prisma.evidenceRecord.create({
      data: {
        organizationId: params.organizationId,
        workspaceId: params.workspaceId,
        runId: params.runId,
        findingId: finding.id,
        evidenceType: "RUN_SNAPSHOT",
        status: "ACTIVE",
        storageRef: `seed://${params.runId}/${finding.id}`,
        hash: `${params.runId}:${finding.id}`,
        contentPreview: params.summary,
        title: `${params.title} evidence snapshot`,
        summary: params.summary,
        freshnessState: EvidenceFreshnessState.FRESH,
        capturedAt: new Date(),
        staleAfterAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        collectionMethod: "DERIVED_SNAPSHOT",
        sourceTimeWindowStart: new Date(Date.now() - 60 * 60 * 1000),
        sourceTimeWindowEnd: new Date(),
        chainOfCustodyJson: {
          source: "seed",
          generatedAt: new Date().toISOString()
        } as Prisma.InputJsonValue,
        snapshotJson: asJson(params.evidenceSnapshot)
      }
    });

    let reviewCaseId: string | null = null;
    if (params.reviewRequired) {
      const review = await this.prisma.reviewCase.create({
        data: {
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          findingId: finding.id,
          reviewType: params.reviewType ?? "RUNTIME_REVIEW",
          status: "OPEN",
          workflowStatus: ReviewCaseStatus.OPEN,
          assignedTeam: "AI Governance",
          retentionPolicyId: params.retentionPolicyId ?? null,
          title: params.title,
          summary: params.summary,
          reviewerUserId:
            (
              await this.prisma.user.findFirst({
                where: { organizationId: params.organizationId, email: "gov@example.com" },
                select: { id: true }
              })
            )?.id ?? null,
          dueAt:
            params.reviewDueHours == null
              ? null
              : new Date(Date.now() + params.reviewDueHours * 60 * 60 * 1000),
          slaState:
            (params.reviewDueHours ?? 999) <= 24 ? SlaState.AT_RISK : SlaState.ON_TRACK,
          decisionSummary: "Seeded case opened from rules evaluation."
        }
      });

      reviewCaseId = review.id;

      await this.prisma.finding.update({
        where: { id: finding.id },
        data: {
          primaryReviewCaseId: review.id
        }
      });

      await this.prisma.reviewDecision.create({
        data: {
          reviewCaseId: review.id,
          statusBefore: ReviewStatus.OPEN,
          statusAfter: ReviewStatus.IN_REVIEW,
          disposition: ReviewDisposition.NEEDS_MORE_EVIDENCE,
          decisionType: ReviewDecisionType.REQUEST_MORE_EVIDENCE,
          rationale: "Seeded review case created from expected demo finding."
        }
      });

      if (params.approvalRequired) {
        const approverId =
          (
            await this.prisma.user.findFirst({
              where: { organizationId: params.organizationId, email: "admin@example.com" },
              select: { id: true }
            })
          )?.id ?? null;

        await this.prisma.approvalRequest.create({
          data: {
            organizationId: params.organizationId,
            workspaceId: params.workspaceId,
            reviewCaseId: review.id,
            findingId: finding.id,
            subjectType: "REVIEW_CASE",
            subjectId: review.id,
            approvalType: ApprovalType.REVIEW_DECISION,
            status: ApprovalStatus.OPEN,
            requestedFromUserId: approverId,
            dueAt:
              params.reviewDueHours == null
                ? null
                : new Date(Date.now() + params.reviewDueHours * 60 * 60 * 1000)
          }
        });
      }
    }

    let incidentId: string | null = null;
    if (params.incidentRequired) {
      const incident = await this.prisma.incident.create({
        data: {
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          findingId: finding.id,
          reviewCaseId,
          title: params.title,
          summary: params.summary,
          status: "OPEN",
          severity: params.severity,
          sourceFindingCount: 1,
          controlImpactSummary: "Inherited from finding control mappings.",
          remediationSlaAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        }
      });

      incidentId = incident.id;

      await this.prisma.finding.update({
        where: { id: finding.id },
        data: {
          currentIncidentId: incident.id,
          workflowState: WorkflowState.INCIDENT_OPEN
        }
      });

      await this.prisma.remediationTask.create({
        data: {
          incidentId: incident.id,
          title: `Review remediation for ${params.eventType}`,
          status: "OPEN",
          ownerTeam: "AI Security",
          dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        }
      });
    }

    if (params.retentionPolicyId) {
      await this.prisma.retentionDecision.create({
        data: {
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          findingId: finding.id,
          evidenceRecordId: evidence.id,
          retentionPolicyId: params.retentionPolicyId,
          decisionStatus: "ASSIGNED",
          retentionLabel: params.retentionPolicyId,
          rationale: "Assigned from seeded scenario expectation.",
          policyBasis: "Seeded control requirement",
          destructionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }

    if (params.recertificationRequired) {
      await this.prisma.recertificationTask.create({
        data: {
          organizationId: params.organizationId,
          workspaceId: params.workspaceId,
          findingId: finding.id,
          evidenceRecordId: evidence.id,
          status: "OPEN",
          triggerType: "MODEL_CHANGE",
          triggerRefType: "RUN",
          triggerRefId: params.runId,
          title: `Recertify controls for ${params.title}`,
          reason: params.recertificationReason ?? "Seeded recertification task.",
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    }

    return { findingId: finding.id, evidenceId: evidence.id, reviewCaseId, incidentId };
  }
}
