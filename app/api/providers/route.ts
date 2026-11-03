import { withAuth } from "@/lib/server/http";
import { listProviders, plannedProviders } from "@/providers/registry";

/** GET /api/providers — provedores implementados, disponibilidade e capacidades. */
export const GET = withAuth(async () => {
  const providers = await Promise.all(
    listProviders().map(async (provider) => ({
      ...provider.info(),
      availability: await provider.availability(),
      capabilities: await provider.getCapabilities(),
    })),
  );
  return Response.json({ providers, planned: plannedProviders });
});
