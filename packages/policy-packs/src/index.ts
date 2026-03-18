import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import type { PolicyPackFixture, RuleFixture } from "@aiacp/shared-types";
import { PrismaClient } from "@prisma/client";

function loadYaml(filePath: string) {
  return yaml.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export function loadPolicyFixtures(rootDir: string) {
  const filePath = path.join(rootDir, "sample_policy_packs.yaml");
  const parsed = loadYaml(filePath);
  return (parsed.packs ?? []) as PolicyPackFixture[];
}

export function loadRuleFixtures(rootDir: string) {
  const filePath = path.join(rootDir, "sample_rules.yaml");
  const parsed = loadYaml(filePath);
  return (parsed.rules ?? []) as RuleFixture[];
}

export function loadRuleDocument(rootDir: string) {
  const filePath = path.join(rootDir, "sample_rules.yaml");
  return loadYaml(filePath);
}

export async function buildPolicyCatalog(prisma: PrismaClient, organizationId: string) {
  const [controls, retentionPolicies] = await Promise.all([
    prisma.policyControl.findMany({
      where: {
        policyPack: {
          organizationId
        }
      }
    }),
    prisma.retentionPolicy.findMany({
      where: {
        organizationId
      }
    })
  ]);

  return {
    controlsByCode: new Map(controls.map((control) => [control.code, control])),
    retentionPoliciesByName: new Map(
      retentionPolicies.map((policy) => [policy.name, policy])
    )
  };
}
