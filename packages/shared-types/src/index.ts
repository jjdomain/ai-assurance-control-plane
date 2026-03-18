export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ReviewQueueType =
  | "RUNTIME_REVIEW"
  | "RETENTION_REVIEW"
  | "CHAIN_OF_CUSTODY_GAP"
  | "RECERTIFICATION"
  | "POLICY_EXCEPTION"
  | "INCIDENT";

export interface CanonicalEventInput {
  externalEventId: string;
  eventType: string;
  eventTime: string;
  actorType?: string;
  targetRef?: string | null;
  status?: string;
  attributes: Record<string, unknown>;
}

export interface CanonicalRunInput {
  externalRunId: string;
  sessionId?: string | null;
  sourcePlatform: string;
  environment: string;
  status: string;
  actorType: string;
  actorId?: string | null;
  modelRef?: string | null;
  promptVersionRef?: string | null;
  startedAt: string;
  endedAt?: string | null;
  metrics: Record<string, unknown>;
  metadata: Record<string, unknown>;
  events: CanonicalEventInput[];
}

export interface RuleFixture {
  id: string;
  name: string;
  eventType: string;
  severityBase: string;
  controlMappings: string[];
  retentionPolicy?: string;
  caseType?: string;
  [key: string]: unknown;
}

export interface PolicyPackFixture {
  id: string;
  name: string;
  slug: string;
  version: string;
  retentionPolicies?: Array<Record<string, unknown>>;
  controls?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
