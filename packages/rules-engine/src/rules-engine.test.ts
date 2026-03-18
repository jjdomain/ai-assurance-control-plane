import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { normalizeOpenClawRun } from "@aiacp/connectors-openclaw";
import { evaluateInput, loadRuleBundle } from "./index.js";

const rootDir = path.resolve(process.cwd(), "../..");
const bundle = loadRuleBundle(rootDir);
const scenarios = JSON.parse(
  fs.readFileSync(path.join(rootDir, "seed_demo_runs.json"), "utf8")
) as {
  runs: Array<any>;
};

function getScenario(label: string) {
  const scenario = scenarios.runs.find((item) => item.label === label);
  if (!scenario) {
    throw new Error(`Missing scenario ${label}`);
  }

  const normalized = normalizeOpenClawRun(scenario);
  return {
    run: {
      id: scenario.scenarioId,
      externalRunId: normalized.externalRunId,
      environment: normalized.environment,
      status: normalized.status,
      actorType: normalized.actorType,
      actorId: normalized.actorId ?? null,
      modelRef: normalized.modelRef ?? null,
      promptVersionRef: normalized.promptVersionRef ?? null,
      metricsJson: normalized.metrics,
      metadataJson: normalized.metadata
    },
    events: normalized.events.map((event) => ({
      id: event.externalEventId,
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      eventTime: new Date(event.eventTime),
      attributesJson: event.attributes
    }))
  };
}

test("approval bypass fires on scenario 1", () => {
  const matches = evaluateInput(bundle, getScenario("External email without approval"));
  assert.ok(matches.some((match) => match.ruleId === "approval-bypass-email"));
});

test("sensitive outbound data fires on scenario 2", () => {
  const matches = evaluateInput(bundle, getScenario("Sensitive data in outward Slack message"));
  assert.ok(matches.some((match) => match.ruleId === "output-sensitive-data-external-share"));
});

test("autonomy loop fires on scenario 3", () => {
  const matches = evaluateInput(bundle, getScenario("Autonomy loop with multi-tool side effects"));
  assert.ok(matches.some((match) => match.ruleId === "suspicious-autonomy-loop"));
});

test("provenance delete fires on scenario 4", () => {
  const matches = evaluateInput(bundle, getScenario("High-impact delete with weak provenance"));
  assert.ok(matches.some((match) => match.ruleId === "provenance-high-impact-delete"));
});

test("version lineage gap fires on scenario 5", () => {
  const matches = evaluateInput(bundle, getScenario("Chain-of-custody / version gap"));
  assert.ok(matches.some((match) => match.ruleId === "version-lineage-gap"));
});

test("clean run produces no reviewable findings", () => {
  const matches = evaluateInput(bundle, getScenario("Clean internal summary run"));
  assert.equal(matches.length, 0);
});

test("calendar incident rule fires on scenario 7", () => {
  const matches = evaluateInput(
    bundle,
    getScenario("Unapproved external calendar invite with client matter name")
  );
  assert.ok(matches.some((match) => match.caseType === "INCIDENT"));
});

test("unmapped tool rule fires on scenario 8", () => {
  const matches = evaluateInput(bundle, getScenario("Unmapped risky tool use"));
  assert.ok(matches.some((match) => match.ruleId === "unmapped-side-effect-tool"));
});
