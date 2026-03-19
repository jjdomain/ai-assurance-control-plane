import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

const navGroups = [
  {
    title: "Ingest",
    links: [
      { href: "/connectors", label: "Connectors" },
      { href: "/runs", label: "Runs" },
      { href: "/demo-scenarios", label: "Demo Scenarios" }
    ]
  },
  {
    title: "Admin",
    links: [
      { href: "/admin", label: "Admin Console" },
      { href: "/rules", label: "Rules" },
      { href: "/policy-packs", label: "Policy Packs" },
      { href: "/control-mappings", label: "Control Mappings" },
      { href: "/settings", label: "Settings" }
    ]
  },
  {
    title: "Triage",
    links: [
      { href: "/findings", label: "Findings" },
      { href: "/evidence", label: "Evidence" },
      { href: "/reviews", label: "Reviews" }
    ]
  },
  {
    title: "Governance",
    links: [
      { href: "/controls", label: "Controls" },
      { href: "/retention", label: "Retention & Legal Hold" },
      { href: "/recertifications", label: "Recertifications" }
    ]
  },
  {
    title: "Outcomes",
    links: [
      { href: "/incidents", label: "Incidents" },
      { href: "/audit-packets", label: "Audit Packets" }
    ]
  }
] as const;

export const metadata: Metadata = {
  title: "AI Assurance Control Plane",
  description: "An assurance operations system of record for agentic AI."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-frame">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <span className="brand-mark">AIACP</span>
              <span>AI Assurance Control Plane</span>
            </Link>
            <nav className="nav-list">
              <section className="nav-group">
                <div className="nav-group-links">
                  <Link href="/overview">Dashboard</Link>
                </div>
              </section>
              {navGroups.map((group) => (
                <section key={group.title} className="nav-group">
                  <p className="nav-group-title">{group.title}</p>
                  <div className="nav-group-links">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
          </aside>
          <div className="content">{children}</div>
        </div>
      </body>
    </html>
  );
}
