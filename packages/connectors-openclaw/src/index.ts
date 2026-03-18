import type { CanonicalEventInput, CanonicalRunInput } from "@aiacp/shared-types";

type DemoRunFixture = {
  scenarioId: string;
  label: string;
  summary: string;
  ingestPayload: {
    sourcePlatform: string;
    externalRunId: string;
    sessionId?: string;
    agentSystem: {
      name: string;
      platform: string;
      environment: string;
    };
    run: {
      status: string;
      startedAt: string;
      endedAt?: string;
      actorType: string;
      actorId?: string;
      promptVersionId?: string;
      modelProvider?: string;
      modelName?: string;
      metrics?: Record<string, unknown>;
      [key: string]: unknown;
    };
    spans?: Array<{
      externalSpanId: string;
      spanType: string;
      name: string;
      startedAt: string;
      success?: boolean;
      attributes?: Record<string, unknown>;
    }>;
  };
  expectedFindings?: {
    shouldCreateCase?: boolean;
    expectedCaseType?: string;
    expectedRuleIds?: string[];
    expectedControlCodes?: string[];
    suggestedRetentionPolicy?: string;
  };
};

export function normalizeOpenClawRun(fixture: DemoRunFixture): CanonicalRunInput {
  const payload = fixture.ingestPayload;
  const run = payload.run;
  const events: CanonicalEventInput[] = (payload.spans ?? []).map((span) => ({
    externalEventId: span.externalSpanId,
    eventType: span.spanType,
    eventTime: span.startedAt,
    actorType: run.actorType,
    targetRef:
      typeof span.attributes?.target === "string" ? span.attributes.target : null,
    status: span.success === false ? "ERROR" : "OK",
    attributes: {
      spanName: span.name,
      ...span.attributes
    }
  }));

  return {
    externalRunId: payload.externalRunId,
    sessionId: payload.sessionId ?? null,
    sourcePlatform: payload.sourcePlatform,
    environment: payload.agentSystem.environment,
    status: run.status,
    actorType: run.actorType,
    actorId: run.actorId ?? null,
    modelRef: [run.modelProvider, run.modelName].filter(Boolean).join(":") || null,
    promptVersionRef: run.promptVersionId ?? null,
    startedAt: run.startedAt,
    endedAt: run.endedAt ?? null,
    metrics: run.metrics ?? {},
    metadata: {
      scenarioId: fixture.scenarioId,
      label: fixture.label,
      summary: fixture.summary,
      expectedFindings: fixture.expectedFindings ?? {},
      agentSystem: payload.agentSystem,
      rawRun: run
    },
    events
  };
}

type IngestPayload = {
  sourcePlatform?: string;
  externalRunId: string;
  sessionId?: string;
  agentSystem?: {
    name?: string;
    platform?: string;
    environment?: string;
  };
  run: {
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
  };
  spans?: Array<{
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
  }>;
};

export function normalizeOpenClawPayload(payload: IngestPayload): CanonicalRunInput {
  const run = payload.run;
  const events: CanonicalEventInput[] = (payload.spans ?? []).map((span) => ({
    externalEventId: span.externalSpanId,
    eventType: span.spanType ?? span.type ?? "OTHER",
    eventTime: span.startedAt,
    actorType: run.actorType ?? "AGENT",
    targetRef:
      typeof span.attributes?.target === "string" ? span.attributes.target : null,
    status: span.success === false ? "ERROR" : span.status ?? "OK",
    attributes: {
      spanName: span.name,
      parentExternalSpanId: span.parentExternalSpanId ?? null,
      ...(span.attributes ?? {})
    }
  }));

  return {
    externalRunId: payload.externalRunId,
    sessionId: payload.sessionId ?? null,
    sourcePlatform: payload.sourcePlatform ?? payload.agentSystem?.platform ?? "OPENCLAW",
    environment: payload.agentSystem?.environment ?? "PROD",
    status: run.status,
    actorType: run.actorType ?? "AGENT",
    actorId: run.actorId ?? null,
    modelRef: [run.modelProvider, run.modelName].filter(Boolean).join(":") || null,
    promptVersionRef: run.promptVersionId ?? null,
    startedAt: run.startedAt,
    endedAt: run.endedAt ?? null,
    metrics: run.metrics ?? {},
    metadata: {
      agentSystem: payload.agentSystem ?? {},
      rawRun: run,
      source: "ingest-api"
    },
    events
  };
}
