import { withAuth } from "@/lib/server/http";
import { getJobResponse } from "@/lib/server/jobs/routes";

/** GET /api/renders/:id — estado da renderização. */
export const GET = withAuth<{ id: string }>(async (_request, ctx, { id }) => getJobResponse(ctx, id, "render"));
