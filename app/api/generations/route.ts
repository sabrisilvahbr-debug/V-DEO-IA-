import { generationRequestSchema } from "@/lib/api/schemas";
import { createGenerationJob } from "@/lib/server/jobs/enqueue";
import { toPublicJob } from "@/lib/server/jobs/public";
import { parseJsonBody, withAuth } from "@/lib/server/http";

/**
 * POST /api/generations — enfileira uma geração. Idempotente por
 * `clientRequestId`: reenvios devolvem a mesma tarefa (sem cobrança dupla).
 */
export const POST = withAuth(async (request, ctx) => {
  const input = await parseJsonBody(request, generationRequestSchema);
  const { job, created } = await createGenerationJob(ctx, input);
  return Response.json({ job: toPublicJob(job), created }, { status: created ? 202 : 200 });
});
