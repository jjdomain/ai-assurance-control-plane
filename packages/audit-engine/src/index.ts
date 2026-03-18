import { PrismaClient } from "@prisma/client";

export class AuditEngine {
  constructor(private readonly prisma: PrismaClient) {}

  async createIncidentPacket(incidentId: string, reason = "Internal assurance review") {
    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      include: {
        finding: {
          include: {
            run: true,
            controlMappings: {
              include: {
                policyControl: true
              }
            },
            evidence: true,
            reviewCases: {
              include: {
                decisions: true
              }
            },
            retentionDecisions: {
              include: {
                retentionPolicy: true
              }
            }
          }
        }
      }
    });

    const manifest = {
      reason,
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        summary: incident.summary
      },
      run: incident.finding?.run
        ? {
            externalRunId: incident.finding.run.externalRunId,
            environment: incident.finding.run.environment,
            modelRef: incident.finding.run.modelRef,
            promptVersionRef: incident.finding.run.promptVersionRef
          }
        : null,
      findings: incident.finding
        ? [
            {
              id: incident.finding.id,
              title: incident.finding.title,
              summary: incident.finding.summary,
              eventType: incident.finding.eventType,
              severity: incident.finding.severity,
              materialityScore: incident.finding.materialityScore,
              controls: incident.finding.controlMappings.map((mapping) => ({
                code: mapping.policyControl.code,
                title: mapping.policyControl.title
              }))
            }
          ]
        : [],
      evidence: incident.finding?.evidence.map((record) => ({
        id: record.id,
        type: record.evidenceType,
        status: record.status,
        storageRef: record.storageRef,
        hash: record.hash
      })),
      reviews: incident.finding?.reviewCases.map((review) => ({
        id: review.id,
        reviewType: review.reviewType,
        status: review.status,
        workflowStatus: review.workflowStatus,
        slaState: review.slaState,
        decisions: review.decisions.map((decision) => ({
          disposition: decision.disposition,
          decisionType: decision.decisionType,
          rationale: decision.rationale,
          createdAt: decision.createdAt
        }))
      })),
      retention: incident.finding?.retentionDecisions.map((decision) => ({
        label: decision.retentionLabel,
        status: decision.decisionStatus,
        policy: decision.retentionPolicy.name
      })),
      blockers: {
        missingEvidenceCount:
          incident.finding?.evidence.filter((record) => !record.approvedForAudit).length ?? 0,
        missingApprovalCount:
          incident.finding?.reviewCases.filter((review) => review.workflowStatus === "PENDING_APPROVER")
            .length ?? 0
      }
    };

    const missingEvidenceCount =
      incident.finding?.evidence.filter((record) => !record.approvedForAudit).length ?? 0;
    const missingApprovalCount =
      incident.finding?.reviewCases.filter((review) => review.workflowStatus === "PENDING_APPROVER")
        .length ?? 0;
    const completenessPercent =
      missingEvidenceCount === 0 && missingApprovalCount === 0
        ? 100
        : Math.max(35, 100 - missingEvidenceCount * 20 - missingApprovalCount * 25);

    const packet = await this.prisma.auditPacket.create({
      data: {
        organizationId: incident.organizationId,
        workspaceId: incident.workspaceId,
        incidentId: incident.id,
        packetKey: `incident-${incident.id}`,
        status:
          missingEvidenceCount > 0 || missingApprovalCount > 0
            ? "BLOCKED"
            : "READY_FOR_INTERNAL_REVIEW",
        scopeType: "INCIDENT",
        title: `${incident.title} packet`,
        description: "Assembled from linked findings, evidence, reviews, and retention records.",
        completenessPercent,
        missingEvidenceCount,
        missingApprovalCount,
        exportCount: 1,
        latestExportAt: new Date(),
        manifestJson: manifest
      }
    });

    await this.prisma.exportJob.create({
      data: {
        organizationId: incident.organizationId,
        workspaceId: incident.workspaceId,
        auditPacketId: packet.id,
        status: "READY",
        exportType: "INCIDENT_PACKET_JSON",
        outputRef: `seed://${packet.packetKey}.json`
      }
    });

    await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        needsPostIncidentPacket: true,
        postIncidentPacketId: packet.id
      }
    });

    return packet;
  }
}
