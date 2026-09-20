import type { ScenePack } from "./catalog";
export function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: {
    sim: { speedMps: number; distance: number };
    pack: ScenePack;
    motion: number;
    time: number;
  },
): void;
