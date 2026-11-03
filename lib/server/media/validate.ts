import type { MediaKind } from "@/lib/domain/types";
import type { ProbeResult } from "./probe";

/**
 * Validação de arquivos enviados. O tipo é detectado pelo conteúdo
 * (assinatura binária), não pela extensão nem pelo Content-Type do navegador.
 */
export type DetectedType = { kind: MediaKind; mimeType: string; extension: string };

export class MediaValidationError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
  }
}

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

export function detectFileType(header: Uint8Array): DetectedType | null {
  if (header.length < 12) return null;

  // ISO BMFF (MP4/MOV/M4A): "ftyp" no byte 4
  if (ascii(header, 4, 4) === "ftyp") {
    const brand = ascii(header, 8, 4);
    if (brand === "qt  ") return { kind: "video", mimeType: "video/quicktime", extension: "mov" };
    if (brand.startsWith("M4A")) return { kind: "audio", mimeType: "audio/mp4", extension: "m4a" };
    return { kind: "video", mimeType: "video/mp4", extension: "mp4" };
  }
  // Matroska / WebM (EBML)
  if (header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
    const text = ascii(header, 0, Math.min(header.length, 64));
    return text.includes("webm")
      ? { kind: "video", mimeType: "video/webm", extension: "webm" }
      : { kind: "video", mimeType: "video/x-matroska", extension: "mkv" };
  }
  // Imagens
  if (header[0] === 0x89 && ascii(header, 1, 3) === "PNG") return { kind: "image", mimeType: "image/png", extension: "png" };
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return { kind: "image", mimeType: "image/jpeg", extension: "jpg" };
  if (ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 4) === "WEBP") return { kind: "image", mimeType: "image/webp", extension: "webp" };
  // Áudio
  if (ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 4) === "WAVE") return { kind: "audio", mimeType: "audio/wav", extension: "wav" };
  if (ascii(header, 0, 3) === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) {
    return { kind: "audio", mimeType: "audio/mpeg", extension: "mp3" };
  }
  return null;
}

export const ACCEPTED_FORMATS_LABEL = "MP4, MOV, WebM, MKV, PNG, JPG, WebP, MP3, WAV ou M4A";

export type ValidationLimits = { maxBytes: number; maxVideoSeconds: number; maxResolution: number };

/** Confere o resultado do ffprobe contra o tipo detectado e os limites. */
export function validateProbe(detected: DetectedType, probe: ProbeResult, limits: ValidationLimits) {
  if (detected.kind === "video") {
    if (!probe.video) {
      throw new MediaValidationError("O arquivo não contém uma faixa de vídeo legível.", "Exporte novamente como MP4 (H.264).");
    }
    if (!probe.durationSeconds) {
      throw new MediaValidationError("Não foi possível determinar a duração do vídeo.", "Reexporte o arquivo; ele pode estar incompleto.");
    }
    if (probe.durationSeconds > limits.maxVideoSeconds) {
      throw new MediaValidationError(
        `O vídeo tem ${Math.round(probe.durationSeconds)} s; o máximo é ${limits.maxVideoSeconds} s.`,
        "Corte o vídeo em partes menores antes de enviar.",
      );
    }
  }
  if (detected.kind === "image" && !probe.video) {
    throw new MediaValidationError("A imagem não pôde ser decodificada.", "Salve novamente como PNG ou JPG.");
  }
  if (detected.kind === "audio") {
    if (!probe.hasAudio) {
      throw new MediaValidationError("O arquivo não contém áudio legível.", "Exporte novamente como MP3 ou WAV.");
    }
    if (probe.durationSeconds && probe.durationSeconds > limits.maxVideoSeconds) {
      throw new MediaValidationError(
        `O áudio tem ${Math.round(probe.durationSeconds)} s; o máximo é ${limits.maxVideoSeconds} s.`,
        "Corte o áudio antes de enviar.",
      );
    }
  }
  if (probe.video && Math.max(probe.video.width, probe.video.height) > limits.maxResolution) {
    throw new MediaValidationError(
      `Resolução ${probe.video.width}×${probe.video.height} acima do limite de ${limits.maxResolution} px.`,
      "Reduza a resolução para 4K ou menos.",
    );
  }
}

/** Nome exibido: remove caminhos e caracteres de controle, limita o tamanho. */
export function sanitizeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (clean || "arquivo").slice(0, 160);
}
