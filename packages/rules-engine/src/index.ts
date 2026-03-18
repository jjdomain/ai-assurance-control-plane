import { loadRuleDocument } from "@aiacp/policy-packs";

type RuleLeaf = {
  field: string;
  op: string;
  value?: unknown;
};

type RuleGroup = {
  all?: RuleCondition[];
  any?: RuleCondition[];
};

type RuleCondition = RuleLeaf | RuleGroup;

type RuleAdjustment = {
  when: RuleLeaf | RuleGroup;
  add: number;
};

export type AssuranceRule = {
  id: string;
  name: string;
  enabled?: boolean;
  eventType: string;
  severityBase: string;
  priority?: number;
  rootRuleFamily?: string;
  conditions: RuleGroup;
  scoreAdjustments?: RuleAdjustment[];
  titleTemplate: string;
  summaryTemplate: string;
  primaryTargetField?: string;
  controlMappings?: string[];
  retentionPolicy?: string;
  caseType?: string;
};

export type RuleEngineConfig = {
  autoCaseOnMedium?: boolean;
  clusterWindowMinutes?: number;
};

export type RuleEngineBundle = {
  config: RuleEngineConfig;
  rules: AssuranceRule[];
};

type CanonicalRunRecord = {
  id: string;
  externalRunId: string;
  environment: string;
  status: string;
  actorType: string;
  actorId: string | null;
  modelRef: string | null;
  promptVersionRef: string | null;
  metricsJson: unknown;
  metadataJson: unknown;
};

type CanonicalEventRecord = {
  id: string;
  externalEventId: string;
  eventType: string;
  eventTime: Date;
  attributesJson: unknown;
};

export type EvaluationInput = {
  run: CanonicalRunRecord;
  events: CanonicalEventRecord[];
};

export type RuleMatch = {
  ruleId: string;
  ruleName: string;
  eventType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  materialityLevel: "INFORMATIONAL" | "NOTABLE" | "MATERIAL" | "URGENT";
  materialityScore: number;
  evidenceScore: number;
  confidenceScore: number;
  title: string;
  summary: string;
  controlMappings: string[];
  retentionPolicy: string | null;
  caseType: string | null;
  reviewRequired: boolean;
  reviewDueHours: number | null;
  evidenceFreshnessRequirement: string | null;
  controlHealthImpact: "HEALTHY" | "WATCH" | "AT_RISK" | "FAILING" | "UNKNOWN";
  recertificationTrigger:
    | "MODEL_CHANGE"
    | "PROMPT_CHANGE"
    | "TOOL_PERMISSION_CHANGE"
    | "EXTERNAL_ACTION_POLICY_CHANGE"
    | "RETENTION_POLICY_CHANGE"
    | "MEMORY_POLICY_CHANGE"
    | "CONNECTOR_PERMISSION_CHANGE"
    | "RULE_PACK_CHANGE"
    | "CONTROL_MAPPING_CHANGE"
    | null;
  approvalRequired: boolean;
  incidentRequired: boolean;
  primaryEventId: string | null;
  primaryTarget: string | null;
  sourceRiskClass:
    | "AUTHORIZATION"
    | "DATA_ACCESS"
    | "DATA_RETENTION"
    | "EXTERNAL_ACTIONS"
    | "PROMPT_INJECTION"
    | "MEMORY_GOVERNANCE"
    | "TOOL_USE"
    | "MODEL_BEHAVIOR"
    | "HUMAN_APPROVAL"
    | "AUDITABILITY"
    | "OTHER";
  recommendedActions: Array<{ type: string; detail: string }>;
  explainability: Record<string, unknown>;
};

function isLeaf(condition: RuleCondition): condition is RuleLeaf {
  return "field" in condition;
}

export function loadRuleBundle(rootDir: string): RuleEngineBundle {
  const parsed = loadRuleDocument(rootDir);

  return {
    config: (parsed.defaultRuleEngineConfig ?? {}) as RuleEngineConfig,
    rules: ((parsed.rules ?? []) as AssuranceRule[])
      .map((rule) => rule as AssuranceRule)
      .filter((rule) => rule.enabled !== false)
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getRunView(run: CanonicalRunRecord) {
  const metadata = asRecord(run.metadataJson);
  const rawRun = asRecord(metadata.rawRun);
  const metrics = asRecord(run.metricsJson);
  const [modelProvider, modelNameFromRef] = (run.modelRef ?? "").split(":");

  return {
    id: run.id,
    externalRunId: run.externalRunId,
    environment: run.environment,
    status: run.status,
    actorType: run.actorType,
    actorId: run.actorId,
    promptVersionId: run.promptVersionRef ?? rawRun.promptVersionId ?? null,
    modelName: rawRun.modelName ?? modelNameFromRef ?? null,
    modelProvider: rawRun.modelProvider ?? modelProvider ?? null,
    channel: rawRun.channel ?? null,
    metrics
  };
}

function getEventView(event: CanonicalEventRecord) {
  const attributes = asRecord(event.attributesJson);
  return {
    id: event.id,
    externalEventId: event.externalEventId,
    spanType: event.eventType,
    eventType: event.eventType,
    attributes
  };
}

function resolvePath(target: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, target);
}

function resolveField(input: EvaluationInput, event: CanonicalEventRecord | null, field: string) {
  const runView = getRunView(input.run);
  if (field.startsWith("run.")) {
    return resolvePath({ run: runView }, field);
  }

  if (field.startsWith("span.")) {
    return resolvePath({ span: event ? getEventView(event) : {} }, field);
  }

  return undefined;
}

function compare(op: string, actual: unknown, expected: unknown) {
  switch (op) {
    case "eq":
      return actual === expected;
    case "in":
      return asArray(expected).includes(actual);
    case "not_in":
      return !asArray(expected).includes(actual);
    case "gte":
      return Number(actual ?? 0) >= Number(expected ?? 0);
    case "gt":
      return Number(actual ?? 0) > Number(expected ?? 0);
    case "lt":
      return Number(actual ?? 0) < Number(expected ?? 0);
    case "lte":
      return Number(actual ?? 0) <= Number(expected ?? 0);
    case "count_gte":
      return asArray(actual).length >= Number(expected ?? 0);
    case "overlap": {
      const actualValues = new Set(asArray(actual));
      return asArray(expected).some((value) => actualValues.has(value));
    }
    case "is_empty":
      return actual == null || actual === "" || (Array.isArray(actual) && actual.length === 0);
    default:
      return false;
  }
}

function evaluateCondition(
  input: EvaluationInput,
  event: CanonicalEventRecord | null,
  condition: RuleCondition,
  matchedFields: Array<Record<string, unknown>>
): boolean {
  if (isLeaf(condition)) {
    const actual = resolveField(input, event, condition.field);
    const passed = compare(condition.op, actual, condition.value);
    matchedFields.push({
      field: condition.field,
      op: condition.op,
      expected: condition.value ?? null,
      actual: actual ?? null,
      passed
    });
    return passed;
  }

  if (condition.all) {
    return condition.all.every((child) => evaluateCondition(input, event, child, matchedFields));
  }

  if (condition.any) {
    return condition.any.some((child) => evaluateCondition(input, event, child, matchedFields));
  }

  return false;
}

function hasSpanReference(condition: RuleCondition): boolean {
  if (isLeaf(condition)) {
    return condition.field.startsWith("span.");
  }

  return [...(condition.all ?? []), ...(condition.any ?? [])].some((child) =>
    hasSpanReference(child)
  );
}

function baseScoreForSeverity(severityBase: string) {
  switch (severityBase) {
    case "HIGH":
      return 72;
    case "MEDIUM":
      return 52;
    case "LOW":
      return 32;
    default:
      return 62;
  }
}

function scoreToSeverity(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 90) {
    return "CRITICAL";
  }

  if (score >= 70) {
    return "HIGH";
  }

  if (score >= 45) {
    return "MEDIUM";
  }

  return "LOW";
}

function shouldOpenReview(
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  caseType: string | null,
  config: RuleEngineConfig
) {
  if (caseType === "INCIDENT") {
    return true;
  }

  if (severity === "HIGH" || severity === "CRITICAL") {
    return true;
  }

  return severity === "MEDIUM" && Boolean(config.autoCaseOnMedium);
}

function buildRecommendedActions(rule: AssuranceRule, severity: string) {
  const actions = [
    { type: "CONTROL_MAPPING", detail: "Review implicated policy controls." }
  ];

  if (rule.retentionPolicy) {
    actions.push({
      type: "RETENTION",
      detail: `Apply retention policy ${rule.retentionPolicy}.`
    });
  }

  if (rule.caseType) {
    actions.push({
      type: "WORKFLOW",
      detail: `Open ${rule.caseType.toLowerCase().replaceAll("_", " ")} workflow.`
    });
  }

  if (severity === "HIGH" || severity === "CRITICAL") {
    actions.push({
      type: "EVIDENCE",
      detail: "Capture a retained evidence snapshot for reviewer inspection."
    });
  }

  return actions;
}

function toMaterialityLevel(score: number): RuleMatch["materialityLevel"] {
  if (score >= 90) {
    return "URGENT";
  }
  if (score >= 70) {
    return "MATERIAL";
  }
  if (score >= 45) {
    return "NOTABLE";
  }
  return "INFORMATIONAL";
}

function toControlHealthImpact(
  severity: RuleMatch["severity"]
): RuleMatch["controlHealthImpact"] {
  if (severity === "CRITICAL") {
    return "FAILING";
  }
  if (severity === "HIGH") {
    return "AT_RISK";
  }
  if (severity === "MEDIUM") {
    return "WATCH";
  }
  return "UNKNOWN";
}

function inferReviewDueHours(severity: RuleMatch["severity"]) {
  if (severity === "CRITICAL") {
    return 4;
  }
  if (severity === "HIGH") {
    return 24;
  }
  if (severity === "MEDIUM") {
    return 72;
  }
  return null;
}

function inferRecertificationTrigger(rule: AssuranceRule, eventType: string): RuleMatch["recertificationTrigger"] {
  if (eventType.includes("MODEL")) {
    return "MODEL_CHANGE";
  }
  if (eventType.includes("RETENTION")) {
    return "RETENTION_POLICY_CHANGE";
  }
  if (rule.rootRuleFamily?.includes("tool")) {
    return "TOOL_PERMISSION_CHANGE";
  }
  return null;
}

function inferSourceRiskClass(eventType: string): RuleMatch["sourceRiskClass"] {
  if (eventType.includes("WRITE") || eventType.includes("ACTION")) {
    return "EXTERNAL_ACTIONS";
  }
  if (eventType.includes("RETENTION")) {
    return "DATA_RETENTION";
  }
  if (eventType.includes("MEMORY")) {
    return "MEMORY_GOVERNANCE";
  }
  if (eventType.includes("TOOL")) {
    return "TOOL_USE";
  }
  return "AUDITABILITY";
}

export function evaluateInput(
  bundle: RuleEngineBundle,
  input: EvaluationInput
): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const dedupeKeys = new Set<string>();
  const evidenceScore = Number(asRecord(input.run.metricsJson).evidenceSufficiency ?? 80);

  for (const rule of bundle.rules) {
    const contexts = hasSpanReference(rule.conditions) ? input.events : [null];

    for (const event of contexts) {
      const matchedFields: Array<Record<string, unknown>> = [];
      const passed = evaluateCondition(input, event, rule.conditions, matchedFields);

      if (!passed) {
        continue;
      }

      let materialityScore = baseScoreForSeverity(rule.severityBase);
      const scoreBreakdown: Array<Record<string, unknown>> = [
        { kind: "base", value: materialityScore }
      ];

      for (const adjustment of rule.scoreAdjustments ?? []) {
        const adjustmentMatches: Array<Record<string, unknown>> = [];
        if (evaluateCondition(input, event, adjustment.when, adjustmentMatches)) {
          materialityScore += adjustment.add;
          scoreBreakdown.push({
            kind: "adjustment",
            add: adjustment.add,
            matched: adjustmentMatches
          });
        }
      }

      const severity = scoreToSeverity(materialityScore);
      const materialityLevel = toMaterialityLevel(materialityScore);
      const confidenceScore = Math.max(70, Math.min(98, 82 + matchedFields.length * 2));
      const primaryTarget = rule.primaryTargetField
        ? (resolveField(input, event, rule.primaryTargetField) as string | undefined) ?? null
        : null;
      const dedupeKey = [rule.id, input.run.id, event?.id ?? "run", primaryTarget ?? "none"].join(":");

      if (dedupeKeys.has(dedupeKey)) {
        continue;
      }

      dedupeKeys.add(dedupeKey);

      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: rule.eventType,
        severity,
        materialityScore,
        evidenceScore,
        confidenceScore,
        title: rule.titleTemplate,
        summary: rule.summaryTemplate,
        controlMappings: (rule.controlMappings ?? []).filter((code) => code.startsWith("GOV-")),
        retentionPolicy: rule.retentionPolicy ?? null,
        caseType: rule.caseType ?? null,
        reviewRequired: shouldOpenReview(severity, rule.caseType ?? null, bundle.config),
        reviewDueHours: inferReviewDueHours(severity),
        evidenceFreshnessRequirement:
          severity === "CRITICAL" || severity === "HIGH"
            ? "Capture a locked snapshot within 24h."
            : "Retain evidence no older than 7d.",
        controlHealthImpact: toControlHealthImpact(severity),
        recertificationTrigger: inferRecertificationTrigger(rule, rule.eventType),
        approvalRequired:
          severity === "CRITICAL" ||
          rule.caseType === "INCIDENT" ||
          rule.eventType.includes("WRITE") ||
          rule.eventType.includes("PRIVILEGED"),
        incidentRequired: rule.caseType === "INCIDENT",
        primaryEventId: event?.id ?? null,
        primaryTarget,
        materialityLevel,
        sourceRiskClass: inferSourceRiskClass(rule.eventType),
        recommendedActions: buildRecommendedActions(rule, severity),
        explainability: {
          matchedFields,
          scoreBreakdown,
          primaryTarget,
          dedupeKey,
          materialityLevel,
          reviewDueHours: inferReviewDueHours(severity)
        }
      });
    }
  }

  return matches.sort((left, right) => right.materialityScore - left.materialityScore);
}
