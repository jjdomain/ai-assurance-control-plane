import { DetailList, SectionHeader } from "../../components/console";
import { getSettingsPageData } from "../../lib/data";

export default async function SettingsPage() {
  const { workspaces } = await getSettingsPageData();
  const workspace = workspaces[0];

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Workspace settings"
        title="Settings"
        copy="The demo workspace carries seeded governance context for risk tiers, review templates, incident playbooks, and packet presets."
      />
      <section className="panel">
        {workspace ? (
          <div className="detail-grid">
            <div className="detail-block">
              <p className="eyebrow">Current workspace</p>
              <h2>{workspace.name}</h2>
              <p className="lede">{workspace.organization.name}</p>
            </div>
            <DetailList
              items={[
                { label: "Environment", value: workspace.environment },
                { label: "Profile", value: workspace.metadataJson?.profile },
                {
                  label: "Review templates",
                  value: workspace.metadataJson?.governanceContext?.reviewTemplates?.length ?? 0
                },
                {
                  label: "Incident playbooks",
                  value: workspace.metadataJson?.governanceContext?.incidentPlaybooks?.length ?? 0
                },
                {
                  label: "Audit packet presets",
                  value: workspace.metadataJson?.governanceContext?.auditPacketPresets?.length ?? 0
                }
              ]}
            />
            <pre className="json-block">{JSON.stringify(workspace.metadataJson, null, 2)}</pre>
          </div>
        ) : (
          <p>No workspace configuration available.</p>
        )}
      </section>
    </main>
  );
}
