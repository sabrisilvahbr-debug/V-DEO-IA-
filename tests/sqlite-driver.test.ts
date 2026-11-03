// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { emptyTimeline } from "@/lib/domain/timeline";
import { LocalDataStore } from "@/lib/server/store/local";
import { openSqlite } from "@/lib/server/store/sqlite-driver";

const original = process.env.CINEMORPH_SQLITE_DRIVER;
afterEach(() => {
  if (original === undefined) delete process.env.CINEMORPH_SQLITE_DRIVER;
  else process.env.CINEMORPH_SQLITE_DRIVER = original;
});

const hasBetter = (() => {
  try {
    process.env.CINEMORPH_SQLITE_DRIVER = "better-sqlite3";
    openSqlite(":memory:").db.close();
    return true;
  } catch {
    return false;
  } finally {
    delete process.env.CINEMORPH_SQLITE_DRIVER;
  }
})();

describe("driver SQLite", () => {
  it.skipIf(!hasBetter)("funciona com better-sqlite3 (Node 20+)", async () => {
    process.env.CINEMORPH_SQLITE_DRIVER = "better-sqlite3";
    const store = new LocalDataStore(":memory:");
    expect(store.driver).toBe("better-sqlite3");
    await store.createProject("ana", { id: "prj_1", name: "P", aspectRatio: "16:9", timeline: emptyTimeline() });
    const { job } = await store.createJob("ana", {
      id: "job_1", projectId: "prj_1", type: "render", providerId: null, input: { a: 1 },
      idempotencyKey: "k", maxAttempts: 2, costEstimateCents: 0,
    });
    const claimed = await store.claimNextJob("w", 60_000);
    expect(claimed?.id).toBe(job.id);
    expect((await store.updateJob(job.id, { status: "succeeded", output: { ok: true } }))?.output).toEqual({ ok: true });
    expect((await store.listProjects("ana"))[0].name).toBe("P");
    store.close();
  });
});
