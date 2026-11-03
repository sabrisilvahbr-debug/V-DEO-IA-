import type { FfmpegStatus } from "@/lib/server/media/ffmpeg";
import type { PublicJob } from "@/lib/server/jobs/public";
import type { MediaAsset, Project, ProjectVersion } from "@/lib/domain/types";
import type { ProviderAvailability, ProviderCapabilities, ProviderInfo } from "@/providers/types";

export type StudioProvider = ProviderInfo & { availability: ProviderAvailability; capabilities: ProviderCapabilities };

export type StudioSystem = {
  backend: "local" | "supabase";
  ffmpeg: Pick<FfmpegStatus, "available" | "probeAvailable" | "filters" | "version">;
  limits: { maxUploadMb: number; maxVideoSeconds: number };
};

export type StudioInitialData = {
  project: Project;
  assets: MediaAsset[];
  versions: ProjectVersion[];
  jobs: PublicJob[];
  providers: StudioProvider[];
  system: StudioSystem;
};

export type { PublicJob };
