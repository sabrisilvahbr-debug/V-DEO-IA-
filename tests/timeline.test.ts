import { describe, expect, it } from "vitest";
import { clipStartTimes, emptyTimeline, parseTimeline, timelineDuration, timelineSchema, type Timeline } from "@/lib/domain/timeline";
import { locateTime, timelineReducer } from "@/lib/domain/timeline-ops";
import { composePrompt } from "@/lib/prompt-director";

const video = { id: "v1", kind: "video" as const, durationMs: 10_000 };
const image = { id: "i1", kind: "image" as const, durationMs: null };

function build(): Timeline {
  let t = emptyTimeline();
  t = timelineReducer(t, { type: "addClip", asset: video, id: "a" });
  t = timelineReducer(t, { type: "addClip", asset: image, id: "b" });
  return t;
}

describe("timelineReducer", () => {
  it("adiciona vídeo com duração total e imagem com 4 s; ignora áudio", () => {
    let t = build();
    expect(t.clips.map((c) => [c.id, c.in, c.out])).toEqual([["a", 0, 10], ["b", 0, 4]]);
    t = timelineReducer(t, { type: "addClip", asset: { id: "x", kind: "audio", durationMs: 5000 }, id: "c" });
    expect(t.clips).toHaveLength(2);
    expect(timelineDuration(t)).toBe(14);
  });

  it("move, duplica e remove clipes sem alterar o original", () => {
    const original = build();
    const moved = timelineReducer(original, { type: "moveClip", clipId: "b", direction: -1 });
    expect(moved.clips.map((c) => c.id)).toEqual(["b", "a"]);
    expect(original.clips.map((c) => c.id)).toEqual(["a", "b"]);
    expect(timelineReducer(original, { type: "moveClip", clipId: "a", direction: -1 })).toBe(original);
    const dup = timelineReducer(original, { type: "duplicateClip", clipId: "a", newId: "a2" });
    expect(dup.clips.map((c) => c.id)).toEqual(["a", "a2", "b"]);
    expect(timelineReducer(dup, { type: "removeClip", clipId: "a2" }).clips).toHaveLength(2);
  });

  it("limita entrada/saída, volume e cor a valores válidos", () => {
    const t = timelineReducer(build(), {
      type: "updateClip",
      clipId: "a",
      patch: { in: 5, out: 5, volume: 9, color: { saturation: 10, brightness: -3 } },
    });
    const clip = t.clips[0];
    expect(clip.in).toBe(5);
    expect(clip.out).toBeCloseTo(5.1);
    expect(clip.volume).toBe(2);
    expect(clip.color).toEqual({ brightness: -1, contrast: 1, saturation: 3 });
  });

  it("divide um clipe de vídeo no ponto indicado", () => {
    const t = timelineReducer(build(), { type: "splitClip", clipId: "a", atSourceSeconds: 3, newId: "a2" });
    expect(t.clips.slice(0, 2).map((c) => [c.id, c.in, c.out])).toEqual([["a", 0, 3], ["a2", 3, 10]]);
  });

  it("divide uma imagem preservando a duração total", () => {
    const t = timelineReducer(build(), { type: "splitClip", clipId: "b", atSourceSeconds: 1, newId: "b2" });
    expect(t.clips.slice(1).map((c) => [c.in, c.out])).toEqual([[0, 1], [0, 3]]);
    expect(timelineDuration(t)).toBe(14);
  });

  it("não divide muito perto das bordas", () => {
    const original = build();
    expect(timelineReducer(original, { type: "splitClip", clipId: "a", atSourceSeconds: 0.05, newId: "z" })).toBe(original);
  });

  it("aplica segmentos de detecção de cena", () => {
    const t = timelineReducer(build(), {
      type: "applySegments",
      clipId: "a",
      segments: [{ in: 0, out: 2 }, { in: 2, out: 6.5 }, { in: 6.5, out: 10 }],
      newIds: ["s1", "s2", "s3"],
    });
    expect(t.clips.map((c) => c.id)).toEqual(["s1", "s2", "s3", "b"]);
    expect(timelineDuration(t)).toBe(14);
  });

  it("gerencia legendas ordenadas e trilha", () => {
    let t = build();
    t = timelineReducer(t, { type: "addSubtitle", subtitle: { id: "2", start: 5, end: 6, text: "B" } });
    t = timelineReducer(t, { type: "addSubtitle", subtitle: { id: "1", start: 1, end: 2, text: "A" } });
    expect(t.subtitles.map((s) => s.id)).toEqual(["1", "2"]);
    t = timelineReducer(t, { type: "updateSubtitle", id: "1", patch: { start: 8, end: 3 } });
    expect(t.subtitles.map((s) => [s.id, s.start, s.end])).toEqual([["2", 5, 6], ["1", 8, 8.1]]);
    t = timelineReducer(t, { type: "setMusic", assetId: "m1" });
    expect(t.music).toEqual({ assetId: "m1", volume: 0.6 });
    t = timelineReducer(t, { type: "setMusic", assetId: null });
    expect(t.music).toBeNull();
  });
});

describe("helpers da timeline", () => {
  it("calcula inícios e localiza um instante", () => {
    const t = build();
    expect(clipStartTimes(t)).toEqual([0, 10]);
    expect(locateTime(t, 12)).toEqual({ clipIndex: 1, sourceSeconds: 2 });
    expect(locateTime(t, 3)).toEqual({ clipIndex: 0, sourceSeconds: 3 });
    expect(locateTime(emptyTimeline(), 3)).toBeNull();
  });

  it("valida o esquema e recupera JSON inválido", () => {
    expect(timelineSchema.safeParse({ clips: [{ id: "a", assetId: "b", kind: "video", in: 2, out: 2 }] }).success).toBe(false);
    expect(parseTimeline("lixo")).toEqual(emptyTimeline());
    expect(parseTimeline({ clips: [] }).output.quality).toBe("standard");
  });
});

describe("composePrompt", () => {
  it("preserva a descrição e adiciona apenas campos preenchidos, em ordem", () => {
    expect(composePrompt("  rua  à noite ")).toBe("rua à noite");
    expect(composePrompt("rua à noite", { lighting: "neon", camera: "travelling lento", style: "" })).toBe(
      "rua à noite\nCâmera: travelling lento\nIluminação: neon",
    );
  });
});
