import { saveRuleEngineConfigAction } from "../actions";
import { DetailList, FlashBanner, SectionHeader } from "../../components/console";
import { getSettingsPageData } from "../../lib/data";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ flash?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { workspaces } = await getSettingsPageData();
  const workspace = workspaces[0];
  const metadata = workspace?.metadataJson && typeof workspace.metadataJson === "object" && !Array.isArray(workspace.metadataJson)
    ? (workspace.metadataJson as Record<string, any>)
    : {};
  const governanceContext = metadata.governanceContext ?? {};

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Workspace settings"
        title="Settings"
        copy="The demo workspace carries seeded governance context for risk tiers, review templates, incident playbooks, and packet presets."
      />
      {params.flash === "config-saved" ? <FlashBanner message="Rule engine configuration saved." /> : null}
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
                { label: "Profile", value: metadata.profile },
                {
                  label: "Review templates",
                  value: governanceContext.reviewTemplates?.length ?? 0
                },
                {
                  label: "Incident playbooks",
                  value: governanceContext.incidentPlaybooks?.length ?? 0
                },
                {
                  label: "Audit packet presets",
                  value: governanceContext.auditPacketPresets?.length ?? 0
                }
              ]}
            />
            <div className="detail-block">
              <h3>Rule engine config</h3>
              <form action={saveRuleEngineConfigAction} className="detail-grid">
                <textarea
                  name="ruleEngineConfigJson"
                  defaultValue={JSON.stringify(governanceContext.ruleEngineConfig ?? {}, null, 2)}
                  className="json-block"
                  rows={8}
                />
                <div className="action-form">
                  <button type="submit" className="button-primary">Save config</button>
                </div>
              </form>
            </div>
            <pre className="json-block">{JSON.stringify(workspace.metadataJson, null, 2)}</pre>
          </div>
        ) : (
          <p>No workspace configuration available.</p>
        )}
      </section>
    </main>
  );
}
