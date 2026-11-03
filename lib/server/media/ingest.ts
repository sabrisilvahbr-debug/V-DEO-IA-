import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { MediaAsset, MediaRole } from "@/lib/domain/types";
import { serverConfig } from "../config";
import type { BlobStorage } from "../storage/types";
import { buildStorageKey } from "../storage/types";
import type { UserDataStore } from "../store/types";
import { runFfmpeg } from "./ffmpeg";
import { probeFile } from "./probe";
import { ACCEPTED_FORMATS_LABEL, detectFileType, MediaValidationError, sanitizeDisplayName, validateProbe } from "./validate";

export class UploadTooLargeError extends MediaValidationError {}

/** Cria uma pasta temporária exclusiva dentro de CINEMORPH_DATA_DIR/tmp. */
export async function makeTempDir(prefix: string): Promise<string> {
  const dir = path.join(serverConfig().tmpDir, `${prefix}-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Grava o corpo da requisição em disco interrompendo assim que o limite de
 * tamanho é ultrapassado (o arquivo nunca é carregado inteiro na memória).
 */
export async function streamToTempFile(body: ReadableStream<Uint8Array>, targetPath: string, maxBytes: number) {
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(
          new UploadTooLargeError(
            `O arquivo excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
            "Comprima o vídeo ou envie um trecho menor.",
          ),
        );
        return;
      }
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), limiter, createWriteStream(targetPath));
  return received;
}

async function readHeader(filePath: string): Promise<Uint8Array> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(64);
    const { bytesRead } = await handle.read(buffer, 0, 64, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

/** Gera miniatura JPEG (máx. 480 px) a partir de vídeo ou imagem. */
async function makeThumbnail(input: string, output: string, kind: MediaAsset["kind"], durationSeconds: number | null) {
  const seek = kind === "video" ? Math.min(1, (durationSeconds ?? 0) / 2) : 0;
  await runFfmpeg(
    [
      ...(kind === "video" ? ["-ss", seek.toFixed(2)] : []),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(480,iw)':-2",
      "-q:v",
      "4",
      output,
    ],
    { timeoutMs: 60_000 },
  );
}

export type IngestOptions = {
  ownerId: string;
  projectId: string | null;
  role: MediaRole;
  filePath: string;
  originalName: string;
  origin: string | null;
  rightsConfirmed: boolean;
  isDemo?: boolean;
};

/**
 * Valida um arquivo já gravado em disco e o registra: detecta o tipo pelo
 * conteúdo, lê metadados com ffprobe, aplica limites, gera miniatura, envia
 * ao armazenamento e cria o registro. Em qualquer falha, nada é registrado.
 */
export async function ingestMediaFile(
  deps: { store: UserDataStore; storage: BlobStorage },
  options: IngestOptions,
): Promise<MediaAsset> {
  const config = serverConfig();
  const { size } = await stat(options.filePath);
  if (size === 0) throw new MediaValidationError("O arquivo está vazio.", "Verifique se o envio terminou corretamente.");
  if (size > config.maxUploadBytes) {
    throw new UploadTooLargeError(
      `O arquivo excede o limite de ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB.`,
      "Comprima o vídeo ou envie um trecho menor.",
    );
  }

  const detected = detectFileType(await readHeader(options.filePath));
  if (!detected) {
    throw new MediaValidationError("Formato não reconhecido pelo conteúdo do arquivo.", `Envie ${ACCEPTED_FORMATS_LABEL}.`);
  }

  const probe = await probeFile(options.filePath);
  validateProbe(detected, probe, {
    maxBytes: config.maxUploadBytes,
    maxVideoSeconds: config.maxVideoSeconds,
    maxResolution: config.maxResolution,
  });

  const assetId = `ast_${randomUUID().replace(/-/g, "")}`;
  const storageKey = buildStorageKey(options.ownerId, assetId, `original.${detected.extension}`);
  const workDir = await makeTempDir("ingest");
  let thumbnailKey: string | null = null;

  try {
    const sha256 = await sha256File(options.filePath);
    if (detected.kind !== "audio") {
      const thumbPath = path.join(workDir, "thumb.jpg");
      try {
        await makeThumbnail(options.filePath, thumbPath, detected.kind, probe.durationSeconds);
        thumbnailKey = buildStorageKey(options.ownerId, assetId, "thumb.jpg");
        await deps.storage.put(thumbnailKey, thumbPath, "image/jpeg");
      } catch {
        thumbnailKey = null; // miniatura é opcional
      }
    }
    await deps.storage.put(storageKey, options.filePath, detected.mimeType);

    return await deps.store.createAsset(options.ownerId, {
      id: assetId,
      projectId: options.projectId,
      kind: detected.kind,
      role: options.role,
      originalName: sanitizeDisplayName(options.originalName),
      storageKey,
      thumbnailKey,
      mimeType: detected.mimeType,
      sizeBytes: size,
      durationMs: probe.durationSeconds ? Math.round(probe.durationSeconds * 1000) : null,
      width: probe.video?.width ?? null,
      height: probe.video?.height ?? null,
      hasAudio: probe.hasAudio,
      sha256,
      origin: options.origin,
      rightsConfirmed: options.rightsConfirmed,
      isDemo: options.isDemo ?? false,
    });
  } catch (error) {
    await deps.storage.removePrefix(`${options.ownerId}/${assetId}/`).catch(() => {});
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
