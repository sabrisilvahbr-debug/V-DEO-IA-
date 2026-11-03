/**
 * Worker da fila de tarefas do CINEMORPH AI.
 *
 * Processa gerações, renderizações e detecção de cenas fora das requisições
 * HTTP. Pode ser reiniciado a qualquer momento: jobs com lease expirado
 * voltam para a fila (ou falham ao esgotar as tentativas).
 *
 *   npm run worker
 */
import { hostname } from "node:os";
import { getWorkerContext } from "@/lib/server/context";
import { serverConfig } from "@/lib/server/config";
import { ffmpegStatus } from "@/lib/server/media/ffmpeg";
import { jobHandlers } from "@/lib/server/jobs/handlers";
import { runOnce } from "@/lib/server/jobs/runner";

const IDLE_MS = 1_000;
const RECOVERY_EVERY_MS = 30_000;

/** Carrega .env.local e .env como o Next faz (variáveis já definidas têm prioridade). */
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // arquivo opcional
    }
  }
}

async function main() {
  loadEnvFiles();
  const config = serverConfig();
  const { store, storage } = getWorkerContext();
  const workerId = `${hostname()}:${process.pid}`;
  const ffmpeg = await ffmpegStatus();

  console.log(`[worker] ${workerId} iniciado · modo ${config.backend} · dados em ${config.dataDir}`);
  console.log(
    ffmpeg.available
      ? `[worker] FFmpeg ${ffmpeg.version} disponível`
      : `[worker] AVISO: FFmpeg indisponível (${ffmpeg.error ?? "não encontrado"}). Renderizações vão falhar.`,
  );

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) process.exit(1);
    stopping = true;
    console.log(`[worker] ${signal} recebido; terminando a tarefa atual…`);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  let lastRecovery = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastRecovery > RECOVERY_EVERY_MS) {
        lastRecovery = Date.now();
        const recovered = await store.recoverExpiredJobs();
        if (recovered.requeued || recovered.failed) {
          console.log(`[worker] recuperação: ${recovered.requeued} reenfileirado(s), ${recovered.failed} falho(s)`);
        }
      }
      const worked = await runOnce({ store, storage, handlers: jobHandlers, workerId });
      if (!worked) await new Promise((resolve) => setTimeout(resolve, IDLE_MS));
    } catch (error) {
      console.error("[worker] erro no ciclo:", error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  console.log("[worker] encerrado.");
}

void main();
