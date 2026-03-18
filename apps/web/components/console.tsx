import Link from "next/link";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { cn } from "../lib/utils";

function toneForValue(value: string) {
  if (["CRITICAL", "FAILING", "BREACHED", "HELD", "BLOCKED", "URGENT", "REJECTED"].includes(value)) {
    return "critical" as const;
  }

  if (
    [
      "HIGH",
      "AT_RISK",
      "STALE",
      "WARNING",
      "PENDING_APPROVER",
      "MATERIAL",
      "ACCEPTED_RISK",
      "NEEDS_REVIEW",
      "RECERTIFICATION_OPEN"
    ].includes(value)
  ) {
    return "warning" as const;
  }

  if (
    ["APPROVED", "HEALTHY", "FRESH", "READY_FOR_INTERNAL_REVIEW", "EXPORTED", "COMPLETED"].includes(
      value
    )
  ) {
    return "good" as const;
  }

  return "neutral" as const;
}

export function StatusPill({ value }: { value: string | null | undefined }) {
  const label = value ?? "UNKNOWN";
  return <Badge variant={toneForValue(label)}>{label.replaceAll("_", " ")}</Badge>;
}

export function SectionHeader({
  eyebrow,
  title,
  copy
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
          {title}
        </h1>
      </div>
      <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">{copy}</p>
    </div>
  );
}

export function FilterLink({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
        active
          ? "border-[#b9d5c3] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
      )}
    >
      {label}
    </Link>
  );
}

export function MetricCard({
  label,
  value,
  href
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <Card className="h-full p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">{value}</p>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function DetailList({
  items
}: {
  items: Array<{ label: string; value: string | number | null | undefined }>;
}) {
  return (
    <dl className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3"
        >
          <dt className="text-sm text-[var(--muted-foreground)]">{item.label}</dt>
          <dd className="text-right text-sm font-medium text-[var(--foreground)]">
            {item.value ?? "Unassigned"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
