import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getPolicyPacksPageData } from "../../lib/data";

export default async function PolicyPacksPage({
  searchParams
}: {
  searchParams?: Promise<{ packId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { packs, selectedPack } = await getPolicyPacksPageData(params.packId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Governance context"
        title="Policy Packs"
        copy="Governance-oriented policy packs supply the control and retention context that explains why a finding, review, or packet exists."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Version</th>
                <th>Controls</th>
                <th>Retention</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id}>
                  <td><a href={`/policy-packs?packId=${pack.id}`}>{pack.name}</a></td>
                  <td>{pack.version}</td>
                  <td>{pack.controls.length}</td>
                  <td>{pack.retentionPolicies.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedPack ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected policy pack</p>
                <h2>{selectedPack.name}</h2>
                <p className="lede">Policy and control context for the seeded assurance workflows.</p>
              </div>
              <DetailList
                items={[
                  { label: "Source type", value: selectedPack.sourceType },
                  { label: "Version", value: selectedPack.version },
                  { label: "Controls", value: selectedPack.controls.length },
                  { label: "Retention policies", value: selectedPack.retentionPolicies.length }
                ]}
              />
              <div className="detail-block">
                <h3>Controls</h3>
                {selectedPack.controls.slice(0, 8).map((control: any) => (
                  <div key={control.id} className="list-card">
                    <strong>{control.code}</strong>
                    <div className="queue-meta">
                      <span>{control.title}</span>
                      <StatusPill value={control.controlHealth} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No policy packs available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
