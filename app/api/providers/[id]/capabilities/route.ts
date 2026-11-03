import { HttpError, withAuth } from "@/lib/server/http";
import { getProvider } from "@/providers/registry";

/** GET /api/providers/:id/capabilities */
export const GET = withAuth<{ id: string }>(async (_request, _ctx, { id }) => {
  const provider = getProvider(id);
  if (!provider) throw new HttpError(404, "Provedor não encontrado.", "nao_encontrado");
  return Response.json({
    provider: provider.info(),
    availability: await provider.availability(),
    capabilities: await provider.getCapabilities(),
  });
});
