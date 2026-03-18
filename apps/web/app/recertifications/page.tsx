import Link from "next/link";
import { DetailList, SectionHeader, StatusPill } from "../../components/console";
import { getRecertificationsPageData } from "../../lib/data";

export default async function RecertificationsPage({
  searchParams
}: {
  searchParams?: Promise<{ taskId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { tasks, selectedTask } = await getRecertificationsPageData(params.taskId);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Change-triggered assurance"
        title="Recertifications"
        copy="Recertification is a first-class queue driven by model, prompt, tool, retention, and control changes that affect current assurance posture."
      />
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Trigger</th>
                <th>Owner</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link href={`/recertifications/${task.id}`}>{task.title}</Link>
                    <div className="table-meta">{task.reason ?? "No rationale provided"}</div>
                  </td>
                  <td><StatusPill value={task.status} /></td>
                  <td><StatusPill value={task.triggerType} /></td>
                  <td>{task.ownerUser?.displayName ?? "Unassigned"}</td>
                  <td>{task.dueAt?.toLocaleDateString() ?? "No due date"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedTask ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected task</p>
                <h2>{selectedTask.title}</h2>
                <p className="lede">{selectedTask.reason ?? "Complete the assurance review and signoff for this changed condition."}</p>
              </div>
              <DetailList
                items={[
                  { label: "Status", value: selectedTask.status },
                  { label: "Owner", value: selectedTask.ownerUser?.displayName },
                  { label: "Trigger ref", value: selectedTask.triggerRefType && selectedTask.triggerRefId ? `${selectedTask.triggerRefType}:${selectedTask.triggerRefId}` : "Not set" },
                  { label: "Due", value: selectedTask.dueAt?.toLocaleString() },
                  { label: "Completed", value: selectedTask.completedAt?.toLocaleString() }
                ]}
              />
              <div className="detail-block">
                <h3>Affected objects</h3>
                {selectedTask.finding ? (
                  <Link href={`/findings/${selectedTask.finding.id}`} className="list-card">
                    <strong>{selectedTask.finding.title}</strong>
                    <div className="queue-meta">
                      <StatusPill value={selectedTask.finding.workflowState} />
                    </div>
                  </Link>
                ) : null}
                {selectedTask.policyControl ? (
                  <Link href={`/controls/${selectedTask.policyControl.id}`} className="list-card">
                    <strong>{selectedTask.policyControl.code}</strong>
                    <div className="queue-meta">
                      <StatusPill value={selectedTask.policyControl.controlHealth} />
                    </div>
                  </Link>
                ) : null}
                {selectedTask.evidenceRecord ? (
                  <Link href={`/evidence/${selectedTask.evidenceRecord.id}`} className="list-card">
                    <strong>{selectedTask.evidenceRecord.title ?? selectedTask.evidenceRecord.evidenceType}</strong>
                    <div className="queue-meta">
                      <StatusPill value={selectedTask.evidenceRecord.freshnessState} />
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <p>No recertification tasks available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
