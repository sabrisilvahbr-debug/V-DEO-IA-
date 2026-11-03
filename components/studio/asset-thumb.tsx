import { AudioLines, Film, ImageIcon } from "lucide-react";
import type { MediaAsset } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Miniatura da mídia servida pela API privada (ou ícone, para áudio). */
export function AssetThumb({ asset, className }: { asset: Pick<MediaAsset, "id" | "kind" | "thumbnailKey">; className?: string }) {
  const Icon = asset.kind === "audio" ? AudioLines : asset.kind === "image" ? ImageIcon : Film;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded bg-surface-overlay", className)}>
      {asset.thumbnailKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- mídia privada servida pela API, sem otimização
        <img src={`/api/media/${asset.id}?variant=thumb`} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <Icon aria-hidden="true" className="size-5 text-fg-subtle" />
      )}
    </div>
  );
}
