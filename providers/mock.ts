import { createHash } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AspectRatio } from "@/lib/domain/types";
import { ffmpegStatus, runFfmpeg } from "@/lib/server/media/ffmpeg";
import type {
  CostEstimate,
  GenerationInput,
  ProviderAvailability,
  ProviderCapabilities,
  ProviderInfo,
  ProviderJobStatus,
  ProviderResult,
  StartJobOptions,
  VideoProvider,
} from "./types";

const MOCK_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 720, height: 720 },
};

/**
 * Adaptador MOCK — exclusivo para testes e demonstrações.
 *
 * Não usa IA. Produz um vídeo real com FFmpeg, marcado visualmente como
 * "DEMONSTRAÇÃO", para exercitar o fluxo completo (fila, armazenamento,
 * timeline, renderização) sem custo e sem credenciais.
 */
export class MockVideoProvider implements VideoProvider {
  readonly id = "mock";

  constructor(
    private readonly workDir: string,
    private readonly enabled: boolean,
  ) {}

  info(): ProviderInfo {
    return {
      id: this.id,
      name: "MOCK (demonstração)",
      isDemo: true,
      paid: false,
      docsUrl: null,
      verifiedAt: null,
      notes: "Gera padrões de teste ou aplica um filtro simples com FFmpeg. Não é um modelo de IA.",
    };
  }

  async availability(): Promise<ProviderAvailability> {
    if (!this.enabled) return { available: false, reason: "Desativado por MOCK_PROVIDER_ENABLED=false." };
    const status = await ffmpegStatus();
    return status.available ? { available: true } : { available: false, reason: "FFmpeg indisponível." };
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return {
      modes: ["text_to_video", "video_to_video"],
      aspectRatios: ["16:9", "9:16", "1:1"],
      minDurationSeconds: 1,
      maxDurationSeconds: 10,
      acceptsReferenceImages: false,
      preservesMotion: true,
      maxInputVideoSeconds: 600,
    };
  }

  async estimateCost(): Promise<CostEstimate> {
    return { known: true, cents: 0, currency: "USD", basis: "Demonstração local, sem custo." };
  }

  private jobDir(providerJobId: string) {
    if (!/^mock_[a-f0-9]{24}$/.test(providerJobId)) throw new Error("Identificador MOCK inválido.");
    return path.join(this.workDir, providerJobId);
  }

  async startJob(input: GenerationInput, options: StartJobOptions) {
    const providerJobId = `mock_${createHash("sha256").update(options.idempotencyKey).digest("hex").slice(0, 24)}`;
    const dir = this.jobDir(providerJobId);
    await mkdir(dir, { recursive: true });
    const output = path.join(dir, "output.mp4");
    const { width, height } = MOCK_SIZES[input.aspectRatio];
    const duration = Math.min(Math.max(input.durationSeconds, 1), 10);
    const status = await ffmpegStatus();

    const fit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    let label = "";
    if (status.filters.drawtext) {
      const textFile = path.join(dir, "label.txt");
      const snippet = input.prompt.replace(/\s+/g, " ").slice(0, 60);
      await writeFile(textFile, `DEMONSTRAÇÃO · MOCK\n${snippet}`, "utf8");
      const escaped = textFile.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
      label = `,drawtext=textfile='${escaped}':fontcolor=white:fontsize=${Math.round(height / 22)}:box=1:boxcolor=black@0.6:boxborderw=12:x=(w-tw)/2:y=h-th-${Math.round(height / 12)}:line_spacing=8`;
    }

    const args =
      input.mode === "video_to_video" && input.sourceVideoPath
        ? [
            "-i", input.sourceVideoPath,
            "-t", String(duration),
            "-vf", `${fit},eq=saturation=0.35:contrast=1.25,colorbalance=rs=0.18:gs=0.05:bs=-0.12,fps=30${label}`,
            "-map", "0:v:0", "-map", "0:a:0?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-shortest",
            output,
          ]
        : [
            "-f", "lavfi", "-i", `testsrc2=size=${width}x${height}:rate=30:duration=${duration}`,
            "-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=48000`,
            "-vf", `hue=h=${(hashNumber(input.prompt) % 360).toFixed(0)}${label}`,
            "-t", String(duration),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-shortest",
            output,
          ];

    if (input.mode === "video_to_video" && !input.sourceVideoPath) {
      throw new Error("Vídeo de origem ausente para vídeo para vídeo.");
    }
    await runFfmpeg(args, { timeoutMs: 120_000, signal: options.signal });
    await writeFile(path.join(dir, "done"), new Date().toISOString());
    return { providerJobId };
  }

  async getJobStatus(providerJobId: string): Promise<ProviderJobStatus> {
    try {
      await access(path.join(this.jobDir(providerJobId), "done"));
      return { state: "succeeded", progress: 1 };
    } catch {
      return { state: "failed", error: "Resultado da demonstração não encontrado." };
    }
  }

  async getResult(providerJobId: string): Promise<ProviderResult> {
    const dir = this.jobDir(providerJobId);
    return { filePath: path.join(dir, "output.mp4"), cleanup: () => rm(dir, { recursive: true, force: true }) };
  }

  async cancelJob(providerJobId: string) {
    await rm(this.jobDir(providerJobId), { recursive: true, force: true });
  }
}

function hashNumber(text: string): number {
  return parseInt(createHash("sha1").update(text).digest("hex").slice(0, 6), 16);
}
