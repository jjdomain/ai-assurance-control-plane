import {
  createRuleDefinitionAction,
  deleteRuleDefinitionAction,
  publishRuleDefinitionAction,
  saveRuleDefinitionAction,
  testRuleDefinitionAction,
  versionRuleDefinitionAction
} from "../actions";
import { DetailList, FlashBanner, SectionHeader, StatusPill } from "../../components/console";
import { getRulesPageData } from "../../lib/data";

const flashMessages: Record<string, string> = {
  "rule-created": "Rule created. Fill in the logic, mappings, and publish state before using it in the workflow.",
  "rule-saved": "Rule changes saved.",
  "rule-versioned": "A new draft rule version was created from the selected definition.",
  "rule-published": "Rule version published. Older versions for this slug were set to draft.",
  "rule-tested": "Rule test completed against the selected run.",
  "rule-deleted": "Rule version deleted."
};

export default async function RulesPage({
  searchParams
}: {
  searchParams?: Promise<{ flash?: string; ruleId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { rules, selectedRule, config, testingRuns } = await getRulesPageData(params.ruleId);
  const rule: any = selectedRule;

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Rule authoring"
        title="Rules"
        copy="Deterministic rule definitions decide what runtime behavior becomes governed assurance work. Each rule controls match conditions, scoring, policy mappings, case type, and retention posture."
      />
      {params.flash && flashMessages[params.flash] ? <FlashBanner message={flashMessages[params.flash]} /> : null}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Create rule</p>
            <h2>New rule definition</h2>
          </div>
        </div>
        <form action={createRuleDefinitionAction} className="action-form">
          <input name="name" type="text" placeholder="New rule name" className="input-field" />
          <input name="slug" type="text" placeholder="new-rule-slug" className="input-field" />
          <button type="submit" className="button-primary">Create rule</button>
        </form>
      </section>
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Event</th>
                <th>Severity</th>
                <th>Case</th>
                <th>Status</th>
                <th>Matches</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule: any) => (
                <tr key={rule.id}>
                  <td>
                    <a href={`/rules?ruleId=${rule.id}`}>{rule.name}</a>
                    <div className="table-meta">{rule.id}</div>
                  </td>
                  <td>{rule.eventType}</td>
                  <td><StatusPill value={rule.severityBase} /></td>
                  <td><StatusPill value={rule.caseType ?? "RUNTIME_REVIEW"} /></td>
                  <td><StatusPill value={rule.isActive ? "PUBLISHED" : "DRAFT"} /></td>
                  <td>{rule.matchedFindingsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {rule ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected rule</p>
                <h2>{rule.name}</h2>
                <div className="queue-meta">
                  <StatusPill value={rule.isActive ? "PUBLISHED" : "DRAFT"} />
                  <span>Version {rule.version ?? "1.0.0"}</span>
                  <span>{rule.sourceType ?? "ADMIN"}</span>
                </div>
                <p className="lede">{rule.summaryTemplate}</p>
              </div>
              <DetailList
                items={[
                  { label: "Rule ID", value: rule.id },
                  { label: "Slug", value: rule.slug },
                  { label: "Event type", value: rule.eventType },
                  { label: "Severity base", value: rule.severityBase },
                  { label: "Case type", value: rule.caseType ?? "RUNTIME_REVIEW" },
                  { label: "Retention", value: rule.retentionPolicy ?? "None" },
                  { label: "Triggered findings", value: rule.matchedFindingsCount }
                ]}
              />
              <div className="detail-block">
                <h3>Edit rule</h3>
                <form action={saveRuleDefinitionAction} className="detail-grid">
                  <input type="hidden" name="ruleDefinitionId" value={rule.id} />
                  <label>
                    <span className="metric-label">Name</span>
                    <input name="name" defaultValue={rule.name} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Slug</span>
                    <input name="slug" defaultValue={rule.slug ?? rule.id} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Version</span>
                    <input name="version" defaultValue={rule.version ?? "1.0.0"} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Source Type</span>
                    <input name="sourceType" defaultValue={rule.sourceType ?? "ADMIN"} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Event Type</span>
                    <input name="eventType" defaultValue={rule.eventType} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Severity Base</span>
                    <input name="severityBase" defaultValue={rule.severityBase} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Case Type</span>
                    <input name="caseType" defaultValue={rule.caseType ?? ""} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Retention Policy</span>
                    <input name="retentionPolicy" defaultValue={rule.retentionPolicy ?? ""} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Priority</span>
                    <input name="priority" type="number" defaultValue={rule.priority ?? 50} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Rule Family</span>
                    <input name="rootRuleFamily" defaultValue={rule.rootRuleFamily ?? "custom"} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Primary Target Field</span>
                    <input name="primaryTargetField" defaultValue={rule.primaryTargetField ?? ""} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Enabled</span>
                    <select name="enabled" defaultValue={rule.isActive ? "true" : "false"} className="input-field">
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Title Template</span>
                    <input name="titleTemplate" defaultValue={rule.titleTemplate} className="input-field" />
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Summary Template</span>
                    <textarea name="summaryTemplate" defaultValue={rule.summaryTemplate} className="json-block" rows={4} />
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Control Mappings</span>
                    <input
                      name="controlMappings"
                      defaultValue={(rule.controlMappings ?? []).join(", ")}
                      className="input-field"
                    />
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Conditions JSON</span>
                    <textarea name="conditionsJson" defaultValue={JSON.stringify(rule.conditions, null, 2)} className="json-block" rows={10} />
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Score Adjustments JSON</span>
                    <textarea
                      name="scoreAdjustmentsJson"
                      defaultValue={JSON.stringify(rule.scoreAdjustments ?? [], null, 2)}
                      className="json-block"
                      rows={8}
                    />
                  </label>
                  <div className="action-form">
                    <button type="submit" className="button-primary">Save rule</button>
                  </div>
                </form>
              </div>
              <div className="detail-block">
                <h3>Versioning and publish</h3>
                <div className="action-form">
                  <form action={versionRuleDefinitionAction}>
                    <input type="hidden" name="ruleDefinitionId" value={rule.id} />
                    <button type="submit" className="button-secondary">Create new version</button>
                  </form>
                  <form action={publishRuleDefinitionAction}>
                    <input type="hidden" name="ruleDefinitionId" value={rule.id} />
                    <button type="submit" className="button-primary">Publish version</button>
                  </form>
                  <form action={deleteRuleDefinitionAction}>
                    <input type="hidden" name="ruleDefinitionId" value={rule.id} />
                    <button type="submit" className="button-secondary">Delete version</button>
                  </form>
                </div>
              </div>
              <div className="detail-block">
                <h3>Engine config</h3>
                <pre className="json-block">{JSON.stringify(config, null, 2)}</pre>
              </div>
              <div className="detail-block">
                <h3>Match conditions</h3>
                <pre className="json-block">{JSON.stringify(rule.conditions, null, 2)}</pre>
              </div>
              <div className="detail-block">
                <h3>Score adjustments</h3>
                <pre className="json-block">{JSON.stringify(rule.scoreAdjustments ?? [], null, 2)}</pre>
              </div>
              <div className="detail-block">
                <h3>Mapped controls</h3>
                {rule.linkedControls.map((control: any) => (
                  <div key={`${rule.id}-${control.code}`} className="list-card">
                    <strong>{control.code}</strong>
                    <div className="queue-meta">
                      <span>{control.title}</span>
                      <span>{control.packName}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-block">
                <h3>Test rule</h3>
                <form action={testRuleDefinitionAction} className="action-form">
                  <input type="hidden" name="ruleDefinitionId" value={rule.id} />
                  <select name="runId" className="input-field" defaultValue="">
                    <option value="" disabled>Select a run</option>
                    {testingRuns.map((run: any) => (
                      <option key={run.id} value={run.id}>
                        {run.externalRunId} ({run.environment})
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="button-primary">Run test</button>
                </form>
                {rule.adminMetadata?.latestTestResult ? (
                  <pre className="json-block">
                    {JSON.stringify(rule.adminMetadata.latestTestResult, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : (
            <p>No rules available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
