import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { configProblems, serverConfig } from "./config";
import { ffmpegStatus } from "./media/ffmpeg";
import { detectSqliteDriver } from "./store/sqlite-driver";

export type Check = {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
  fix?: string;
};

function nodeVersion(): [number, number] {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return [major, minor];
}

/** Verifica o ambiente de execução e devolve cada item com a correção sugerida. */
export async function runDiagnostics(): Promise<Check[]> {
  const config = serverConfig();
  const checks: Check[] = [];

  const [major, minor] = nodeVersion();
  const nodeOk = major > 20 || (major === 20 && minor >= 9);
  const nodeIdeal = major > 22 || (major === 22 && minor >= 13);
  checks.push({
    id: "node",
    label: "Node.js",
    status: !nodeOk ? "error" : nodeIdeal ? "ok" : "warning",
    detail: `Versão ${process.version}.`,
    fix: !nodeIdeal ? "Recomendado: Node.js 22.13 ou superior (https://nodejs.org). O mínimo é 20.9." : undefined,
  });

  for (const problem of configProblems(config)) {
    checks.push({ id: "config", label: "Configuração", status: "error", detail: problem, fix: "Ajuste o .env.local e reinicie o servidor." });
  }

  if (config.backend === "local") {
    const driver = detectSqliteDriver();
    checks.push({
      id: "sqlite",
      label: "Banco local (SQLite)",
      status: driver ? "ok" : "error",
      detail: driver ? `Usando ${driver}.` : "Nenhum driver SQLite disponível.",
      fix: driver ? undefined : "Atualize o Node.js para 22.13+ ou rode `npm install` para instalar o better-sqlite3.",
    });

    try {
      await mkdir(config.dataDir, { recursive: true });
      const probe = path.join(config.dataDir, `.write-test-${process.pid}`);
      await writeFile(probe, "ok");
      await rm(probe, { force: true });
      checks.push({ id: "data", label: "Pasta de dados", status: "ok", detail: config.dataDir });
    } catch (error) {
      checks.push({
        id: "data",
        label: "Pasta de dados",
        status: "error",
        detail: `Não foi possível gravar em ${config.dataDir} (${(error as NodeJS.ErrnoException).code ?? "erro"}).`,
        fix: "Defina CINEMORPH_DATA_DIR para uma pasta com permissão de escrita. Em hospedagens sem disco (ex.: Vercel), use o modo Supabase.",
      });
    }
  } else if (!config.supabaseSecretKey) {
    checks.push({
      id: "secret",
      label: "Chave do worker",
      status: "warning",
      detail: "SUPABASE_SECRET_KEY não definida.",
      fix: "O worker precisa dela para processar gerações e exportações.",
    });
  }

  const ffmpeg = await ffmpegStatus();
  checks.push({
    id: "ffmpeg",
    label: "FFmpeg e FFprobe",
    status: ffmpeg.available && ffmpeg.probeAvailable ? "ok" : "error",
    detail: ffmpeg.available && ffmpeg.probeAvailable ? `Versão ${ffmpeg.version}.` : (ffmpeg.error ?? "Não encontrado."),
    fix:
      ffmpeg.available && ffmpeg.probeAvailable
        ? undefined
        : "Instale o FFmpeg (Windows: winget install Gyan.FFmpeg · macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg), feche e abra o terminal e reinicie. Sem ele, as páginas abrem, mas upload e exportação não funcionam.",
  });
  if (ffmpeg.available && !(ffmpeg.encoders.libx264 && ffmpeg.encoders.aac)) {
    checks.push({ id: "codecs", label: "Codecs", status: "warning", detail: "Seu FFmpeg não tem libx264 e/ou aac.", fix: "Instale uma build completa do FFmpeg." });
  }

  return checks;
}
