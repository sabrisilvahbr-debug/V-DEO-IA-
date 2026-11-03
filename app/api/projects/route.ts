import { createProjectSchema } from "@/lib/api/schemas";
import { parseJsonBody, withAuth } from "@/lib/server/http";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createProject } from "@/lib/server/services/projects";

/** GET /api/projects?search= — lista os projetos do usuário. */
export const GET = withAuth(async (request, ctx) => {
  const search = new URL(request.url).searchParams.get("search")?.slice(0, 120) ?? undefined;
  const projects = await ctx.store.listProjects(ctx.user.id, { search });
  return Response.json({ projects });
});

/** POST /api/projects — cria um projeto. */
export const POST = withAuth(async (request, ctx) => {
  checkRateLimit(`${ctx.user.id}:create-project`, 30, 60_000);
  const input = await parseJsonBody(request, createProjectSchema);
  const project = await createProject(ctx, input);
  return Response.json({ project }, { status: 201 });
});
