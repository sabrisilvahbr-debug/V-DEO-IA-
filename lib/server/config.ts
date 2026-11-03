import "server-only";
import path from "node:path";
import { z } from "zod";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Configuração do servidor, lida das variáveis de ambiente e validada.
 * Valores ausentes usam padrões seguros para execução local.
 */
const envSchema = z.object({
  CINEMORPH_BACKEND: z.enum(["local", "supabase"]).default("local"),
  CINEMORPH_DATA_DIR: z.string().default(".data"),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(10_000).default(500),
  MAX_VIDEO_SECONDS: z.coerce.number().int().positive().max(7_200).default(600),
  MAX_RESOLUTION: z.coerce.number().int().positive().max(8_192).default(4_096),
  MOCK_PROVIDER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  OPERATIONAL_BUDGET_CENTS: z.coerce.number().int().min(0).default(0),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("media"),
});

export type ServerConfig = ReturnType<typeof loadServerConfig>;

export function loadServerConfig(env: Record<string, string | undefined> = process.env) {
  const parsed = envSchema.parse(
    Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== "")),
  );
  const dataDir = path.resolve(parsed.CINEMORPH_DATA_DIR);
  return {
    backend: parsed.CINEMORPH_BACKEND,
    dataDir,
    dbPath: path.join(dataDir, "cinemorph.sqlite"),
    storageDir: path.join(dataDir, "storage"),
    tmpDir: path.join(dataDir, "tmp"),
    ffmpegPath: parsed.FFMPEG_PATH,
    ffprobePath: parsed.FFPROBE_PATH,
    maxUploadBytes: parsed.MAX_UPLOAD_MB * 1024 * 1024,
    maxVideoSeconds: parsed.MAX_VIDEO_SECONDS,
    maxResolution: parsed.MAX_RESOLUTION,
    mockProviderEnabled: parsed.MOCK_PROVIDER_ENABLED,
    operationalBudgetCents: parsed.OPERATIONAL_BUDGET_CENTS,
    supabase: readSupabaseConfig(env),
    supabaseSecretKey: parsed.SUPABASE_SECRET_KEY ?? null,
    storageBucket: parsed.SUPABASE_STORAGE_BUCKET,
  };
}

let cached: ServerConfig | null = null;

export function serverConfig(): ServerConfig {
  if (!cached) cached = loadServerConfig();
  return cached;
}

/**
 * Valida se o modo escolhido pode funcionar. Em modo Supabase, as variáveis
 * públicas são obrigatórias.
 */
export function configProblems(config: ServerConfig): string[] {
  const problems: string[] = [];
  if (config.backend === "supabase" && !config.supabase) {
    problems.push(
      "CINEMORPH_BACKEND=supabase exige NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return problems;
}
