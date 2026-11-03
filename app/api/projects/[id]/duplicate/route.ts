import { idSchema } from "@/lib/api/schemas";
import { withAuth } from "@/lib/server/http";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { duplicateProject } from "@/lib/server/services/projects";

/** POST /api/projects/:id/duplicate — cria uma cópia com as mídias. */
export const POST = withAuth<{ id: string }>(async (_request, ctx, { id }) => {
  checkRateLimit(`${ctx.user.id}:duplicate`, 10, 60_000);
  const project = await duplicateProject(ctx, idSchema.parse(id));
  return Response.json({ project }, { status: 201 });
});
