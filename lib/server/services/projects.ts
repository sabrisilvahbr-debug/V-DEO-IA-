import { randomUUID } from "node:crypto";
import { emptyTimeline, type Timeline } from "@/lib/domain/timeline";
import type { AspectRatio, MediaAsset, Project } from "@/lib/domain/types";
import type { RequestContext } from "../context";
import { HttpError } from "../http";
import { buildStorageKey } from "../storage/types";

export const newProjectId = () => `prj_${randomUUID().replace(/-/g, "")}`;

export async function createProject(ctx: RequestContext, input: { name: string; aspectRatio: AspectRatio }) {
  return ctx.store.createProject(ctx.user.id, {
    id: newProjectId(),
    name: input.name.trim(),
    aspectRatio: input.aspectRatio,
    timeline: emptyTimeline(input.aspectRatio),
  });
}

export async function requireProject(ctx: RequestContext, id: string): Promise<Project> {
  const project = await ctx.store.getProject(ctx.user.id, id);
  if (!project) throw new HttpError(404, "Projeto não encontrado.", "nao_encontrado");
  return project;
}

/**
 * Garante que todos os assets da timeline existem e pertencem ao usuário,
 * e que os pontos de corte estão dentro da duração de cada mídia.
 */
export async function validateTimelineAssets(ctx: RequestContext, timeline: Timeline): Promise<Map<string, MediaAsset>> {
  const ids = [...new Set([...timeline.clips.map((c) => c.assetId), ...(timeline.music ? [timeline.music.assetId] : [])])];
  const assets = new Map((await ctx.store.getAssetsByIds(ctx.user.id, ids)).map((a) => [a.id, a]));
  for (const clip of timeline.clips) {
    const asset = assets.get(clip.assetId);
    if (!asset) throw new HttpError(400, "A timeline usa uma mídia que não existe mais.", "midia_inexistente", { clipId: clip.id });
    if (asset.kind !== clip.kind) throw new HttpError(400, "Tipo de clipe incompatível com a mídia.", "tipo_incompativel", { clipId: clip.id });
    if (asset.kind === "video" && asset.durationMs !== null && clip.out > asset.durationMs / 1000 + 0.05) {
      throw new HttpError(400, "O ponto de saída passa do fim do vídeo.", "corte_invalido", { clipId: clip.id });
    }
  }
  if (timeline.music) {
    const music = assets.get(timeline.music.assetId);
    if (!music || music.kind !== "audio") throw new HttpError(400, "A trilha de áudio selecionada é inválida.", "trilha_invalida");
  }
  return assets;
}

/** Remove arquivos e registro de uma mídia. Bloqueia se estiver em uso na timeline. */
export async function deleteAsset(ctx: RequestContext, assetId: string) {
  const asset = await ctx.store.getAsset(ctx.user.id, assetId);
  if (!asset) throw new HttpError(404, "Mídia não encontrada.", "nao_encontrado");
  if (asset.projectId) {
    const project = await ctx.store.getProject(ctx.user.id, asset.projectId);
    const inUse =
      project?.timeline.clips.some((c) => c.assetId === assetId) || project?.timeline.music?.assetId === assetId;
    if (inUse) throw new HttpError(409, "Remova a mídia da timeline antes de excluí-la.", "midia_em_uso");
  }
  await ctx.store.deleteAsset(ctx.user.id, assetId);
  await ctx.storage.removePrefix(`${ctx.user.id}/${asset.id}/`);
}

/** Exclui o projeto, suas mídias (arquivos inclusive), tarefas e versões. */
export async function deleteProject(ctx: RequestContext, projectId: string) {
  await requireProject(ctx, projectId);
  const assets = await ctx.store.listAssets(ctx.user.id, { projectId });
  await ctx.store.deleteProject(ctx.user.id, projectId);
  for (const asset of assets) {
    await ctx.store.deleteAsset(ctx.user.id, asset.id);
    await ctx.storage.removePrefix(`${ctx.user.id}/${asset.id}/`).catch((error) => {
      console.error("[projetos] falha ao remover arquivos:", asset.id, error instanceof Error ? error.message : error);
    });
  }
}

/** Duplica projeto e mídias (cópias independentes dos arquivos). Exportações não são copiadas. */
export async function duplicateProject(ctx: RequestContext, projectId: string): Promise<Project> {
  const source = await requireProject(ctx, projectId);
  const copy = await ctx.store.createProject(ctx.user.id, {
    id: newProjectId(),
    name: `${source.name} (cópia)`.slice(0, 120),
    aspectRatio: source.aspectRatio,
    timeline: emptyTimeline(source.aspectRatio),
  });

  const idMap = new Map<string, string>();
  const assets = (await ctx.store.listAssets(ctx.user.id, { projectId })).filter((a) => a.role !== "render");
  for (const asset of assets) {
    const newId = `ast_${randomUUID().replace(/-/g, "")}`;
    const fileName = asset.storageKey.split("/").pop()!;
    const storageKey = buildStorageKey(ctx.user.id, newId, fileName);
    const original = await ctx.storage.materialize(asset.storageKey);
    try {
      await ctx.storage.put(storageKey, original.path, asset.mimeType);
    } finally {
      await original.cleanup();
    }
    let thumbnailKey: string | null = null;
    if (asset.thumbnailKey) {
      thumbnailKey = buildStorageKey(ctx.user.id, newId, "thumb.jpg");
      const thumb = await ctx.storage.materialize(asset.thumbnailKey);
      try {
        await ctx.storage.put(thumbnailKey, thumb.path, "image/jpeg");
      } finally {
        await thumb.cleanup();
      }
    }
    const { id: _oldId, ownerId: _owner, createdAt: _created, ...rest } = asset;
    void _oldId;
    void _owner;
    void _created;
    await ctx.store.createAsset(ctx.user.id, { ...rest, id: newId, projectId: copy.id, storageKey, thumbnailKey });
    idMap.set(asset.id, newId);
  }

  const timeline: Timeline = {
    ...source.timeline,
    clips: source.timeline.clips
      .filter((c) => idMap.has(c.assetId))
      .map((c) => ({ ...c, assetId: idMap.get(c.assetId)! })),
    music: source.timeline.music && idMap.has(source.timeline.music.assetId)
      ? { ...source.timeline.music, assetId: idMap.get(source.timeline.music.assetId)! }
      : null,
  };
  return (await ctx.store.updateProject(ctx.user.id, copy.id, { timeline }))!;
}
