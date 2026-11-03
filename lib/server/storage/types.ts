/**
 * Armazenamento de arquivos de mídia. As chaves seguem o formato
 * `<ownerId>/<assetId>/<arquivo>` e nunca vêm do navegador.
 */
export type ServeTarget =
  | { type: "local"; path: string }
  | { type: "url"; url: string };

export interface BlobStorage {
  /** Copia um arquivo local para o armazenamento. */
  put(key: string, localPath: string, contentType: string): Promise<void>;
  /**
   * Disponibiliza o arquivo no disco para processamento (FFmpeg).
   * `cleanup` remove cópias temporárias quando houver.
   */
  materialize(key: string): Promise<{ path: string; cleanup: () => Promise<void> }>;
  /** Onde o navegador deve buscar o arquivo (caminho local ou URL assinada). */
  serveTarget(key: string, options?: { expiresInSeconds?: number; downloadName?: string }): Promise<ServeTarget>;
  /** Remove todos os arquivos sob o prefixo (ex.: `<ownerId>/<assetId>/`). */
  removePrefix(prefix: string): Promise<void>;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export function buildStorageKey(ownerId: string, assetId: string, fileName: string): string {
  for (const segment of [ownerId, assetId, fileName]) {
    if (!SAFE_SEGMENT.test(segment) || segment === "." || segment === "..") {
      throw new Error(`Segmento de armazenamento inválido: ${segment}`);
    }
  }
  return `${ownerId}/${assetId}/${fileName}`;
}

export function assertSafeKey(key: string): void {
  const parts = key.split("/");
  if (parts.length < 2 || parts.some((p) => !p || p === "." || p === ".." || !SAFE_SEGMENT.test(p))) {
    throw new Error("Chave de armazenamento inválida.");
  }
}
