import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { idSchema } from "@/lib/api/schemas";
import { HttpError, withAuth } from "@/lib/server/http";
import { parseRange } from "@/lib/server/range";
import { deleteAsset } from "@/lib/server/services/projects";

type Params = { id: string };

/**
 * GET /api/media/:id?variant=thumb&download=1
 * Serve a mídia do usuário com suporte a Range (necessário para o player).
 * No Supabase, redireciona para uma URL assinada de curta duração.
 */
export const GET = withAuth<Params>(async (request, ctx, { id }) => {
  const asset = await ctx.store.getAsset(ctx.user.id, idSchema.parse(id));
  if (!asset) throw new HttpError(404, "Mídia não encontrada.", "nao_encontrado");

  const url = new URL(request.url);
  const wantsThumb = url.searchParams.get("variant") === "thumb";
  const download = url.searchParams.get("download") === "1";
  const key = wantsThumb ? asset.thumbnailKey : asset.storageKey;
  if (!key) throw new HttpError(404, "Miniatura indisponível.", "sem_miniatura");

  const extension = asset.storageKey.split(".").pop();
  const baseName = asset.originalName.replace(/\.[^.]+$/, "");
  const downloadName = `${baseName}.${extension}`;
  const target = await ctx.storage.serveTarget(key, { downloadName: download ? downloadName : undefined });
  if (target.type === "url") return Response.redirect(target.url, 302);

  const { size } = await stat(target.path);
  const contentType = wantsThumb ? "image/jpeg" : asset.mimeType;
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  if (download) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  }

  const range = parseRange(request.headers.get("range"), size);
  if (request.headers.get("range") && !range) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  headers.set("Content-Length", String(end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  const stream = Readable.toWeb(createReadStream(target.path, { start, end })) as ReadableStream;
  return new Response(stream, { status: range ? 206 : 200, headers });
});

/** DELETE /api/media/:id — exclui a mídia e seus arquivos (se não estiver em uso). */
export const DELETE = withAuth<Params>(async (_request, ctx, { id }) => {
  await deleteAsset(ctx, idSchema.parse(id));
  return new Response(null, { status: 204 });
});
