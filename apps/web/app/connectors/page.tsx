import { SectionHeader, StatusPill } from "../../components/console";
import { getConnectorsPageData } from "../../lib/data";

export default async function ConnectorsPage() {
  const { connectors, workspaces } = await getConnectorsPageData();

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Upstream inputs"
        title="Connectors"
        copy="Connectors are upstream signal sources, not the product identity. They normalize runs and events into canonical assurance records."
      />
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Connector status</p>
              <h2>Signal sources</h2>
            </div>
          </div>
          <div className="mini-list">
            {connectors.map((connector) => (
              <div key={connector.id} className="list-card">
                <strong>{connector.name}</strong>
                <div className="queue-meta">
                  <StatusPill value={connector.status} />
                  <span>{connector.connectorType}</span>
                  <span>{connector.system?.name ?? "Shared workspace input"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Workspace context</p>
              <h2>Governance-enabled workspaces</h2>
            </div>
          </div>
          <div className="mini-list">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="list-card">
                <strong>{workspace.name}</strong>
                <div className="queue-meta">
                  <span>{workspace.organization.name}</span>
                  <span>{workspace.environment}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
