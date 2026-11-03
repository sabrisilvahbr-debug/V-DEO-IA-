import { sceneDetectRequestSchema } from "@/lib/api/schemas";
import { parseJsonBody, withAuth } from "@/lib/server/http";
import { createSceneDetectJob } from "@/lib/server/jobs/enqueue";
import { toPublicJob } from "@/lib/server/jobs/public";

/** POST /api/scene-detections — sugere cortes por mudança de cena. */
export const POST = withAuth(async (request, ctx) => {
  const input = await parseJsonBody(request, sceneDetectRequestSchema);
  const { job, created } = await createSceneDetectJob(ctx, input);
  return Response.json({ job: toPublicJob(job), created }, { status: created ? 202 : 200 });
});
