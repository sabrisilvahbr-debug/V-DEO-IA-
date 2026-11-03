import { renderRequestSchema } from "@/lib/api/schemas";
import { parseJsonBody, withAuth } from "@/lib/server/http";
import { createRenderJob } from "@/lib/server/jobs/enqueue";
import { toPublicJob } from "@/lib/server/jobs/public";

/** POST /api/renders — enfileira a exportação da timeline salva do projeto. */
export const POST = withAuth(async (request, ctx) => {
  const input = await parseJsonBody(request, renderRequestSchema);
  const { job, created } = await createRenderJob(ctx, input);
  return Response.json({ job: toPublicJob(job), created }, { status: created ? 202 : 200 });
});
