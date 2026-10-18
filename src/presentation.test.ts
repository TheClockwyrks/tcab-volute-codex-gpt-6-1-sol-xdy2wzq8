import { it, expect } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const filesystem = "node:fs/promises";
const { readFile } = await import(filesystem);
import type { InitApi } from "@clockwyrks/simple-2d";
import { loadAssets, renderGame } from "./presentation";
import type { VoluteState } from "./game";
import { reset } from "./simulation";
import { createDebug } from "./debug";
import * as C from "./constants";

it("decodes every shipped sprite, animation, system and cue, and renders all screens without mutating state", async () => {
  const files: string[] = [];
  const api = {
    assets: {
      loadImage: async (name: string) => {
        files.push(name);
        return await loadImage(await readFile(`public/assets/${name}`));
      },
      load: async (name: string) =>
        new Blob([await readFile(`public/assets/${name}`)]),
    },
    audio: {
      load: async (name: string, path: string) => {
        files.push(name);
        const wav = await readFile(`public/assets/${path}`);
        expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
        expect(wav.length).toBeGreaterThan(2000);
      },
    },
  } as unknown as InitApi<VoluteState>;
  await loadAssets(api);
  expect(files).toHaveLength(46);
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const render = (state: VoluteState) => {
    const before = JSON.stringify(state);
    renderGame(state, {
      ctx,
      frame: () => ({ count: 1, timeMs: 100, lastDeltaMs: 16 }),
      viewport: () => ({
        width: C.FIELD_W,
        height: C.FIELD_H,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    });
    expect(JSON.stringify(state)).toBe(before);
  };
  render(reset());
  const title = canvas.toBuffer("image/png");
  expect(title.length).toBeGreaterThan(15000);
  const d = createDebug();
  let s = d.startLevel(reset(), 5);
  s = d.poseTrain(s, [
    [4000, "halide", "choke"],
    [3972, "sulfur", "backflow"],
    [3944, "cobalt", "bore"],
    [3916, "garnet", "sightline"],
    [3888, "olivine", null],
  ]);
  s = d.grantMachinery(s, "sightline");
  s = d.setChainStep(s, 3);
  s = d.fire(s);
  s = {
    ...s,
    visuals: [
      { kind: "burst", x: 300, y: 300, charge: "cobalt", at: 0 },
      { kind: "pickup", x: 500, y: 280, charge: "halide", at: 0 },
      { kind: "bore", x: 600, y: 350, charge: "sulfur", at: 0 },
      { kind: "swallow", x: 480, y: 320, charge: "garnet", at: 0 },
    ],
    simTime: 0.12,
  };
  for (const screen of C.SCREENS) render({ ...s, screen });
  expect(canvas.toBuffer("image/png").equals(title)).toBe(false);
});
