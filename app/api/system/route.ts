import { serverConfig } from "@/lib/server/config";
import { withAuth } from "@/lib/server/http";
import { ffmpegStatus } from "@/lib/server/media/ffmpeg";

/** GET /api/system — modo de execução, FFmpeg e limites (sem segredos). */
export const GET = withAuth(async () => {
  const config = serverConfig();
  return Response.json({
    backend: config.backend,
    ffmpeg: await ffmpegStatus(),
    limits: {
      maxUploadMb: Math.round(config.maxUploadBytes / 1024 / 1024),
      maxVideoSeconds: config.maxVideoSeconds,
      maxResolution: config.maxResolution,
    },
  });
});
