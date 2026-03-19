import {
  createPolicyPackAction,
  deletePolicyControlAction,
  deletePolicyPackAction,
  deleteRetentionPolicyAction,
  publishPolicyPackAction,
  savePolicyControlAction,
  savePolicyPackAction,
  saveRetentionPolicyAction,
  versionPolicyPackAction
} from "../actions";
import { DetailList, FlashBanner, SectionHeader, StatusPill } from "../../components/console";
import { getPolicyPacksPageData } from "../../lib/data";

const flashMessages: Record<string, string> = {
  "pack-created": "Policy pack created. Add controls, retention policies, then publish when ready.",
  "pack-saved": "Policy pack changes saved.",
  "pack-versioned": "A new draft policy pack version was created from the selected pack.",
  "pack-published": "Policy pack published. Older versions for this slug were set to draft.",
  "pack-deleted": "Policy pack deleted.",
  "control-saved": "Control changes saved.",
  "control-deleted": "Control deleted.",
  "retention-saved": "Retention policy changes saved.",
  "retention-deleted": "Retention policy deleted."
};

export default async function PolicyPacksPage({
  searchParams
}: {
  searchParams?: Promise<{ flash?: string; packId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { packs, selectedPack } = await getPolicyPacksPageData(params.packId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Policy authoring"
        title="Policy Packs"
        copy="Policy packs define the governance vocabulary behind the workflow: control catalogs, categories, and retention schedules that turn logic matches into explainable assurance obligations."
      />
      {params.flash && flashMessages[params.flash] ? <FlashBanner message={flashMessages[params.flash]} /> : null}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Create pack</p>
            <h2>New policy pack</h2>
          </div>
        </div>
        <form action={createPolicyPackAction} className="action-form">
          <input name="name" type="text" placeholder="New policy pack" className="input-field" />
          <input name="slug" type="text" placeholder="new-policy-pack" className="input-field" />
          <button type="submit" className="button-primary">Create pack</button>
        </form>
      </section>
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Version</th>
                <th>Controls</th>
                <th>Retention</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <tr key={pack.id}>
                  <td><a href={`/policy-packs?packId=${pack.id}`}>{pack.name}</a></td>
                  <td>{pack.version}</td>
                  <td>{pack.controls.length}</td>
                  <td>{pack.retentionPolicies.length}</td>
                  <td><StatusPill value={pack.isActive ? "PUBLISHED" : "DRAFT"} /></td>
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
                <div className="queue-meta">
                  <StatusPill value={selectedPack.isActive ? "PUBLISHED" : "DRAFT"} />
                  <span>Version {selectedPack.version}</span>
                  <span>{selectedPack.sourceType}</span>
                </div>
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
                <h3>Edit policy pack</h3>
                <form action={savePolicyPackAction} className="detail-grid">
                  <input type="hidden" name="policyPackId" value={selectedPack.id} />
                  <label>
                    <span className="metric-label">Name</span>
                    <input name="name" defaultValue={selectedPack.name} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Slug</span>
                    <input name="slug" defaultValue={selectedPack.slug} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Version</span>
                    <input name="version" defaultValue={selectedPack.version} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Source Type</span>
                    <input name="sourceType" defaultValue={selectedPack.sourceType} className="input-field" />
                  </label>
                  <label>
                    <span className="metric-label">Published</span>
                    <select name="isActive" defaultValue={selectedPack.isActive ? "true" : "false"} className="input-field">
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Description</span>
                    <textarea name="description" defaultValue={selectedPack.description ?? ""} className="json-block" rows={4} />
                  </label>
                  <label className="detail-block">
                    <span className="metric-label">Categories JSON</span>
                    <textarea
                      name="categoriesJson"
                      defaultValue={JSON.stringify(selectedPack.categories ?? [], null, 2)}
                      className="json-block"
                      rows={8}
                    />
                  </label>
                  <div className="action-form">
                    <button type="submit" className="button-primary">Save pack</button>
                  </div>
                </form>
                <div className="action-form">
                  <form action={versionPolicyPackAction}>
                    <input type="hidden" name="policyPackId" value={selectedPack.id} />
                    <button type="submit" className="button-secondary">Create new version</button>
                  </form>
                  <form action={publishPolicyPackAction}>
                    <input type="hidden" name="policyPackId" value={selectedPack.id} />
                    <button type="submit" className="button-primary">Publish version</button>
                  </form>
                  <form action={deletePolicyPackAction}>
                    <input type="hidden" name="policyPackId" value={selectedPack.id} />
                    <button type="submit" className="button-secondary">Delete pack</button>
                  </form>
                </div>
              </div>
              <div className="detail-block">
                <h3>Categories</h3>
                <div className="chip-row">
                  {(selectedPack.categories ?? []).map((category: any) => (
                    <span key={category.code} className="chip">
                      {category.label ?? category.code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="detail-block">
                <h3>Controls</h3>
                {selectedPack.controls.map((control: any) => (
                  <form key={control.id} action={savePolicyControlAction} className="list-card">
                    <input type="hidden" name="policyPackId" value={selectedPack.id} />
                    <input type="hidden" name="policyControlId" value={control.id} />
                    <label>
                      <span className="metric-label">Code</span>
                      <input name="code" defaultValue={control.code} className="input-field" />
                    </label>
                    <label>
                      <span className="metric-label">Title</span>
                      <input name="title" defaultValue={control.title} className="input-field" />
                    </label>
                    <label>
                      <span className="metric-label">Category</span>
                      <input name="categoryCode" defaultValue={control.category ?? ""} className="input-field" />
                    </label>
                    <label>
                      <span className="metric-label">Impact</span>
                      <input name="impactLevel" defaultValue={control.impactLevel ?? ""} className="input-field" />
                    </label>
                    <label className="detail-block">
                      <span className="metric-label">Description</span>
                      <textarea name="description" defaultValue={control.description ?? ""} className="json-block" rows={3} />
                    </label>
                    <label>
                      <span className="metric-label">Review Cadence</span>
                      <input name="reviewCadence" defaultValue={control.reviewCadence ?? ""} className="input-field" />
                    </label>
                    <label>
                      <span className="metric-label">Freshness Requirement</span>
                      <input
                        name="evidenceFreshnessRequirement"
                        defaultValue={control.evidenceFreshnessRequirement ?? ""}
                        className="input-field"
                      />
                    </label>
                    <label>
                      <span className="metric-label">Human Approval</span>
                      <select name="requiresHumanApproval" defaultValue={control.requiresHumanApproval ? "true" : "false"} className="input-field">
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                    <label className="detail-block">
                      <span className="metric-label">Required Evidence Types JSON</span>
                      <textarea
                        name="requiredEvidenceTypesJson"
                        defaultValue={JSON.stringify(control.requiredEvidenceTypesJson ?? [], null, 2)}
                        className="json-block"
                        rows={4}
                      />
                    </label>
                    <label className="detail-block">
                      <span className="metric-label">Evidence Requirements JSON</span>
                      <textarea
                        name="evidenceRequirementsJson"
                        defaultValue={JSON.stringify(control.evidenceRequirements ?? [], null, 2)}
                        className="json-block"
                        rows={4}
                      />
                    </label>
                    <label className="detail-block">
                      <span className="metric-label">Review Requirements JSON</span>
                      <textarea
                        name="reviewRequirementsJson"
                        defaultValue={JSON.stringify(control.reviewRequirements ?? [], null, 2)}
                        className="json-block"
                        rows={4}
                      />
                    </label>
                    <label className="detail-block">
                      <span className="metric-label">Related Event Types JSON</span>
                      <textarea
                        name="relatedEventTypesJson"
                        defaultValue={JSON.stringify(control.relatedEventTypes ?? [], null, 2)}
                        className="json-block"
                        rows={4}
                      />
                    </label>
                    <div className="queue-meta">
                      <span>{control.category}</span>
                      <StatusPill value={control.controlHealth} />
                    </div>
                    <div className="action-form">
                      <button type="submit" className="button-primary">Save control</button>
                      <button formAction={deletePolicyControlAction} type="submit" className="button-secondary">Delete control</button>
                    </div>
                  </form>
                ))}
                <form action={savePolicyControlAction} className="list-card">
                  <input type="hidden" name="policyPackId" value={selectedPack.id} />
                  <strong>Add control</strong>
                  <input name="code" placeholder="CTRL-001" className="input-field" />
                  <input name="title" placeholder="Control title" className="input-field" />
                  <input name="categoryCode" placeholder="CATEGORY" className="input-field" />
                  <input name="impactLevel" placeholder="HIGH" className="input-field" />
                  <textarea name="description" placeholder="Description" className="json-block" rows={3} />
                  <button type="submit" className="button-primary">Add control</button>
                </form>
              </div>
              <div className="detail-block">
                <h3>Retention policies</h3>
                {(selectedPack.retentionPolicies ?? []).map((policy: any) => (
                  <form key={policy.id ?? policy.name} action={saveRetentionPolicyAction} className="list-card">
                    <input type="hidden" name="retentionPolicyId" value={policy.id} />
                    <input type="hidden" name="policyPackId" value={selectedPack.id} />
                    <input name="name" defaultValue={policy.name} className="input-field" />
                    <input name="scope" defaultValue={policy.scope} className="input-field" />
                    <input name="retentionClass" defaultValue={policy.retentionClass} className="input-field" />
                    <input name="retentionDays" defaultValue={policy.retentionDays ?? ""} className="input-field" />
                    <input name="deleteMode" defaultValue={policy.deleteMode} className="input-field" />
                    <select name="legalHoldAllowed" defaultValue={policy.legalHoldAllowed ? "true" : "false"} className="input-field">
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                    <textarea name="triggerSummary" defaultValue={policy.triggerSummary ?? ""} className="json-block" rows={3} />
                    <div className="action-form">
                      <button type="submit" className="button-primary">Save retention</button>
                      <button formAction={deleteRetentionPolicyAction} type="submit" className="button-secondary">Delete retention</button>
                    </div>
                  </form>
                ))}
                <form action={saveRetentionPolicyAction} className="list-card">
                  <input type="hidden" name="policyPackId" value={selectedPack.id} />
                  <strong>Add retention policy</strong>
                  <input name="name" placeholder="retain-review-90" className="input-field" />
                  <input name="scope" placeholder="CASE" className="input-field" />
                  <input name="retentionClass" placeholder="R90" className="input-field" />
                  <input name="retentionDays" placeholder="90" className="input-field" />
                  <input name="deleteMode" placeholder="SOFT_DELETE" className="input-field" />
                  <select name="legalHoldAllowed" defaultValue="true" className="input-field">
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <textarea name="triggerSummary" placeholder="Why this retention applies" className="json-block" rows={3} />
                  <button type="submit" className="button-primary">Add retention policy</button>
                </form>
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
