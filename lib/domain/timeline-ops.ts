import type { MediaAsset } from "./types";
import { clipDuration, clipStartTimes, type Clip, type ClipColor, type Subtitle, type Timeline, type TimelineOutput } from "./timeline";

/**
 * Operações puras sobre a timeline, usadas pelo editor (useReducer).
 * Nenhuma delas altera o objeto recebido.
 */
export const DEFAULT_IMAGE_SECONDS = 4;
export const NEUTRAL_COLOR: ClipColor = { brightness: 0, contrast: 1, saturation: 1 };

export type TimelineAction =
  | { type: "replace"; timeline: Timeline }
  | { type: "addClip"; asset: Pick<MediaAsset, "id" | "kind" | "durationMs">; id: string; index?: number }
  | { type: "removeClip"; clipId: string }
  | { type: "moveClip"; clipId: string; direction: -1 | 1 }
  | { type: "duplicateClip"; clipId: string; newId: string }
  | { type: "updateClip"; clipId: string; patch: Partial<Pick<Clip, "in" | "out" | "volume" | "muted">> & { color?: Partial<ClipColor> } }
  | { type: "splitClip"; clipId: string; atSourceSeconds: number; newId: string }
  | { type: "applySegments"; clipId: string; segments: Array<{ in: number; out: number }>; newIds: string[] }
  | { type: "setMusic"; assetId: string | null; volume?: number }
  | { type: "addSubtitle"; subtitle: Subtitle }
  | { type: "updateSubtitle"; id: string; patch: Partial<Omit<Subtitle, "id">> }
  | { type: "removeSubtitle"; id: string }
  | { type: "setOutput"; patch: Partial<TimelineOutput> };

const round = (value: number) => Math.round(value * 1000) / 1000;

export function clipFromAsset(asset: Pick<MediaAsset, "id" | "kind" | "durationMs">, id: string): Clip | null {
  if (asset.kind === "audio") return null;
  const out = asset.kind === "image" ? DEFAULT_IMAGE_SECONDS : round((asset.durationMs ?? 0) / 1000);
  if (out < 0.1) return null;
  return { id, assetId: asset.id, kind: asset.kind, in: 0, out, volume: 1, muted: false, color: { ...NEUTRAL_COLOR } };
}

function updateClips(timeline: Timeline, clipId: string, fn: (clip: Clip) => Clip): Timeline {
  return { ...timeline, clips: timeline.clips.map((c) => (c.id === clipId ? fn(c) : c)) };
}

export function timelineReducer(timeline: Timeline, action: TimelineAction): Timeline {
  switch (action.type) {
    case "replace":
      return action.timeline;

    case "addClip": {
      const clip = clipFromAsset(action.asset, action.id);
      if (!clip) return timeline;
      const clips = [...timeline.clips];
      clips.splice(action.index ?? clips.length, 0, clip);
      return { ...timeline, clips };
    }

    case "removeClip":
      return { ...timeline, clips: timeline.clips.filter((c) => c.id !== action.clipId) };

    case "moveClip": {
      const index = timeline.clips.findIndex((c) => c.id === action.clipId);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= timeline.clips.length) return timeline;
      const clips = [...timeline.clips];
      [clips[index], clips[target]] = [clips[target], clips[index]];
      return { ...timeline, clips };
    }

    case "duplicateClip": {
      const index = timeline.clips.findIndex((c) => c.id === action.clipId);
      if (index < 0) return timeline;
      const clips = [...timeline.clips];
      clips.splice(index + 1, 0, { ...clips[index], id: action.newId, color: { ...clips[index].color } });
      return { ...timeline, clips };
    }

    case "updateClip":
      return updateClips(timeline, action.clipId, (clip) => {
        const next: Clip = {
          ...clip,
          ...action.patch,
          color: { ...clip.color, ...action.patch.color },
        };
        next.in = round(Math.max(0, next.in));
        next.out = round(Math.max(next.in + 0.1, next.out));
        next.volume = Math.min(2, Math.max(0, next.volume));
        next.color = {
          brightness: Math.min(1, Math.max(-1, next.color.brightness)),
          contrast: Math.min(2, Math.max(0, next.color.contrast)),
          saturation: Math.min(3, Math.max(0, next.color.saturation)),
        };
        return next;
      });

    case "splitClip": {
      const index = timeline.clips.findIndex((c) => c.id === action.clipId);
      if (index < 0) return timeline;
      const clip = timeline.clips[index];
      const at = round(action.atSourceSeconds);
      if (at - clip.in < 0.1 || clip.out - at < 0.1) return timeline;
      const first: Clip = { ...clip, out: at };
      const second: Clip = { ...clip, id: action.newId, in: clip.kind === "image" ? 0 : at, out: clip.kind === "image" ? round(clip.out - at) : clip.out, color: { ...clip.color } };
      if (clip.kind === "image") first.out = round(at - clip.in);
      const clips = [...timeline.clips];
      clips.splice(index, 1, first, second);
      return { ...timeline, clips };
    }

    case "applySegments": {
      const index = timeline.clips.findIndex((c) => c.id === action.clipId);
      if (index < 0 || action.segments.length === 0) return timeline;
      const clip = timeline.clips[index];
      const pieces = action.segments
        .map((s, i) => ({ ...clip, id: action.newIds[i] ?? `${clip.id}-${i}`, in: round(s.in), out: round(s.out), color: { ...clip.color } }))
        .filter((piece) => piece.out - piece.in >= 0.1);
      const clips = [...timeline.clips];
      clips.splice(index, 1, ...pieces);
      return { ...timeline, clips };
    }

    case "setMusic":
      return {
        ...timeline,
        music: action.assetId ? { assetId: action.assetId, volume: action.volume ?? timeline.music?.volume ?? 0.6 } : null,
      };

    case "addSubtitle":
      return { ...timeline, subtitles: [...timeline.subtitles, action.subtitle].sort((a, b) => a.start - b.start) };

    case "updateSubtitle":
      return {
        ...timeline,
        subtitles: timeline.subtitles
          .map((s) => {
            if (s.id !== action.id) return s;
            const next = { ...s, ...action.patch };
            next.start = round(Math.max(0, next.start));
            next.end = round(Math.max(next.start + 0.1, next.end));
            return next;
          })
          .sort((a, b) => a.start - b.start),
      };

    case "removeSubtitle":
      return { ...timeline, subtitles: timeline.subtitles.filter((s) => s.id !== action.id) };

    case "setOutput":
      return { ...timeline, output: { ...timeline.output, ...action.patch } };
  }
}

/** Localiza o clipe e o instante no arquivo de origem para um tempo da timeline. */
export function locateTime(timeline: Timeline, seconds: number): { clipIndex: number; sourceSeconds: number } | null {
  const starts = clipStartTimes(timeline);
  for (let i = 0; i < timeline.clips.length; i++) {
    const clip = timeline.clips[i];
    if (seconds < starts[i] + clipDuration(clip) || i === timeline.clips.length - 1) {
      const offset = Math.min(Math.max(0, seconds - starts[i]), clipDuration(clip));
      return { clipIndex: i, sourceSeconds: clip.in + offset };
    }
  }
  return null;
}
