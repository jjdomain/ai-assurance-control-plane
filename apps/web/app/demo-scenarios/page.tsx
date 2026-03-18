import Link from "next/link";
import { SectionHeader } from "../../components/console";
import { getDemoScenariosPageData } from "../../lib/data";

export default async function DemoScenariosPage() {
  const { scenarios } = await getDemoScenariosPageData();

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Seeded workflows"
        title="Demo Scenarios"
        copy="These scenarios demonstrate the closed-loop wedge: runtime event to material finding, retained evidence, review decision, incident or accepted risk, packet assembly, and recertification."
      />
      <section className="panel">
        <div className="mini-list">
          {scenarios.map((scenario) => (
            <Link key={scenario.runId} href={`/runs/${scenario.runId}`} className="list-card">
              <strong>{scenario.title}</strong>
              <p className="panel-subtitle">{scenario.summary}</p>
              <div className="queue-meta">
                <span>{scenario.systemName}</span>
                <span>{scenario.findingCount} findings</span>
                <span>{scenario.environment}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
