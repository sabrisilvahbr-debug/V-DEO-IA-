import { withAuth } from "@/lib/server/http";
import { getJobResponse } from "@/lib/server/jobs/routes";

/** GET /api/generations/:id — estado da geração. */
export const GET = withAuth<{ id: string }>(async (_request, ctx, { id }) => getJobResponse(ctx, id, "generation"));
