"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditEngine } from "@aiacp/audit-engine";
import { evaluateInput, type AssuranceRule } from "@aiacp/rules-engine";
import { Prisma, ReviewDisposition } from "@prisma/client";
import { prisma } from "../lib/prisma";

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function parseJsonField(value: FormDataEntryValue | null, fallback: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  return JSON.parse(raw);
}

function parseCsvField(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nextPatchVersion(version: string) {
  const [major, minor, patch] = version.split(".").map((part) => Number(part ?? 0));
  return `${major || 1}.${minor || 0}.${(patch || 0) + 1}`;
}

function withFlash(path: string, flash: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}flash=${encodeURIComponent(flash)}`;
}

async function getAdminContext() {
  const workspace = await prisma.workspace.findFirst({
    include: { organization: true }
  });

  if (!workspace) {
    throw new Error("No workspace available for admin actions.");
  }

  return workspace;
}

function buildRuleRawJson(formData: FormData, existingRawJson?: Record<string, any>) {
  const slug = String(formData.get("slug") ?? existingRawJson?.id ?? "").trim();
  const name = String(formData.get("name") ?? existingRawJson?.name ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "true") === "true";

  return {
    ...(existingRawJson ?? {}),
    id: slug,
    name,
    enabled,
    eventType: String(formData.get("eventType") ?? existingRawJson?.eventType ?? "POLICY_THRESHOLD_EXCEEDED"),
    severityBase: String(formData.get("severityBase") ?? existingRawJson?.severityBase ?? "MEDIUM"),
    priority: Number(formData.get("priority") ?? existingRawJson?.priority ?? 50),
    rootRuleFamily: String(formData.get("rootRuleFamily") ?? existingRawJson?.rootRuleFamily ?? "custom"),
    conditions: parseJsonField(formData.get("conditionsJson"), existingRawJson?.conditions ?? { all: [] }),
    scoreAdjustments: parseJsonField(formData.get("scoreAdjustmentsJson"), existingRawJson?.scoreAdjustments ?? []),
    titleTemplate: String(formData.get("titleTemplate") ?? existingRawJson?.titleTemplate ?? ""),
    summaryTemplate: String(formData.get("summaryTemplate") ?? existingRawJson?.summaryTemplate ?? ""),
    primaryTargetField: String(formData.get("primaryTargetField") ?? existingRawJson?.primaryTargetField ?? ""),
    controlMappings: parseCsvField(formData.get("controlMappings")),
    retentionPolicy: String(formData.get("retentionPolicy") ?? existingRawJson?.retentionPolicy ?? "").trim() || null,
    caseType: String(formData.get("caseType") ?? existingRawJson?.caseType ?? "").trim() || null
  };
}

function buildPackRawJson(formData: FormData, existingRawJson?: Record<string, any>) {
  return {
    ...(existingRawJson ?? {}),
    description: String(formData.get("description") ?? existingRawJson?.description ?? ""),
    categories: parseJsonField(formData.get("categoriesJson"), existingRawJson?.categories ?? [])
  };
}

export async function placeLegalHoldAction(formData: FormData) {
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

export async function saveRuleDefinitionAction(formData: FormData) {
  const workspace = await getAdminContext();
  const ruleDefinitionId = String(formData.get("ruleDefinitionId") ?? "").trim();
  const version = String(formData.get("version") ?? "1.0.0").trim();
  const sourceType = String(formData.get("sourceType") ?? "ADMIN");
  const slug = String(formData.get("slug") ?? "").trim();

  if (!slug) {
    return;
  }

  const existing = ruleDefinitionId
    ? await prisma.ruleDefinition.findUnique({ where: { id: ruleDefinitionId } })
    : null;
  const rawJson = buildRuleRawJson(formData, asRecord(existing?.rawJson));
  const payload = {
    organizationId: workspace.organizationId,
    slug,
    name: String(formData.get("name") ?? rawJson.name),
    version,
    sourceType,
    isActive: String(formData.get("enabled") ?? "true") === "true",
    rawJson: rawJson as Prisma.InputJsonValue
  };

  if (existing) {
    await prisma.ruleDefinition.update({
      where: { id: existing.id },
      data: payload
    });
  } else {
    await prisma.ruleDefinition.create({
      data: payload
    });
  }

  revalidatePath("/admin");
  revalidatePath("/rules");
  revalidatePath("/control-mappings");
  redirect(`/rules?ruleId=${existing?.id ?? slug}&flash=rule-saved`);
}

export async function createRuleDefinitionAction(formData: FormData) {
  const workspace = await getAdminContext();
  const name = String(formData.get("name") ?? "New Rule").trim();
  const slug =
    String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `rule-${Date.now()}`;

  const rawJson = {
    id: slug,
    name,
    enabled: false,
    eventType: "POLICY_THRESHOLD_EXCEEDED",
    severityBase: "MEDIUM",
    priority: 50,
    rootRuleFamily: "custom",
    conditions: { all: [] },
    scoreAdjustments: [],
    titleTemplate: `${name} title`,
    summaryTemplate: `${name} summary`,
    primaryTargetField: "run.externalRunId",
    controlMappings: [],
    retentionPolicy: null,
    caseType: "RISK_REVIEW"
  };

  await prisma.ruleDefinition.create({
    data: {
      organizationId: workspace.organizationId,
      slug,
      name,
      version: "1.0.0",
      sourceType: "ADMIN",
      isActive: false,
      rawJson: rawJson as Prisma.InputJsonValue
    }
  });

  revalidatePath("/admin");
  revalidatePath("/rules");
  const created = await prisma.ruleDefinition.findFirst({
    where: { organizationId: workspace.organizationId, slug },
    orderBy: { createdAt: "desc" }
  });
  redirect(`/rules?ruleId=${created?.id ?? ""}&flash=rule-created`);
}

export async function deleteRuleDefinitionAction(formData: FormData) {
  const ruleDefinitionId = String(formData.get("ruleDefinitionId") ?? "");
  if (!ruleDefinitionId) {
    return;
  }

  await prisma.ruleDefinition.delete({
    where: { id: ruleDefinitionId }
  }).catch(() => undefined);

  revalidatePath("/admin");
  revalidatePath("/rules");
  revalidatePath("/control-mappings");
  redirect("/rules?flash=rule-deleted");
}

export async function versionRuleDefinitionAction(formData: FormData) {
  const ruleDefinitionId = String(formData.get("ruleDefinitionId") ?? "");
  if (!ruleDefinitionId) {
    return;
  }

  const existing = await prisma.ruleDefinition.findUnique({ where: { id: ruleDefinitionId } });
  if (!existing) {
    return;
  }

  const rawJson = asRecord(existing.rawJson);
  await prisma.ruleDefinition.create({
    data: {
      organizationId: existing.organizationId,
      slug: existing.slug,
      name: existing.name,
      version: nextPatchVersion(existing.version),
      sourceType: existing.sourceType,
      isActive: false,
      rawJson: {
        ...rawJson,
        enabled: false
      } as Prisma.InputJsonValue
    }
  });

  revalidatePath("/rules");
  const cloned = await prisma.ruleDefinition.findFirst({
    where: {
      organizationId: existing.organizationId,
      slug: existing.slug,
      version: nextPatchVersion(existing.version)
    },
    orderBy: { createdAt: "desc" }
  });
  redirect(withFlash(`/rules?ruleId=${cloned?.id ?? existing.id}`, "rule-versioned"));
}

export async function publishRuleDefinitionAction(formData: FormData) {
  const ruleDefinitionId = String(formData.get("ruleDefinitionId") ?? "");
  if (!ruleDefinitionId) {
    return;
  }

  const existing = await prisma.ruleDefinition.findUnique({ where: { id: ruleDefinitionId } });
  if (!existing) {
    return;
  }

  await prisma.$transaction([
    prisma.ruleDefinition.updateMany({
      where: {
        organizationId: existing.organizationId,
        slug: existing.slug
      },
      data: { isActive: false }
    }),
    prisma.ruleDefinition.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        rawJson: {
          ...asRecord(existing.rawJson),
          enabled: true
        } as Prisma.InputJsonValue
      }
    })
  ]);

  revalidatePath("/rules");
  revalidatePath("/admin");
  redirect(`/rules?ruleId=${existing.id}&flash=rule-published`);
}

export async function testRuleDefinitionAction(formData: FormData) {
  const ruleDefinitionId = String(formData.get("ruleDefinitionId") ?? "");
  const runId = String(formData.get("runId") ?? "");
  if (!ruleDefinitionId || !runId) {
    return;
  }

  const workspace = await getAdminContext();
  const rule = await prisma.ruleDefinition.findUnique({ where: { id: ruleDefinitionId } });
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      events: {
        orderBy: { eventTime: "asc" }
      }
    }
  });

  if (!rule || !run) {
    return;
  }

  const workspaceConfig = asRecord(workspace.metadataJson).governanceContext?.ruleEngineConfig ?? {};
  const rawJson = asRecord(rule.rawJson);
  const matches = evaluateInput(
    {
      config: workspaceConfig,
      rules: [rawJson as AssuranceRule]
    },
    { run, events: run.events }
  );

  await prisma.ruleDefinition.update({
    where: { id: rule.id },
    data: {
      rawJson: {
        ...rawJson,
        adminMetadata: {
          ...(rawJson.adminMetadata ?? {}),
          latestTestResult: {
            testedAt: new Date().toISOString(),
            runId: run.id,
            externalRunId: run.externalRunId,
            matchCount: matches.length,
            matches
          }
        }
      } as Prisma.InputJsonValue
    }
  });

  revalidatePath("/rules");
  redirect(`/rules?ruleId=${rule.id}&flash=rule-tested`);
}

export async function saveRuleEngineConfigAction(formData: FormData) {
  const workspace = await getAdminContext();
  const currentMetadata = asRecord(workspace.metadataJson);
  const governanceContext = asRecord(currentMetadata.governanceContext);
  const nextConfig = parseJsonField(formData.get("ruleEngineConfigJson"), governanceContext.ruleEngineConfig ?? {});

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      metadataJson: {
        ...currentMetadata,
        governanceContext: {
          ...governanceContext,
          ruleEngineConfig: nextConfig
        }
      } as Prisma.InputJsonValue
    }
  });

  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/rules");
  redirect("/settings?flash=config-saved");
}

export async function createPolicyPackAction(formData: FormData) {
  const workspace = await getAdminContext();
  const name = String(formData.get("name") ?? "New Policy Pack").trim();
  const slug =
    String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `pack-${Date.now()}`;

  await prisma.policyPack.create({
    data: {
      organizationId: workspace.organizationId,
      slug,
      name,
      version: "1.0.0",
      sourceType: "ADMIN",
      isActive: false,
      rawJson: {
        description: "",
        categories: []
      } as Prisma.InputJsonValue
    }
  });

  revalidatePath("/admin");
  revalidatePath("/policy-packs");
  const created = await prisma.policyPack.findFirst({
    where: { organizationId: workspace.organizationId, slug },
    orderBy: { createdAt: "desc" }
  });
  redirect(`/policy-packs?packId=${created?.id ?? ""}&flash=pack-created`);
}

export async function savePolicyPackAction(formData: FormData) {
  const workspace = await getAdminContext();
  const policyPackId = String(formData.get("policyPackId") ?? "");
  if (!policyPackId) {
    return;
  }

  const existing = await prisma.policyPack.findUnique({ where: { id: policyPackId } });
  if (!existing) {
    return;
  }

  await prisma.policyPack.update({
    where: { id: policyPackId },
    data: {
      organizationId: workspace.organizationId,
      slug: String(formData.get("slug") ?? existing.slug),
      name: String(formData.get("name") ?? existing.name),
      version: String(formData.get("version") ?? existing.version),
      sourceType: String(formData.get("sourceType") ?? existing.sourceType ?? "ADMIN"),
      isActive: String(formData.get("isActive") ?? (existing.isActive ? "true" : "false")) === "true",
      rawJson: buildPackRawJson(formData, asRecord(existing.rawJson)) as Prisma.InputJsonValue
    }
  });

  revalidatePath("/admin");
  revalidatePath("/policy-packs");
  revalidatePath("/control-mappings");
  redirect(`/policy-packs?packId=${existing.id}&flash=pack-saved`);
}

export async function versionPolicyPackAction(formData: FormData) {
  const policyPackId = String(formData.get("policyPackId") ?? "");
  if (!policyPackId) {
    return;
  }

  const existing = await prisma.policyPack.findUnique({
    where: { id: policyPackId },
    include: {
      controls: true,
      retentionPolicies: true
    }
  });

  if (!existing) {
    return;
  }

  const cloned = await prisma.policyPack.create({
    data: {
      organizationId: existing.organizationId,
      slug: existing.slug,
      name: existing.name,
      version: nextPatchVersion(existing.version),
      sourceType: existing.sourceType,
      isActive: false,
      rawJson: (existing.rawJson ?? {}) as Prisma.InputJsonValue
    }
  });

  for (const control of existing.controls) {
    await prisma.policyControl.create({
      data: {
        policyPackId: cloned.id,
        code: control.code,
        categoryCode: control.categoryCode,
        title: control.title,
        impactLevel: control.impactLevel,
        description: control.description,
        metadataJson: (control.metadataJson ?? {}) as Prisma.InputJsonValue,
        controlHealth: control.controlHealth,
        reviewCadence: control.reviewCadence,
        evidenceFreshnessRequirement: control.evidenceFreshnessRequirement,
        requiresHumanApproval: control.requiresHumanApproval,
        requiredEvidenceTypesJson: (control.requiredEvidenceTypesJson ?? []) as Prisma.InputJsonValue,
        lastAttestedAt: control.lastAttestedAt,
        nextReviewDueAt: control.nextReviewDueAt,
        riskCategory: control.riskCategory
      }
    });
  }

  for (const policy of existing.retentionPolicies) {
    await prisma.retentionPolicy.create({
      data: {
        organizationId: existing.organizationId,
        policyPackId: cloned.id,
        name: `${policy.name}-${cloned.version}`,
        scope: policy.scope,
        retentionClass: policy.retentionClass,
        retentionDays: policy.retentionDays,
        legalHoldAllowed: policy.legalHoldAllowed,
        deleteMode: policy.deleteMode,
        triggerSummary: policy.triggerSummary
      }
    });
  }

  revalidatePath("/policy-packs");
  redirect(`/policy-packs?packId=${cloned.id}&flash=pack-versioned`);
}

export async function publishPolicyPackAction(formData: FormData) {
  const policyPackId = String(formData.get("policyPackId") ?? "");
  if (!policyPackId) {
    return;
  }

  const existing = await prisma.policyPack.findUnique({ where: { id: policyPackId } });
  if (!existing) {
    return;
  }

  await prisma.$transaction([
    prisma.policyPack.updateMany({
      where: {
        organizationId: existing.organizationId,
        slug: existing.slug
      },
      data: { isActive: false }
    }),
    prisma.policyPack.update({
      where: { id: existing.id },
      data: { isActive: true }
    })
  ]);

  revalidatePath("/policy-packs");
  revalidatePath("/admin");
  redirect(`/policy-packs?packId=${existing.id}&flash=pack-published`);
}

export async function deletePolicyPackAction(formData: FormData) {
  const policyPackId = String(formData.get("policyPackId") ?? "");
  if (!policyPackId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.retentionPolicy.deleteMany({
      where: { policyPackId }
    });
    await tx.policyPack.delete({
      where: { id: policyPackId }
    });
  }).catch(() => undefined);

  revalidatePath("/policy-packs");
  revalidatePath("/admin");
  redirect("/policy-packs?flash=pack-deleted");
}

export async function savePolicyControlAction(formData: FormData) {
  const policyPackId = String(formData.get("policyPackId") ?? "");
  const policyControlId = String(formData.get("policyControlId") ?? "");
  if (!policyPackId) {
    return;
  }

  const data = {
    policyPackId,
    code: String(formData.get("code") ?? "").trim(),
    categoryCode: String(formData.get("categoryCode") ?? "").trim() || null,
    title: String(formData.get("title") ?? "").trim(),
    impactLevel: String(formData.get("impactLevel") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    reviewCadence: String(formData.get("reviewCadence") ?? "").trim() || null,
    evidenceFreshnessRequirement: String(formData.get("evidenceFreshnessRequirement") ?? "").trim() || null,
    requiresHumanApproval: String(formData.get("requiresHumanApproval") ?? "false") === "true",
    requiredEvidenceTypesJson: parseJsonField(formData.get("requiredEvidenceTypesJson"), []),
    metadataJson: {
      evidenceRequirements: parseJsonField(formData.get("evidenceRequirementsJson"), []),
      reviewRequirements: parseJsonField(formData.get("reviewRequirementsJson"), []),
      relatedEventTypes: parseJsonField(formData.get("relatedEventTypesJson"), [])
    } as Prisma.InputJsonValue
  };

  if (policyControlId) {
    await prisma.policyControl.update({
      where: { id: policyControlId },
      data
    });
  } else {
    await prisma.policyControl.create({ data });
  }

  revalidatePath("/policy-packs");
  revalidatePath("/control-mappings");
  redirect(`/policy-packs?packId=${policyPackId}&flash=control-saved`);
}

export async function deletePolicyControlAction(formData: FormData) {
  const policyControlId = String(formData.get("policyControlId") ?? "");
  const policyPackId = String(formData.get("policyPackId") ?? "");
  if (!policyControlId) {
    return;
  }

  await prisma.policyControl.delete({ where: { id: policyControlId } }).catch(() => undefined);
  revalidatePath("/policy-packs");
  revalidatePath("/control-mappings");
  redirect(withFlash(`/policy-packs${policyPackId ? `?packId=${policyPackId}` : ""}`, "control-deleted"));
}

export async function saveRetentionPolicyAction(formData: FormData) {
  const workspace = await getAdminContext();
  const retentionPolicyId = String(formData.get("retentionPolicyId") ?? "");
  const policyPackId = String(formData.get("policyPackId") ?? "").trim() || null;
  const data = {
    organizationId: workspace.organizationId,
    policyPackId,
    name: String(formData.get("name") ?? "").trim(),
    scope: String(formData.get("scope") ?? "").trim(),
    retentionClass: String(formData.get("retentionClass") ?? "").trim(),
    retentionDays: String(formData.get("retentionDays") ?? "").trim() ? Number(formData.get("retentionDays")) : null,
    legalHoldAllowed: String(formData.get("legalHoldAllowed") ?? "false") === "true",
    deleteMode: String(formData.get("deleteMode") ?? "").trim(),
    triggerSummary: String(formData.get("triggerSummary") ?? "").trim() || null
  };

  if (retentionPolicyId) {
    await prisma.retentionPolicy.update({
      where: { id: retentionPolicyId },
      data
    });
  } else {
    await prisma.retentionPolicy.create({ data });
  }

  revalidatePath("/policy-packs");
  revalidatePath("/rules");
  revalidatePath("/control-mappings");
  redirect(`/policy-packs?packId=${policyPackId ?? ""}&flash=retention-saved`);
}

export async function deleteRetentionPolicyAction(formData: FormData) {
  const retentionPolicyId = String(formData.get("retentionPolicyId") ?? "");
  const policyPackId = String(formData.get("policyPackId") ?? "");
  if (!retentionPolicyId) {
    return;
  }

  await prisma.retentionPolicy.delete({ where: { id: retentionPolicyId } }).catch(() => undefined);
  revalidatePath("/policy-packs");
  revalidatePath("/rules");
  revalidatePath("/control-mappings");
  redirect(withFlash(`/policy-packs${policyPackId ? `?packId=${policyPackId}` : ""}`, "retention-deleted"));
}

export async function saveControlMappingsAction(formData: FormData) {
  const ruleDefinitionId = String(formData.get("ruleDefinitionId") ?? "");
  const mappingId = String(formData.get("mappingId") ?? "");
  if (!ruleDefinitionId) {
    return;
  }

  const existing = await prisma.ruleDefinition.findUnique({ where: { id: ruleDefinitionId } });
  if (!existing) {
    return;
  }

  const rawJson = asRecord(existing.rawJson);
  await prisma.ruleDefinition.update({
    where: { id: existing.id },
    data: {
      rawJson: {
        ...rawJson,
        controlMappings: parseCsvField(formData.get("controlMappings")),
        retentionPolicy: String(formData.get("retentionPolicy") ?? "").trim() || null,
        caseType: String(formData.get("caseType") ?? "").trim() || null
      } as Prisma.InputJsonValue
    }
  });

  revalidatePath("/rules");
  revalidatePath("/control-mappings");
  revalidatePath("/admin");
  redirect(withFlash(`/control-mappings${mappingId ? `?mappingId=${mappingId}` : ""}`, "mapping-saved"));
}
