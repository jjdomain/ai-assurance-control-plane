import Link from "next/link";
import { acceptRiskAction, closeReviewAction } from "../actions";
import { DetailList, FilterLink, SectionHeader, StatusPill } from "../../components/console";
import { getReviewsPageData } from "../../lib/data";

export default async function ReviewsPage({
  searchParams
}: {
  searchParams?: Promise<{ reviewId?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { reviews, selectedReview } = await getReviewsPageData(params.reviewId, params.status);

  return (
    <main className="console-page">
      <SectionHeader
        eyebrow="Review workload"
        title="Reviews"
        copy="Decision workspaces with required evidence, SLA state, second-approver handling, and structured accepted-risk paths."
      />
      <div className="toolbar">
        <FilterLink href="/reviews" label="All" active={!params.status} />
        <FilterLink href="/reviews?status=OPEN" label="Open" active={params.status === "OPEN"} />
        <FilterLink href="/reviews?status=PENDING_APPROVER" label="Needs approval" active={params.status === "PENDING_APPROVER"} />
        <FilterLink href="/reviews?status=DECIDED" label="Decided" active={params.status === "DECIDED"} />
      </div>
      <div className="split-layout">
        <section className="table-panel">
          <table className="console-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Reviewer</th>
                <th>Approvals</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>
                    <Link href={`/reviews/${review.id}`}>{review.title ?? review.finding?.title ?? review.id}</Link>
                    <div className="table-meta">{review.reviewType}</div>
                  </td>
                  <td><StatusPill value={review.workflowStatus} /></td>
                  <td><StatusPill value={review.slaState} /></td>
                  <td>{review.reviewerUser?.displayName ?? review.assignedTeam ?? "Unassigned"}</td>
                  <td>{review.approvalRequests.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="detail-panel">
          {selectedReview ? (
            <div className="detail-grid">
              <div className="detail-block">
                <p className="eyebrow">Selected review</p>
                <h2>{selectedReview.title ?? selectedReview.finding?.title ?? selectedReview.id}</h2>
                <p className="lede">{selectedReview.summary ?? "Review evidence, signoff requirements, and downstream action."}</p>
              </div>
              <DetailList
                items={[
                  { label: "Workflow", value: selectedReview.workflowStatus },
                  { label: "Due", value: selectedReview.dueAt?.toLocaleString() },
                  { label: "Decision", value: selectedReview.decisionType },
                  { label: "Accepted risk until", value: selectedReview.acceptedRiskUntil?.toLocaleDateString() },
                  { label: "Needs second approver", value: selectedReview.requiresSecondApprover ? "Yes" : "No" }
                ]}
              />
              <div className="detail-block">
                <h3>Required evidence</h3>
                <pre className="json-block">
                  {JSON.stringify(selectedReview.requiredEvidenceChecklistJson ?? [], null, 2)}
                </pre>
              </div>
              <div className="detail-block">
                <h3>Approvals</h3>
                {selectedReview.approvalRequests.map((approval) => (
                  <div key={approval.id} className="list-card">
                    <strong>{approval.approvalType}</strong>
                    <div className="queue-meta">
                      <StatusPill value={approval.status} />
                      <span>{approval.dueAt?.toLocaleString() ?? "No due date"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="detail-block">
                <h3>Linked evidence</h3>
                {selectedReview.finding?.evidence.map((record) => (
                  <Link key={record.id} href={`/evidence/${record.id}`} className="list-card">
                    <strong>{record.title ?? record.evidenceType}</strong>
                    <div className="queue-meta">
                      <StatusPill value={record.freshnessState} />
                      <StatusPill value={record.approvedForAudit ? "APPROVED" : "REVIEW_REQUIRED"} />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="detail-block">
                <h3>Actions</h3>
                <form action={closeReviewAction} className="action-form">
                  <input type="hidden" name="reviewCaseId" value={selectedReview.id} />
                  <input type="hidden" name="disposition" value="APPROVED" />
                  <input type="hidden" name="rationale" value="Approved from the review queue." />
                  <button type="submit" className="button-primary">Approve review</button>
                </form>
                {selectedReview.finding ? (
                  <form action={acceptRiskAction} className="action-form">
                    <input type="hidden" name="findingId" value={selectedReview.finding.id} />
                    <button type="submit" className="button-secondary">Accept risk with expiry</button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : (
            <p>No reviews available.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
