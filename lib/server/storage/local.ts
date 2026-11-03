import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey, type BlobStorage } from "./types";

/** Armazenamento em pasta local (privada: só é servida pela API autenticada). */
export class LocalBlobStorage implements BlobStorage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    assertSafeKey(key.replace(/\/$/, ""));
    const full = path.resolve(this.baseDir, key);
    if (!full.startsWith(path.resolve(this.baseDir) + path.sep)) {
      throw new Error("Caminho fora do armazenamento.");
    }
    return full;
  }

  async put(key: string, localPath: string) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(localPath, target);
  }

  async materialize(key: string) {
    return { path: this.resolve(key), cleanup: async () => {} };
  }

  async serveTarget(key: string) {
    return { type: "local" as const, path: this.resolve(key) };
  }

  async removePrefix(prefix: string) {
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}
