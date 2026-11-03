import { clipDuration, timelineDuration, type Quality, type Timeline } from "@/lib/domain/timeline";
import type { AspectRatio } from "@/lib/domain/types";

/**
 * Monta os argumentos do FFmpeg para renderizar a timeline. Função pura:
 * recebe caminhos já resolvidos e devolve o comando, sem executar nada.
 */
export const OUTPUT_SIZES: Record<AspectRatio, Record<"low" | "full", { width: number; height: number }>> = {
  "16:9": { low: { width: 1280, height: 720 }, full: { width: 1920, height: 1080 } },
  "9:16": { low: { width: 720, height: 1280 }, full: { width: 1080, height: 1920 } },
  "1:1": { low: { width: 720, height: 720 }, full: { width: 1080, height: 1080 } },
};

export const QUALITY_PRESETS: Record<Quality, { size: "low" | "full"; crf: number; preset: string; audioBitrate: string; label: string }> = {
  draft: { size: "low", crf: 28, preset: "veryfast", audioBitrate: "128k", label: "Rascunho 720p" },
  standard: { size: "full", crf: 23, preset: "medium", audioBitrate: "160k", label: "Padrão 1080p" },
  high: { size: "full", crf: 18, preset: "slow", audioBitrate: "192k", label: "Alta 1080p" },
};

export type RenderSource = { path: string; kind: "video" | "image" | "audio"; hasAudio: boolean };

export type RenderPlanInput = {
  timeline: Timeline;
  sources: Map<string, RenderSource>;
  outputPath: string;
  /** Caminho do .srt quando as legendas devem ser gravadas no vídeo. */
  subtitlesPath?: string | null;
  fps?: number;
};

export type RenderPlan = { args: string[]; durationSeconds: number; width: number; height: number };

const n = (value: number) => Number(value.toFixed(3)).toString();

/** Escapa um caminho para uso dentro de um argumento de filtro do FFmpeg. */
export function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,");
}

export function buildRenderPlan({ timeline, sources, outputPath, subtitlesPath, fps = 30 }: RenderPlanInput): RenderPlan {
  if (timeline.clips.length === 0) throw new Error("A timeline está vazia.");
  const preset = QUALITY_PRESETS[timeline.output.quality];
  const { width, height } = OUTPUT_SIZES[timeline.output.aspectRatio][preset.size];
  const total = timelineDuration(timeline);

  const inputs: string[] = [];
  const filters: string[] = [];
  const concatPads: string[] = [];
  let inputIndex = 0;

  timeline.clips.forEach((clip, i) => {
    const source = sources.get(clip.assetId);
    if (!source) throw new Error(`Mídia ausente para o clipe ${clip.id}.`);
    const duration = clipDuration(clip);

    const videoIndex = inputIndex++;
    if (clip.kind === "image") {
      inputs.push("-loop", "1", "-framerate", String(fps), "-t", n(duration), "-i", source.path);
    } else {
      inputs.push("-ss", n(clip.in), "-t", n(duration), "-i", source.path);
    }

    const { brightness, contrast, saturation } = clip.color;
    const eq =
      brightness !== 0 || contrast !== 1 || saturation !== 1
        ? `,eq=brightness=${n(brightness)}:contrast=${n(contrast)}:saturation=${n(saturation)}`
        : "";
    filters.push(
      `[${videoIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps},format=yuv420p${eq},` +
        `trim=duration=${n(duration)},setpts=PTS-STARTPTS[v${i}]`,
    );

    const useSourceAudio = clip.kind === "video" && source.hasAudio && !clip.muted && clip.volume > 0;
    if (useSourceAudio) {
      filters.push(
        `[${videoIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${n(clip.volume)},` +
          `atrim=duration=${n(duration)},asetpts=PTS-STARTPTS,apad=whole_dur=${n(duration)}[a${i}]`,
      );
    } else {
      const silenceIndex = inputIndex++;
      inputs.push("-f", "lavfi", "-t", n(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
      filters.push(`[${silenceIndex}:a]asetpts=PTS-STARTPTS[a${i}]`);
    }
    concatPads.push(`[v${i}][a${i}]`);
  });

  filters.push(`${concatPads.join("")}concat=n=${timeline.clips.length}:v=1:a=1[vcat][acat]`);

  let videoOut = "[vcat]";
  if (subtitlesPath) {
    filters.push(`[vcat]subtitles=filename='${escapeFilterPath(subtitlesPath)}'[vsub]`);
    videoOut = "[vsub]";
  }

  let audioOut = "[acat]";
  if (timeline.music) {
    const music = sources.get(timeline.music.assetId);
    if (!music) throw new Error("Trilha de áudio ausente.");
    const musicIndex = inputIndex++;
    inputs.push("-stream_loop", "-1", "-i", music.path);
    filters.push(
      `[${musicIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${n(timeline.music.volume)},` +
        `atrim=duration=${n(total)},asetpts=PTS-STARTPTS[music]`,
    );
    filters.push(`[acat][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[amix]`);
    audioOut = "[amix]";
  }

  const args = [
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    videoOut,
    "-map",
    audioOut,
    "-c:v",
    "libx264",
    "-preset",
    preset.preset,
    "-crf",
    String(preset.crf),
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
    "-c:a",
    "aac",
    "-b:a",
    preset.audioBitrate,
    "-movflags",
    "+faststart",
    "-t",
    n(total),
    "-progress",
    "pipe:1",
    "-nostats",
    outputPath,
  ];
  return { args, durationSeconds: total, width, height };
}

/** Converte a linha `out_time_us=` do `-progress` em fração concluída. */
export function parseProgressLine(line: string, totalSeconds: number): number | null {
  const match = line.match(/^out_time_(?:us|ms)=(\d+)$/);
  if (!match || totalSeconds <= 0) return null;
  return Math.min(1, Number(match[1]) / 1_000_000 / totalSeconds);
}
