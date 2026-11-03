import { ffprobeBin, runBinary } from "./ffmpeg";
import { MediaValidationError } from "./validate";

export type ProbeResult = {
  formatName: string;
  durationSeconds: number | null;
  video: { codec: string; width: number; height: number } | null;
  hasAudio: boolean;
};

type FfprobeJson = {
  format?: { format_name?: string; duration?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string }>;
};

/** Interpreta a saída JSON do ffprobe. Exportada para testes. */
export function parseProbeOutput(raw: string): ProbeResult {
  const data = JSON.parse(raw) as FfprobeJson;
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video" && s.width && s.height);
  const audio = streams.find((s) => s.codec_type === "audio");
  const duration = Number(data.format?.duration ?? video?.duration);
  return {
    formatName: data.format?.format_name ?? "",
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
    video: video ? { codec: video.codec_name ?? "", width: Number(video.width), height: Number(video.height) } : null,
    hasAudio: Boolean(audio),
  };
}

export async function probeFile(filePath: string): Promise<ProbeResult> {
  const result = await runBinary(
    ffprobeBin(),
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { timeoutMs: 30_000 },
  );
  if (result.code !== 0) {
    throw new MediaValidationError(
      "O arquivo não pôde ser lido como mídia. Ele pode estar corrompido ou incompleto.",
      "Verifique se o arquivo abre no seu computador e exporte-o novamente.",
    );
  }
  try {
    return parseProbeOutput(result.stdout);
  } catch {
    throw new MediaValidationError("O arquivo não pôde ser lido como mídia.", "Exporte o arquivo novamente.");
  }
}
