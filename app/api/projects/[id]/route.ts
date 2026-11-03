import { idSchema, updateProjectSchema } from "@/lib/api/schemas";
import { parseJsonBody, withAuth } from "@/lib/server/http";
import { deleteProject, requireProject, validateTimelineAssets } from "@/lib/server/services/projects";

type Params = { id: string };

/** GET /api/projects/:id — projeto com mídias e versões. */
export const GET = withAuth<Params>(async (_request, ctx, { id }) => {
  const project = await requireProject(ctx, idSchema.parse(id));
  const [assets, versions] = await Promise.all([
    ctx.store.listAssets(ctx.user.id, { projectId: project.id }),
    ctx.store.listVersions(ctx.user.id, project.id),
  ]);
  return Response.json({ project, assets, versions });
});

/** PATCH /api/projects/:id — renomeia, altera formato ou salva a timeline. */
export const PATCH = withAuth<Params>(async (request, ctx, { id }) => {
  const projectId = idSchema.parse(id);
  await requireProject(ctx, projectId);
  const patch = await parseJsonBody(request, updateProjectSchema);
  if (patch.timeline) await validateTimelineAssets(ctx, patch.timeline);
  const project = await ctx.store.updateProject(ctx.user.id, projectId, patch);
  return Response.json({ project });
});

/** DELETE /api/projects/:id — exclui projeto, mídias, tarefas e versões. */
export const DELETE = withAuth<Params>(async (_request, ctx, { id }) => {
  await deleteProject(ctx, idSchema.parse(id));
  return new Response(null, { status: 204 });
});
