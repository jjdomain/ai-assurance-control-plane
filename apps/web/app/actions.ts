"use server";

import { revalidatePath } from "next/cache";
import { AuditEngine } from "@aiacp/audit-engine";
import { ReviewDisposition } from "@prisma/client";

async function getPrisma() {
  const { PrismaClient } = eval("require")("@prisma/client") as typeof import("@prisma/client");
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"]
  });
}

export async function placeLegalHoldAction(formData: FormData) {
  const prisma = await getPrisma();
  const evidenceRecordId = String(formData.get("evidenceRecordId") ?? "");
  const reason = String(formData.get("reason") ?? "Manual retention hold from UI.");
  const evidence = await prisma.evidenceRecord.findUnique({
    where: { id: evidenceRecordId },
    include: { finding: true }
  });

  if (!evidence || !evidence.finding) {
    return;
  }

  await prisma.legalHold.create({
    data: {
      organizationId: evidence.finding.organizationId,
      workspaceId: evidence.finding.workspaceId,
      evidenceRecordId: evidence.id,
      holdReason: reason,
      status: "ACTIVE"
    }
  }).catch(() => undefined);

  await prisma.evidenceRecord.update({
    where: { id: evidence.id },
    data: {
      legalHoldActive: true,
      retentionState: "HELD",
      freshnessState: "HELD"
    }
  });

  revalidatePath("/evidence");
  revalidatePath("/incidents");
  revalidatePath("/retention");
  revalidatePath("/overview");
}

export async function confirmRetentionDecisionAction(formData: FormData) {
  const prisma = await getPrisma();
  const retentionDecisionId = String(formData.get("retentionDecisionId") ?? "");
  if (!retentionDecisionId) {
    return;
  }

  await prisma.retentionDecision.update({
    where: { id: retentionDecisionId },
    data: { decisionStatus: "CONFIRMED" }
  });

  revalidatePath("/findings");
  revalidatePath("/evidence");
  revalidatePath("/overview");
}

export async function closeReviewAction(formData: FormData) {
  const prisma = await getPrisma();
  const reviewCaseId = String(formData.get("reviewCaseId") ?? "");
  const disposition = String(formData.get("disposition") ?? "APPROVED");
  const rationale = String(
    formData.get("rationale") ?? "Closed from the seeded demo review queue."
  );

  if (!reviewCaseId) {
    return;
  }

  const review = await prisma.reviewCase.findUnique({ where: { id: reviewCaseId } });
  if (!review) {
    return;
  }

  await prisma.reviewDecision.create({
    data: {
      reviewCaseId,
      statusBefore: review.status,
      statusAfter: "CLOSED",
      disposition:
        ReviewDisposition[disposition as keyof typeof ReviewDisposition] ?? ReviewDisposition.APPROVED,
      rationale
    }
  });

  await prisma.reviewCase.update({
    where: { id: reviewCaseId },
    data: {
      status: "CLOSED",
      workflowStatus: "CLOSED",
      decisionType: disposition === "APPROVED" ? "APPROVE" : undefined,
      decisionRationale: rationale,
      closedAt: new Date()
    }
  });

  revalidatePath("/reviews");
  revalidatePath("/findings");
  revalidatePath("/overview");
}

export async function approveEvidenceAction(formData: FormData) {
  const prisma = await getPrisma();
  const evidenceRecordId = String(formData.get("evidenceRecordId") ?? "");
  if (!evidenceRecordId) {
    return;
  }

  const approver = await prisma.user.findFirst({ where: { email: "gov@example.com" } });
  await prisma.evidenceRecord.update({
    where: { id: evidenceRecordId },
    data: {
      approvedForAudit: true,
      approvedByUserId: approver?.id ?? null,
      approvedAt: new Date(),
      reviewComments: "Approved from the evidence workspace."
    }
  });

  revalidatePath("/evidence");
  revalidatePath("/audit-packets");
  revalidatePath("/overview");
}

export async function acceptRiskAction(formData: FormData) {
  const prisma = await getPrisma();
  const findingId = String(formData.get("findingId") ?? "");
  if (!findingId) {
    return;
  }

  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.finding.update({
    where: { id: findingId },
    data: {
      workflowStatus: "ACCEPTED_RISK",
      workflowState: "ACCEPTED_RISK_ACTIVE",
      acceptedRiskUntil: expiry,
      acceptedRiskRationale: "Accepted from the reviewer workflow."
    }
  });

  await prisma.reviewCase.updateMany({
    where: { findingId },
    data: {
      workflowStatus: "DECIDED",
      decisionType: "ACCEPT_RISK",
      acceptedRiskUntil: expiry,
      decisionRationale: "Accepted from the reviewer workflow."
    }
  });

  revalidatePath("/findings");
  revalidatePath("/reviews");
  revalidatePath("/overview");
}

export async function generateAuditPacketAction(formData: FormData) {
  const prisma = await getPrisma();
  const incidentId = String(formData.get("incidentId") ?? "");
  if (!incidentId) {
    return;
  }

  const engine = new AuditEngine(prisma);
  await engine.createIncidentPacket(incidentId, "Generated from the UI incident console");
  revalidatePath("/incidents");
  revalidatePath("/audit-packets");
  revalidatePath("/overview");
}
