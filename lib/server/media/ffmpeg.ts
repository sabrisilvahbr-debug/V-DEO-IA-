import { spawn } from "node:child_process";
import { serverConfig } from "../config";

export class FfmpegUnavailableError extends Error {
  constructor(binary: string) {
    super(`${binary} não foi encontrado. Instale o FFmpeg e/ou defina FFMPEG_PATH e FFPROBE_PATH.`);
  }
}

export type RunResult = { code: number; stdout: string; stderr: string };

/**
 * Executa um binário com argumentos em array (sem shell, sem interpolação).
 * `onStdoutLine` recebe as linhas à medida que chegam (para progresso).
 */
export function runBinary(
  binary: string,
  args: string[],
  options: { timeoutMs?: number; signal?: AbortSignal; onStdoutLine?: (line: string) => void } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], signal: options.signal });
    let stdout = "";
    let stderr = "";
    let buffer = "";
    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`Tempo limite excedido (${Math.round(options.timeoutMs! / 1000)} s).`));
        }, options.timeoutMs)
      : null;

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (stdout.length < 5_000_000) stdout += text;
      if (options.onStdoutLine) {
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach((line) => options.onStdoutLine!(line.trim()));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (timer) clearTimeout(timer);
      reject(error.code === "ENOENT" ? new FfmpegUnavailableError(binary) : error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export function ffmpegBin() {
  return serverConfig().ffmpegPath;
}

export function ffprobeBin() {
  return serverConfig().ffprobePath;
}

/** Roda o FFmpeg e lança erro com as últimas linhas do stderr em caso de falha. */
export async function runFfmpeg(
  args: string[],
  options: Parameters<typeof runBinary>[2] = {},
): Promise<RunResult> {
  const result = await runBinary(ffmpegBin(), ["-hide_banner", "-nostdin", "-y", ...args], options);
  if (result.code !== 0) {
    const tail = result.stderr.trim().split("\n").slice(-6).join("\n");
    throw new Error(`FFmpeg falhou (código ${result.code}): ${tail}`);
  }
  return result;
}

export type FfmpegStatus = {
  available: boolean;
  version: string | null;
  probeAvailable: boolean;
  filters: { drawtext: boolean; subtitles: boolean; scene: boolean };
  encoders: { libx264: boolean; aac: boolean };
  error: string | null;
};

let statusCache: { at: number; value: FfmpegStatus } | null = null;

/** Verifica a disponibilidade do FFmpeg e dos recursos usados (cache de 60 s). */
export async function ffmpegStatus(): Promise<FfmpegStatus> {
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
  const value: FfmpegStatus = {
    available: false,
    version: null,
    probeAvailable: false,
    filters: { drawtext: false, subtitles: false, scene: false },
    encoders: { libx264: false, aac: false },
    error: null,
  };
  try {
    const version = await runBinary(ffmpegBin(), ["-hide_banner", "-version"], { timeoutMs: 10_000 });
    value.available = version.code === 0;
    value.version = version.stdout.split("\n")[0]?.replace(/^ffmpeg version\s*/, "").split(" ")[0] ?? null;
    const filters = await runBinary(ffmpegBin(), ["-hide_banner", "-filters"], { timeoutMs: 10_000 });
    const has = (name: string) => new RegExp(`\\s${name}\\s`).test(filters.stdout);
    value.filters = { drawtext: has("drawtext"), subtitles: has("subtitles"), scene: has("select") };
    const encoders = await runBinary(ffmpegBin(), ["-hide_banner", "-encoders"], { timeoutMs: 10_000 });
    value.encoders = { libx264: /\slibx264\s/.test(encoders.stdout), aac: /\saac\s/.test(encoders.stdout) };
  } catch (error) {
    value.error = error instanceof Error ? error.message : String(error);
  }
  try {
    const probe = await runBinary(ffprobeBin(), ["-hide_banner", "-version"], { timeoutMs: 10_000 });
    value.probeAvailable = probe.code === 0;
  } catch (error) {
    value.error ??= error instanceof Error ? error.message : String(error);
  }
  statusCache = { at: Date.now(), value };
  return value;
}

export async function requireFfmpeg(): Promise<FfmpegStatus> {
  const status = await ffmpegStatus();
  if (!status.available) throw new FfmpegUnavailableError(ffmpegBin());
  if (!status.probeAvailable) throw new FfmpegUnavailableError(ffprobeBin());
  return status;
}
