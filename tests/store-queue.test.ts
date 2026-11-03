// @vitest-environment node
import { describe, expect, it, beforeEach } from "vitest";
import { emptyTimeline } from "@/lib/domain/timeline";
import { NonRetryableError, retryDelayMs } from "@/lib/server/jobs/errors";
import { processJob, type JobHandlers } from "@/lib/server/jobs/runner";
import { LocalDataStore } from "@/lib/server/store/local";
import { buildStorageKey } from "@/lib/server/storage/types";
import type { BlobStorage } from "@/lib/server/storage/types";
import { checkRateLimit, RateLimitError, resetRateLimits } from "@/lib/server/rate-limit";

const hex = (c: string) => c.repeat(32);
const storage = {} as BlobStorage;

function newJob(store: LocalDataStore, owner: string, key: string, maxAttempts = 3) {
  return store.createJob(owner, {
    id: `job_${hex(key)}`,
    projectId: null,
    type: "render",
    providerId: null,
    input: {},
    idempotencyKey: key,
    maxAttempts,
    costEstimateCents: 0,
  });
}

describe("LocalDataStore", () => {
  let store: LocalDataStore;
  beforeEach(() => {
    store = new LocalDataStore(":memory:");
  });

  it("isola projetos e mídias por dono", async () => {
    await store.createProject("ana", { id: "prj_1", name: "Da Ana", aspectRatio: "16:9", timeline: emptyTimeline() });
    expect(await store.getProject("bia", "prj_1")).toBeNull();
    expect(await store.listProjects("bia")).toEqual([]);
    expect(await store.updateProject("bia", "prj_1", { name: "x" })).toBeNull();
    expect(await store.deleteProject("bia", "prj_1")).toBe(false);
    expect((await store.getProject("ana", "prj_1"))?.name).toBe("Da Ana");
  });

  it("pesquisa projetos por nome, tratando curingas literalmente", async () => {
    await store.createProject("ana", { id: "prj_1", name: "Viagem 100%", aspectRatio: "16:9", timeline: emptyTimeline() });
    await store.createProject("ana", { id: "prj_2", name: "Casamento", aspectRatio: "9:16", timeline: emptyTimeline() });
    expect((await store.listProjects("ana", { search: "viag" })).map((p) => p.id)).toEqual(["prj_1"]);
    expect((await store.listProjects("ana", { search: "%" })).map((p) => p.id)).toEqual(["prj_1"]);
  });

  it("cria jobs de forma idempotente por dono", async () => {
    const first = await newJob(store, "ana", "a");
    const again = await newJob(store, "ana", "a");
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.job.id).toBe(first.job.id);
    expect((await newJob(store, "bia", "b")).created).toBe(true);
  });

  it("reserva cada job uma única vez e recupera leases expirados", async () => {
    await newJob(store, "ana", "a", 2);
    const claimed = await store.claimNextJob("w1", 60_000);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempts).toBe(1);
    expect(await store.claimNextJob("w2", 60_000)).toBeNull();

    await store.updateJob(claimed!.id, { lockedUntil: new Date(Date.now() - 1000).toISOString() });
    expect(await store.recoverExpiredJobs()).toEqual({ requeued: 1, failed: 0 });
    const second = await store.claimNextJob("w2", 60_000);
    expect(second?.attempts).toBe(2);

    await store.updateJob(second!.id, { lockedUntil: new Date(Date.now() - 1000).toISOString() });
    expect(await store.recoverExpiredJobs()).toEqual({ requeued: 0, failed: 1 });
    expect((await store.getJobById(second!.id))?.status).toBe("failed");
  });

  it("cancela imediatamente jobs na fila e marca os em execução", async () => {
    const { job } = await newJob(store, "ana", "a");
    expect(await store.requestJobCancel("bia", job.id)).toBeNull();
    expect((await store.requestJobCancel("ana", job.id))?.status).toBe("canceled");
    const { job: other } = await newJob(store, "ana", "b");
    await store.claimNextJob("w", 60_000);
    const running = await store.requestJobCancel("ana", other.id);
    expect(running?.status).toBe("running");
    expect(running?.cancelRequested).toBe(true);
  });

  it("registra consumo uma única vez por chave", async () => {
    const event = { id: "use_1", jobId: null, providerId: "p", kind: "k", costCents: 120, idempotencyKey: "k1" };
    await store.recordUsage("ana", event);
    await store.recordUsage("ana", { ...event, id: "use_2" });
    expect(await store.listUsage("ana")).toHaveLength(1);
  });

  it("numera versões sequencialmente", async () => {
    await store.createProject("ana", { id: "prj_1", name: "P", aspectRatio: "16:9", timeline: emptyTimeline() });
    const asset = {
      id: "ast_1", projectId: "prj_1", kind: "video" as const, role: "render" as const, originalName: "a.mp4", storageKey: "k",
      thumbnailKey: null, mimeType: "video/mp4", sizeBytes: 1, durationMs: 1000, width: 1, height: 1, hasAudio: false,
      sha256: "x", origin: null, rightsConfirmed: true, isDemo: false,
    };
    await store.createAsset("ana", asset);
    const v1 = await store.createVersion("ana", { id: "ver_1", projectId: "prj_1", renderAssetId: "ast_1", timeline: emptyTimeline() });
    const v2 = await store.createVersion("ana", { id: "ver_2", projectId: "prj_1", renderAssetId: "ast_1", timeline: emptyTimeline() });
    expect([v1.number, v2.number]).toEqual([1, 2]);
  });
});

describe("processJob", () => {
  let store: LocalDataStore;
  beforeEach(() => {
    store = new LocalDataStore(":memory:");
  });

  const handlers = (fn: JobHandlers["render"]): JobHandlers => ({ render: fn, generation: fn, scene_detect: fn });

  it("conclui com a saída do handler", async () => {
    await newJob(store, "ana", "a");
    const job = (await store.claimNextJob("w", 60_000))!;
    const done = await processJob({ store, storage, workerId: "w", handlers: handlers(async () => ({ ok: 1 })) }, job);
    expect(done?.status).toBe("succeeded");
    expect(done?.output).toEqual({ ok: 1 });
    expect(done?.progress).toBe(1);
  });

  it("reenfileira com atraso após erro temporário e falha ao esgotar tentativas", async () => {
    await newJob(store, "ana", "a", 2);
    const failing = handlers(async () => {
      throw new Error("rede instável");
    });
    let job = (await store.claimNextJob("w", 60_000))!;
    const retried = await processJob({ store, storage, workerId: "w", handlers: failing }, job);
    expect(retried?.status).toBe("queued");
    expect(new Date(retried!.runAfter).getTime()).toBeGreaterThan(Date.now());

    await store.updateJob(job.id, { runAfter: new Date(0).toISOString() });
    job = (await store.claimNextJob("w", 60_000))!;
    const failed = await processJob({ store, storage, workerId: "w", handlers: failing }, job);
    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("rede instável");
  });

  it("não repete erros definitivos", async () => {
    await newJob(store, "ana", "a", 5);
    const job = (await store.claimNextJob("w", 60_000))!;
    const failed = await processJob(
      { store, storage, workerId: "w", handlers: handlers(async () => { throw new NonRetryableError("entrada inválida"); }) },
      job,
    );
    expect(failed?.status).toBe("failed");
  });

  it("interrompe ao detectar cancelamento no heartbeat", async () => {
    const { job: created } = await newJob(store, "ana", "a");
    const job = (await store.claimNextJob("w", 60_000))!;
    await store.requestJobCancel("ana", created.id);
    const result = await processJob(
      {
        store,
        storage,
        workerId: "w",
        handlers: handlers(async (ctx) => {
          await ctx.heartbeat();
          return {};
        }),
      },
      job,
    );
    expect(result?.status).toBe("canceled");
  });

  it("calcula atraso exponencial com teto", () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([5000, 10000, 20000]);
    expect(retryDelayMs(20)).toBe(300000);
  });
});

describe("segurança", () => {
  it("monta chaves de armazenamento só com segmentos seguros", () => {
    expect(buildStorageKey("u1", "ast_1", "original.mp4")).toBe("u1/ast_1/original.mp4");
    expect(() => buildStorageKey("u1", "..", "a")).toThrow();
    expect(() => buildStorageKey("u1", "a/b", "c")).toThrow();
    expect(() => buildStorageKey("u1", "a", "../../x")).toThrow();
  });

  it("limita requisições por janela", () => {
    resetRateLimits();
    checkRateLimit("k", 2, 1000, 0);
    checkRateLimit("k", 2, 1000, 10);
    expect(() => checkRateLimit("k", 2, 1000, 20)).toThrow(RateLimitError);
    expect(() => checkRateLimit("k", 2, 1000, 1500)).not.toThrow();
  });
});
