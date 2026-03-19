# AI Assurance Control Plane

AI Assurance Control Plane is a framework-agnostic assurance operations layer for agentic systems. It converts runtime signals into material findings, evidence workflows, review decisions, incidents, recertification tasks, and audit-ready outputs.

This repo exists to demonstrate product thinking and implementation depth at the intersection of AI security, AI governance, and assurance operations. It focuses on the workflow that begins after runtime signals are generated: deciding what matters, preserving evidence, routing review, escalating incidents, and maintaining an audit-ready record.

This product is not primarily an in-path runtime enforcement gateway and not primarily an observability console. It is the workflow and evidence layer that determines what matters, what must be kept, who must review it, and what must happen next.

## What It Demonstrates

- AI-agent-native assurance modeling
- Policy and control mapping
- Evidence lifecycle handling
- Reviewer workflow design
- Incident and recertification logic
- Audit packet assembly

## What It Is Not

- Not a generic trace dashboard
- Not only a runtime guardrail or scanner
- Not a broad enterprise compliance suite
- Not limited to one framework or vendor

## Stack

- `pnpm` workspace monorepo
- Next.js web shell in `apps/web`
- Fastify API shell in `apps/api`
- Prisma ORM with a canonical assurance schema
- Shared TypeScript domain packages for normalization, policy loading, repository workflows, evidence handling, and packet assembly

## Repo Layout

```text
apps/
  api/
  web/
packages/
  audit-engine/
  connectors-openclaw/
  core-domain/
  evidence-engine/
  policy-packs/
  rules-engine/
  shared-types/
prisma/
seed/
docs/
```

## Local Run

1. `copy .env.example .env`
2. `pnpm install`
3. Set `DATABASE_URL` in `.env` to a dedicated Postgres database, such as a separate Supabase project for this demo
4. `pnpm prisma:migrate`
5. `pnpm seed`
6. `pnpm dev:api`
7. `pnpm dev:web`

## Scripts

- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format`
- `pnpm prisma:generate`
- `pnpm prisma:migrate`
- `pnpm seed`

## Notes

- The app is intentionally positioned above tracing, eval, and runtime security tooling.
- OpenClaw is the first connector profile, but the schema and UI normalize data into shared assurance records.
- The seed layer includes runtime-first scenarios plus governance-oriented fixture context for systems, risk tiers, review templates, incident playbooks, and audit packet presets.
- For deployment, prefer a dedicated Postgres database for this project rather than sharing the same database used by the main `johnkwan.me` site.
