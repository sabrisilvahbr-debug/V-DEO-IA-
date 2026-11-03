import { z } from "zod";

/**
 * Timeline do projeto. É persistida como JSON e enviada ao renderizador.
 * Tempos em segundos.
 */
export const colorSchema = z.object({
  brightness: z.number().min(-1).max(1).default(0),
  contrast: z.number().min(0).max(2).default(1),
  saturation: z.number().min(0).max(3).default(1),
});

export const clipSchema = z
  .object({
    id: z.string().min(1).max(64),
    assetId: z.string().min(1).max(64),
    kind: z.enum(["video", "image"]),
    /** Ponto de entrada no arquivo de origem (vídeo). Para imagens é 0. */
    in: z.number().min(0),
    /** Ponto de saída no arquivo de origem. Para imagens, define a duração. */
    out: z.number().positive(),
    volume: z.number().min(0).max(2).default(1),
    muted: z.boolean().default(false),
    color: colorSchema.default({ brightness: 0, contrast: 1, saturation: 1 }),
  })
  .refine((clip) => clip.out - clip.in >= 0.1, {
    message: "O clipe precisa ter pelo menos 0,1 s.",
    path: ["out"],
  });

export const subtitleSchema = z
  .object({
    id: z.string().min(1).max(64),
    start: z.number().min(0),
    end: z.number().positive(),
    text: z.string().trim().min(1).max(300),
  })
  .refine((s) => s.end > s.start, { message: "O fim deve ser depois do início.", path: ["end"] });

export const outputSchema = z.object({
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
  burnSubtitles: z.boolean().default(false),
});

export const timelineSchema = z.object({
  version: z.literal(1).default(1),
  clips: z.array(clipSchema).max(200).default([]),
  music: z
    .object({ assetId: z.string().min(1).max(64), volume: z.number().min(0).max(2).default(0.6) })
    .nullable()
    .default(null),
  subtitles: z.array(subtitleSchema).max(1000).default([]),
  output: outputSchema.default({ aspectRatio: "16:9", quality: "standard", burnSubtitles: false }),
});

export type Clip = z.infer<typeof clipSchema>;
export type ClipColor = z.infer<typeof colorSchema>;
export type Subtitle = z.infer<typeof subtitleSchema>;
export type TimelineOutput = z.infer<typeof outputSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
export type Quality = TimelineOutput["quality"];

export function emptyTimeline(aspectRatio: TimelineOutput["aspectRatio"] = "16:9"): Timeline {
  return {
    version: 1,
    clips: [],
    music: null,
    subtitles: [],
    output: { aspectRatio, quality: "standard", burnSubtitles: false },
  };
}

/** Lê uma timeline persistida, devolvendo uma vazia se o JSON for inválido. */
export function parseTimeline(value: unknown): Timeline {
  const parsed = timelineSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyTimeline();
}

export function clipDuration(clip: Pick<Clip, "in" | "out">): number {
  return Math.max(0, clip.out - clip.in);
}

export function timelineDuration(timeline: Pick<Timeline, "clips">): number {
  return timeline.clips.reduce((total, clip) => total + clipDuration(clip), 0);
}

/** Início de cada clipe na timeline montada. */
export function clipStartTimes(timeline: Pick<Timeline, "clips">): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const clip of timeline.clips) {
    starts.push(cursor);
    cursor += clipDuration(clip);
  }
  return starts;
}

export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
