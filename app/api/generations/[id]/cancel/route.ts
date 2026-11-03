import { withAuth } from "@/lib/server/http";
import { cancelJobResponse } from "@/lib/server/jobs/routes";

/** POST /api/generations/:id/cancel — solicita o cancelamento. */
export const POST = withAuth<{ id: string }>(async (_request, ctx, { id }) => cancelJobResponse(ctx, id, "generation"));
