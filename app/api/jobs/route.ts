import { z } from "zod";
import { idSchema } from "@/lib/api/schemas";
import { withAuth } from "@/lib/server/http";
import { toPublicJob } from "@/lib/server/jobs/public";

const querySchema = z.object({
  projectId: idSchema.optional(),
  active: z.enum(["1", "0"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** GET /api/jobs?projectId=&active=1 — tarefas do usuário. */
export const GET = withAuth(async (request, ctx) => {
  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const jobs = await ctx.store.listJobs(ctx.user.id, {
    projectId: query.projectId,
    statuses: query.active === "1" ? ["queued", "running"] : undefined,
    limit: query.limit,
  });
  return Response.json({ jobs: jobs.map(toPublicJob) });
});
