import ReviewsPage from "../page";

export default async function ReviewDetailPage({
  params
}: {
  params: Promise<{ reviewCaseId: string }>;
}) {
  const { reviewCaseId } = await params;
  return <ReviewsPage searchParams={Promise.resolve({ reviewId: reviewCaseId })} />;
}
