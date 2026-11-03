import { quoteRequestSchema } from "@/lib/api/schemas";
import { parseJsonBody, withAuth } from "@/lib/server/http";
import { quoteGeneration } from "@/lib/server/jobs/enqueue";

/** POST /api/quotes — provedor escolhido e custo estimado, sem iniciar nada. */
export const POST = withAuth(async (request, ctx) => {
  const input = await parseJsonBody(request, quoteRequestSchema);
  const { routing } = await quoteGeneration(ctx, input);
  if (!routing.ok) {
    return Response.json({ ok: false, reason: routing.reason, rejected: routing.rejected });
  }
  return Response.json({
    ok: true,
    provider: { ...routing.provider.info, capabilities: routing.provider.capabilities },
    estimate: routing.provider.cost,
    alternatives: routing.alternatives.map((a) => ({ id: a.info.id, name: a.info.name, estimate: a.cost })),
  });
});
