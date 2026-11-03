import { describe, expect, it } from "vitest";
import { emptyTimeline, type Timeline } from "@/lib/domain/timeline";
import { buildRenderPlan, escapeFilterPath, parseProgressLine } from "@/lib/media/render-plan";
import { parseSceneTimes, scenesToSegments } from "@/lib/media/scenes";
import { buildSrt } from "@/lib/media/srt";
import { parseProbeOutput } from "@/lib/server/media/probe";
import { detectFileType, MediaValidationError, sanitizeDisplayName, validateProbe } from "@/lib/server/media/validate";
import { parseRange } from "@/lib/server/range";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(Array(16).fill(0)));

describe("detectFileType", () => {
  it("reconhece formatos pelo conteúdo", () => {
    expect(detectFileType(bytes([0, 0, 0, 0x20], "ftypisom"))?.mimeType).toBe("video/mp4");
    expect(detectFileType(bytes([0, 0, 0, 0x14], "ftypqt  "))?.extension).toBe("mov");
    expect(detectFileType(bytes([0, 0, 0, 0x20], "ftypM4A "))?.kind).toBe("audio");
    expect(detectFileType(bytes([0x1a, 0x45, 0xdf, 0xa3], "....webm"))?.mimeType).toBe("video/webm");
    expect(detectFileType(bytes([0x89], "PNG"))?.kind).toBe("image");
    expect(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe("jpg");
    expect(detectFileType(bytes("RIFF", [0, 0, 0, 0], "WAVE"))?.mimeType).toBe("audio/wav");
    expect(detectFileType(bytes("ID3"))?.extension).toBe("mp3");
  });

  it("rejeita conteúdo desconhecido mesmo com extensão de vídeo", () => {
    expect(detectFileType(bytes("<?php echo 1; ?>"))).toBeNull();
    expect(detectFileType(bytes("MZ"))).toBeNull();
    expect(detectFileType(new Uint8Array(4))).toBeNull();
  });
});

describe("validateProbe", () => {
  const limits = { maxBytes: 1e9, maxVideoSeconds: 60, maxResolution: 4096 };
  const videoType = { kind: "video" as const, mimeType: "video/mp4", extension: "mp4" };
  const ok = { formatName: "mp4", durationSeconds: 10, video: { codec: "h264", width: 1920, height: 1080 }, hasAudio: true };

  it("aceita vídeo dentro dos limites", () => {
    expect(() => validateProbe(videoType, ok, limits)).not.toThrow();
  });

  it("rejeita duração, resolução ou vídeo ausente com dica", () => {
    expect(() => validateProbe(videoType, { ...ok, durationSeconds: 61 }, limits)).toThrow(/máximo é 60 s/);
    expect(() => validateProbe(videoType, { ...ok, video: { codec: "h264", width: 8000, height: 4000 } }, limits)).toThrow(MediaValidationError);
    expect(() => validateProbe(videoType, { ...ok, video: null }, limits)).toThrow(/faixa de vídeo/);
    expect(() => validateProbe({ kind: "audio", mimeType: "audio/mpeg", extension: "mp3" }, { ...ok, hasAudio: false }, limits)).toThrow(/áudio/);
  });

  it("limpa nomes exibidos", () => {
    expect(sanitizeDisplayName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeDisplayName("C:\\vídeos\\praia\u0007.mp4")).toBe("praia.mp4");
    expect(sanitizeDisplayName("")).toBe("arquivo");
  });
});

describe("parseProbeOutput", () => {
  it("extrai duração, vídeo e áudio", () => {
    const result = parseProbeOutput(
      JSON.stringify({
        format: { format_name: "mov,mp4", duration: "12.5" },
        streams: [{ codec_type: "video", codec_name: "h264", width: 1280, height: 720 }, { codec_type: "audio" }],
      }),
    );
    expect(result).toEqual({ formatName: "mov,mp4", durationSeconds: 12.5, video: { codec: "h264", width: 1280, height: 720 }, hasAudio: true });
  });
});

describe("parseRange", () => {
  it("interpreta intervalos válidos e rejeita inválidos", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=2000-", 1000)).toBeNull();
    expect(parseRange("items=0-1", 1000)).toBeNull();
    expect(parseRange(null, 1000)).toBeNull();
  });
});

describe("buildSrt", () => {
  it("gera SRT ordenado e corta no fim do vídeo", () => {
    const srt = buildSrt(
      [
        { id: "b", start: 3, end: 9, text: "Segunda" },
        { id: "a", start: 0.5, end: 1.25, text: "Primeira" },
        { id: "c", start: 20, end: 21, text: "Fora" },
      ],
      5,
    );
    expect(srt).toBe("1\n00:00:00,500 --> 00:00:01,250\nPrimeira\n\n2\n00:00:03,000 --> 00:00:05,000\nSegunda\n");
  });
});

describe("cenas", () => {
  it("lê pts_time do showinfo e remove cortes próximos", () => {
    const stderr = "[Parsed_showinfo_2] n:0 pts:1 pts_time:1.5 \n n:1 pts_time:1.7 \n n:2 pts_time:4.04 ";
    expect(parseSceneTimes(stderr)).toEqual([1.5, 4.04]);
  });

  it("converte cortes em segmentos", () => {
    expect(scenesToSegments([1.5, 4], 6)).toEqual([{ in: 0, out: 1.5 }, { in: 1.5, out: 4 }, { in: 4, out: 6 }]);
    expect(scenesToSegments([], 3)).toEqual([{ in: 0, out: 3 }]);
  });
});

describe("buildRenderPlan", () => {
  const sources = new Map([
    ["v1", { path: "/d/v1.mp4", kind: "video" as const, hasAudio: true }],
    ["v2", { path: "/d/v2.mp4", kind: "video" as const, hasAudio: false }],
    ["i1", { path: "/d/i1.png", kind: "image" as const, hasAudio: false }],
    ["m1", { path: "/d/m1.mp3", kind: "audio" as const, hasAudio: true }],
  ]);
  const color = { brightness: 0, contrast: 1, saturation: 1 };
  const timeline: Timeline = {
    ...emptyTimeline("9:16"),
    clips: [
      { id: "a", assetId: "v1", kind: "video", in: 2, out: 5, volume: 0.5, muted: false, color: { brightness: 0.1, contrast: 1.2, saturation: 1 } },
      { id: "b", assetId: "v2", kind: "video", in: 0, out: 1, volume: 1, muted: false, color },
      { id: "c", assetId: "i1", kind: "image", in: 0, out: 2, volume: 1, muted: false, color },
    ],
    music: { assetId: "m1", volume: 0.4 },
    output: { aspectRatio: "9:16", quality: "high", burnSubtitles: false },
  };

  it("monta entradas, cortes e duração total", () => {
    const plan = buildRenderPlan({ timeline, sources, outputPath: "/out.mp4" });
    expect(plan.durationSeconds).toBe(6);
    expect([plan.width, plan.height]).toEqual([1080, 1920]);
    const args = plan.args.join(" ");
    expect(args).toContain("-ss 2 -t 3 -i /d/v1.mp4");
    expect(args).toContain("-loop 1 -framerate 30 -t 2 -i /d/i1.png");
    expect(args).toContain("-stream_loop -1 -i /d/m1.mp3");
    expect(plan.args.at(-1)).toBe("/out.mp4");
    expect(plan.args).toContain("-crf");
    expect(plan.args[plan.args.indexOf("-crf") + 1]).toBe("18");
  });

  it("aplica cor, volume, silêncio para clipes sem áudio e mixagem da trilha", () => {
    const graph = buildRenderPlan({ timeline, sources, outputPath: "/out.mp4" }).args;
    const filter = graph[graph.indexOf("-filter_complex") + 1];
    expect(filter).toContain("eq=brightness=0.1:contrast=1.2:saturation=1");
    expect(filter).toContain("volume=0.5");
    expect(filter.match(/anullsrc/g)).toBeNull(); // silêncio vem de inputs lavfi, não do grafo
    expect(graph.filter((a) => a.startsWith("anullsrc"))).toHaveLength(2);
    expect(filter).toContain("concat=n=3:v=1:a=1[vcat][acat]");
    expect(filter).toContain("amix=inputs=2");
    expect(graph).toContain("[amix]");
    expect(filter).toContain("scale=1080:1920:force_original_aspect_ratio=decrease");
  });

  it("usa 720p no rascunho e grava legendas quando pedido", () => {
    const plan = buildRenderPlan({
      timeline: { ...timeline, music: null, output: { aspectRatio: "16:9", quality: "draft", burnSubtitles: true } },
      sources,
      outputPath: "/out.mp4",
      subtitlesPath: "/tmp/a b/leg:1.srt",
    });
    expect([plan.width, plan.height]).toEqual([1280, 720]);
    const filter = plan.args[plan.args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("subtitles=filename='/tmp/a b/leg\\:1.srt'[vsub]");
    expect(plan.args).toContain("[vsub]");
    expect(plan.args).toContain("[acat]");
  });

  it("silencia clipes mudos e falha com mídia ausente ou timeline vazia", () => {
    const muted = buildRenderPlan({
      timeline: { ...timeline, music: null, clips: [{ ...timeline.clips[0], muted: true }] },
      sources,
      outputPath: "/o.mp4",
    });
    expect(muted.args.filter((a) => a.startsWith("anullsrc"))).toHaveLength(1);
    expect(() => buildRenderPlan({ timeline: emptyTimeline(), sources, outputPath: "/o.mp4" })).toThrow(/vazia/);
    expect(() =>
      buildRenderPlan({ timeline: { ...timeline, clips: [{ ...timeline.clips[0], assetId: "zz" }] }, sources, outputPath: "/o.mp4" }),
    ).toThrow(/ausente/);
  });

  it("interpreta progresso e escapa caminhos", () => {
    expect(parseProgressLine("out_time_us=3000000", 6)).toBe(0.5);
    expect(parseProgressLine("frame=10", 6)).toBeNull();
    expect(escapeFilterPath("C:\\v\\it's,a.srt")).toBe("C\\:/v/it\\'s\\,a.srt");
  });
});
