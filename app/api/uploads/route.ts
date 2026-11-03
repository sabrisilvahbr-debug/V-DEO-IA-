import { rm } from "node:fs/promises";
import path from "node:path";
import { uploadQuerySchema } from "@/lib/api/schemas";
import { serverConfig } from "@/lib/server/config";
import { HttpError, withAuth } from "@/lib/server/http";
import { requireFfmpeg } from "@/lib/server/media/ffmpeg";
import { ingestMediaFile, makeTempDir, streamToTempFile } from "@/lib/server/media/ingest";
import { MediaValidationError } from "@/lib/server/media/validate";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { requireProject } from "@/lib/server/services/projects";

/**
 * POST /api/uploads?projectId=&role=&name=&origin=&rights=1
 * Corpo: bytes do arquivo (application/octet-stream).
 *
 * O arquivo é gravado em disco em streaming, com limite de tamanho, e só é
 * registrado depois de validado pelo conteúdo e pelo ffprobe.
 */
export const POST = withAuth(async (request, ctx) => {
  checkRateLimit(`${ctx.user.id}:upload`, 20, 60_000);
  const config = serverConfig();
  const query = uploadQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  if (query.projectId) await requireProject(ctx, query.projectId);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > config.maxUploadBytes) {
    throw new HttpError(413, `O arquivo excede o limite de ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`, "arquivo_grande");
  }
  if (!request.body) throw new HttpError(400, "Nenhum arquivo recebido.", "sem_arquivo");

  await requireFfmpeg().catch((error: Error) => {
    throw new HttpError(503, error.message, "ffmpeg_indisponivel");
  });

  const dir = await makeTempDir("upload");
  const filePath = path.join(dir, "upload.bin");
  try {
    await streamToTempFile(request.body, filePath, config.maxUploadBytes);
    const asset = await ingestMediaFile(ctx, {
      ownerId: ctx.user.id,
      projectId: query.projectId,
      role: query.role,
      filePath,
      originalName: query.name,
      origin: query.origin,
      rightsConfirmed: true,
    });
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      const status = /limite de .* MB/.test(error.message) ? 413 : 422;
      throw new HttpError(status, error.message, "midia_invalida", { hint: error.hint });
    }
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
