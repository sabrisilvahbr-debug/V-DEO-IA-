import type { JobHandlers } from "../runner";
import { generationHandler } from "./generation";
import { renderHandler } from "./render";
import { sceneDetectHandler } from "./scene-detect";

export const jobHandlers: JobHandlers = {
  generation: generationHandler,
  render: renderHandler,
  scene_detect: sceneDetectHandler,
};
