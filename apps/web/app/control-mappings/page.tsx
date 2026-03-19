import { saveControlMappingsAction } from "../actions";
import { DetailList, FlashBanner, SectionHeader, StatusPill } from "../../components/console";
import { getControlMappingsPageData } from "../../lib/data";

const flashMessages: Record<string, string> = {
  "mapping-saved": "Control mapping changes saved."
};

export default async function ControlMappingsPage({
  searchParams
}: {
  searchParams?: Promise<{ flash?: string; mappingId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { mappings, selectedMapping, availableControls, availableRetentionPolicies } = await getControlMappingsPageData(params.mappingId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Policy linkage"
        title="Control Mappings"
        copy="Mappings connect runtime logic to governance outcomes. They explain which controls a rule implicates, which retention policy applies, and what downstream workflow should open."
      />
      {params.flash && flashMessages[params.flash] ? <FlashBanner message={flashMessages[params.flash]} /> : null}
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Control</th>
                <th>Pack</th>
                <th>Case</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping: any) => (
                <tr key={mapping.id}>
                  <td>
                    <a href={`/control-mappings?mappingId=${mapping.id}`}>{mapping.ruleName}</a>
                    <div className="table-meta">{mapping.eventType}</div>
                  </td>
                  <td>{mapping.control.controlCode}</td>
                  <td>{mapping.control.packName}</td>
                  <td><StatusPill value={mapping.caseType} /></td>
                  <td>{mapping.matchedFindingsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedMapping ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected mapping</p>
                <h2>{selectedMapping.ruleName}</h2>
                <p className="lede">{selectedMapping.control.title}</p>
              </div>
              <DetailList
                items={[
                  { label: "Rule", value: selectedMapping.ruleId },
                  { label: "Control", value: selectedMapping.control.controlCode },
                  { label: "Policy pack", value: selectedMapping.control.packName },
                  { label: "Case type", value: selectedMapping.caseType },
                  { label: "Retention", value: selectedMapping.retentionPolicy?.name ?? "None" },
                  { label: "Matched findings", value: selectedMapping.matchedFindingsCount }
                ]}
              />
              <div className="detail-block">
                <h3>Edit mapping behavior</h3>
                <form action={saveControlMappingsAction} className="detail-grid">
                  <input type="hidden" name="ruleDefinitionId" value={selectedMapping.ruleDefinitionId} />
                  <input type="hidden" name="mappingId" value={selectedMapping.id} />
                  <label className="detail-block">
                    <span className="metric-label">Mapped Controls</span>
                    <input
                      name="controlMappings"
                      defaultValue={mappings
                        .filter((mapping: any) => mapping.ruleDefinitionId === selectedMapping.ruleDefinitionId)
                        .map((mapping: any) => mapping.control.controlCode)
                        .join(", ")}
                      className="input-field"
                      list="available-controls"
                    />
                  </label>
                  <label>
                    <span className="metric-label">Case Type</span>
                    <input name="caseType" defaultValue={selectedMapping.caseType} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Retention Policy</span>
                    <input
                      name="retentionPolicy"
                      defaultValue={selectedMapping.retentionPolicy?.name ?? ""}
                      className="input-field"
                      list="available-retention-policies"
                    />
                  </label>
                  <div className="action-form">
                    <button type="submit" className="button-primary">Save mapping config</button>
                  </div>
                </form>
                <datalist id="available-controls">
                  {availableControls.map((control: any) => (
                    <option key={control.code} value={control.code}>{control.label}</option>
                  ))}
                </datalist>
                <datalist id="available-retention-policies">
                  {availableRetentionPolicies.map((policy: string) => (
                    <option key={policy} value={policy} />
                  ))}
                </datalist>
              </div>
              <div className="detail-block">
                <h3>Control expectations</h3>
                <pre className="json-block">
                  {JSON.stringify(
                    {
                      impactLevel: selectedMapping.control.impactLevel,
                      evidenceRequirements: selectedMapping.control.evidenceRequirements ?? [],
                      reviewRequirements: selectedMapping.control.reviewRequirements ?? [],
                      relatedEventTypes: selectedMapping.control.relatedEventTypes ?? []
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
              <div className="detail-block">
                <h3>Downstream outcomes</h3>
                <div className="mini-list">
                  <div className="list-card">
                    <strong>Findings created</strong>
                    <div className="queue-meta">
                      <span>{selectedMapping.matchedFindingsCount}</span>
                      <span>Seeded matches</span>
                    </div>
                  </div>
                  <div className="list-card">
                    <strong>Incidents created</strong>
                    <div className="queue-meta">
                      <span>{selectedMapping.incidentsCount}</span>
                      <span>Escalations</span>
                    </div>
                  </div>
                  <div className="list-card">
                    <strong>Audit packets linked</strong>
                    <div className="queue-meta">
                      <span>{selectedMapping.packetsCount}</span>
                      <span>Exportable records</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p>No control mappings available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
