import { PrismaClient } from "@prisma/client";
import type { RuleMatch } from "@aiacp/rules-engine";

type PostFindingWorkflowInput = {
  findingId: string;
  evidenceId: string;
  match: RuleMatch;
  retentionPolicyId?: string | null;
};

function hasRestrictedClasses(snapshot: Record<string, unknown>) {
  const spans = Array.isArray(snapshot.spans) ? snapshot.spans : [];
  return spans.some((span) => {
    const attributes =
      span && typeof span === "object" && "attributes" in span
        ? ((span as { attributes?: Record<string, unknown> }).attributes ?? {})
        : {};
    const sensitiveClasses = Array.isArray(attributes.sensitiveClasses)
      ? attributes.sensitiveClasses
      : [];
    return sensitiveClasses.some((value) =>
      ["PRIVILEGED_LABEL", "CLIENT_MATTER", "API_KEY"].includes(String(value))
    );
  });
}

export class EvidenceEngine {
  constructor(private readonly prisma: PrismaClient) {}

  buildSnapshot(input: { ingestPayload: Record<string, unknown>; match: RuleMatch }) {
    const restricted = hasRestrictedClasses(input.ingestPayload);
    return {
      source: "OPENCLAW_DEMO",
      restricted,
      redactionMode: restricted ? "POLICY_DEFAULT" : "NONE",
      ruleId: input.match.ruleId,
      eventType: input.match.eventType,
      ingestPayload: input.ingestPayload
    };
  }

  async applyPostFindingWorkflow(input: PostFindingWorkflowInput) {
    const finding = await this.prisma.finding.findUniqueOrThrow({
      where: { id: input.findingId },
      select: { organizationId: true, workspaceId: true, reviewRequired: true }
    });

    if (input.retentionPolicyId) {
      await this.prisma.reviewCase.updateMany({
        where: {
          findingId: input.findingId
        },
        data: {
          retentionPolicyId: input.retentionPolicyId
        }
      });
    }

    if (input.match.incidentRequired || input.match.eventType === "RETENTION_REQUIRED") {
      await this.prisma.legalHold.create({
        data: {
          organizationId: finding.organizationId,
          workspaceId: finding.workspaceId,
          evidenceRecordId: input.evidenceId,
          holdReason: "Material event requires preserved evidence pending governance review.",
          status: "ACTIVE"
        }
      }).catch(() => undefined);

      await this.prisma.evidenceRecord.update({
        where: { id: input.evidenceId },
        data: {
          legalHoldActive: true,
          retentionState: "HELD",
          freshnessState: "HELD"
        }
      });
    }

    if (input.match.approvalRequired) {
      await this.prisma.evidenceRecord.update({
        where: { id: input.evidenceId },
        data: {
          approvedForAudit: false,
          redactionState: "NOT_REVIEWED",
          reviewComments: "Awaiting reviewer approval before audit use."
        }
      });
    }

    if (input.match.reviewRequired && finding.reviewRequired) {
      await this.prisma.finding.update({
        where: { id: input.findingId },
        data: {
          workflowState: "NEEDS_REVIEW"
        }
      });
    }

    await this.prisma.timelineEvent.createMany({
      data: [
        {
          reviewCaseId:
            (
              await this.prisma.reviewCase.findFirst({
                where: { findingId: input.findingId },
                select: { id: true }
              })
            )?.id ?? undefined,
          eventType: "FINDING_PERSISTED",
          body: `${input.match.ruleName} created a retained evidence record.`
        }
      ].filter((item) => item.reviewCaseId)
    });
  }
}
