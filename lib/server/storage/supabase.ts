import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSafeKey, type BlobStorage } from "./types";

/**
 * Supabase Storage (bucket privado). Downloads usam URLs assinadas com
 * expiração. Ainda não verificado contra um projeto real (ver docs/supabase.md).
 */
export class SupabaseBlobStorage implements BlobStorage {
  constructor(
    private readonly client: SupabaseClient,
    private readonly bucket: string,
    private readonly tmpDir: string,
  ) {}

  async put(key: string, localPath: string, contentType: string) {
    assertSafeKey(key);
    const { error } = await this.client.storage.from(this.bucket).upload(key, createReadStream(localPath), {
      contentType,
      upsert: false,
      duplex: "half",
    });
    if (error) throw new Error(`Falha ao enviar para o Storage: ${error.message}`);
  }

  async materialize(key: string) {
    assertSafeKey(key);
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(key, 600);
    if (error || !data) throw new Error(`Falha ao acessar arquivo: ${error?.message ?? "sem URL"}`);
    const response = await fetch(data.signedUrl);
    if (!response.ok || !response.body) throw new Error(`Download falhou (${response.status}).`);
    const dir = path.join(this.tmpDir, `dl-${crypto.randomUUID()}`);
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, path.basename(key));
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createWriteStream(target));
    return { path: target, cleanup: () => rm(dir, { recursive: true, force: true }) };
  }

  async serveTarget(key: string, options: { expiresInSeconds?: number; downloadName?: string } = {}) {
    assertSafeKey(key);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, options.expiresInSeconds ?? 300, options.downloadName ? { download: options.downloadName } : undefined);
    if (error || !data) throw new Error(`Falha ao gerar URL assinada: ${error?.message ?? "sem URL"}`);
    return { type: "url" as const, url: data.signedUrl };
  }

  async removePrefix(prefix: string) {
    const folder = prefix.replace(/\/$/, "");
    assertSafeKey(folder);
    const { data, error } = await this.client.storage.from(this.bucket).list(folder);
    if (error) throw new Error(`Falha ao listar arquivos: ${error.message}`);
    const keys = (data ?? []).map((file) => `${folder}/${file.name}`);
    if (keys.length) {
      const removed = await this.client.storage.from(this.bucket).remove(keys);
      if (removed.error) throw new Error(`Falha ao remover arquivos: ${removed.error.message}`);
    }
  }
}
