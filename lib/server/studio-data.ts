import "server-only";
import type { StudioProvider, StudioSystem } from "@/components/studio/types";
import { listProviders } from "@/providers/registry";
import { serverConfig } from "./config";
import { ffmpegStatus } from "./media/ffmpeg";

export async function loadProviders(): Promise<StudioProvider[]> {
  return Promise.all(
    listProviders().map(async (provider) => ({
      ...provider.info(),
      availability: await provider.availability(),
      capabilities: await provider.getCapabilities(),
    })),
  );
}

export async function loadSystem(): Promise<StudioSystem> {
  const config = serverConfig();
  const ffmpeg = await ffmpegStatus();
  return {
    backend: config.backend,
    ffmpeg: { available: ffmpeg.available, probeAvailable: ffmpeg.probeAvailable, filters: ffmpeg.filters, version: ffmpeg.version },
    limits: { maxUploadMb: Math.round(config.maxUploadBytes / 1024 / 1024), maxVideoSeconds: config.maxVideoSeconds },
  };
}
