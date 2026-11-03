import { z } from "zod";
import { idSchema } from "@/lib/api/schemas";
import { withAuth } from "@/lib/server/http";

const querySchema = z.object({
  projectId: idSchema.optional(),
  kind: z.enum(["video", "image", "audio"]).optional(),
  role: z.enum(["source", "reference", "generated", "render"]).optional(),
});

/** GET /api/assets?projectId=&kind=&role= — mídias do usuário. */
export const GET = withAuth(async (request, ctx) => {
  const filter = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const assets = await ctx.store.listAssets(ctx.user.id, filter);
  return Response.json({ assets });
});
