import { withAuth } from "@/lib/server/http";
import { cancelJobResponse } from "@/lib/server/jobs/routes";

/** POST /api/jobs/:id/cancel — cancela qualquer tarefa do usuário. */
export const POST = withAuth<{ id: string }>(async (_request, ctx, { id }) => cancelJobResponse(ctx, id));
