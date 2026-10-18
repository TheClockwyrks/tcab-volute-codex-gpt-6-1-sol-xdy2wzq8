import type { InitApi, RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import type { VoluteState } from "./game";
import { at, radians } from "./geometry";
import { danger } from "./simulation";
const images: Record<string, ImageBitmap> = {};
const systems: Record<string, ParticleSystem> = {};
const COLORS: Record<C.ChargeId, string> = {
  halide: "#66e6d7",
  sulfur: "#f3cb62",
  cobalt: "#7eafff",
  garnet: "#f27683",
  olivine: "#b6e879",
};
const INK = "#e3dfc8",
  MUTED = "#8aaba9",
  GOLD = "#dbb47a";
export async function loadAssets(api: InitApi<VoluteState>) {
  const names = [
    ...C.CHARGE_IDS,
    ...C.MACHINERY_KINDS,
    "injector-base",
    "injector-barrel",
    "maw",
    "plate",
    "cell",
    "pressure",
    ...Array.from({ length: 4 }, (_, i) => `recoil-${i}`),
    ...Array.from({ length: 6 }, (_, i) => `swallow-${i}`),
    ...Array.from({ length: 6 }, (_, i) => `flash-${i}`),
  ];
  await Promise.all([
    ...names.map(async (name) => {
      images[name] = await api.assets.loadImage(`${name}.png`);
    }),
    ...Object.values(C.CUES).map((cue) => api.audio.load(cue, `${cue}.wav`)),
    ...["burst", "bore", "swallow", "pickup"].map(async (name) => {
      systems[name] = JSON.parse(
        await (await api.assets.load(`effects/${name}/system.json`)).text(),
      ) as ParticleSystem;
    }),
  ]);
  // Prepared color variants share the authored six-frame sheet.
  if (typeof OffscreenCanvas !== "undefined") {
    for (const charge of C.CHARGE_IDS)
      for (let i = 0; i < 6; i++) {
        const canvas = new OffscreenCanvas(48, 48);
        const tint = canvas.getContext("2d");
        if (!tint) throw new Error("Unable to prepare extraction flash");
        tint.drawImage(images[`flash-${i}`], 0, 0);
        tint.globalCompositeOperation = "source-in";
        tint.fillStyle = COLORS[charge];
        tint.fillRect(0, 0, 48, 48);
        images[`flash-${charge}-${i}`] = canvas.transferToImageBitmap();
      }
  }
}
function sprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  scale = 1,
) {
  const img = images[name];
  if (img)
    ctx.drawImage(
      img,
      x - (img.width * scale) / 2,
      y - (img.height * scale) / 2,
      img.width * scale,
      img.height * scale,
    );
}
function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size = 12,
  color = INK,
  align: CanvasTextAlign = "left",
  font = "monospace",
) {
  ctx.fillStyle = color;
  ctx.font = `${size >= 24 ? "600" : "500"} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillText(copy, x, y);
}
function rule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color = "#385054",
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#14272e";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#47605f";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, y, 20, 2);
  ctx.fillRect(x + w - 20, y + h - 2, 20, 2);
}
function backdrop(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#101e24";
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  const light = ctx.createRadialGradient(430, 290, 20, 430, 290, 620);
  light.addColorStop(0, "#1c343b");
  light.addColorStop(1, "#0d181e");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  ctx.lineWidth = 1;
  for (let y = 10; y < C.FIELD_H; y += 65)
    for (let x = 10; x < C.FIELD_W; x += 94) {
      ctx.strokeStyle = "#24363b";
      ctx.strokeRect(x + 0.5, y + 0.5, 86, 57);
      ctx.fillStyle = "#354548";
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + 80, y + 50, 2, 2);
    }
}
function channel(ctx: CanvasRenderingContext2D) {
  const path = () => {
    ctx.beginPath();
    C.CHANNEL.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  path();
  ctx.strokeStyle = "#080f15";
  ctx.lineWidth = 46;
  ctx.stroke();
  path();
  ctx.strokeStyle = "#52665f";
  ctx.lineWidth = 40;
  ctx.stroke();
  path();
  ctx.strokeStyle = "#17292e";
  ctx.lineWidth = 36;
  ctx.stroke();
  ctx.save();
  path();
  ctx.lineWidth = 32;
  ctx.strokeStyle = ctx.createPattern(images.plate, "repeat") ?? "#293d41";
  ctx.stroke();
  ctx.restore();
  // Fine brass seam and the direction of flow stamped into the plates.
  for (let s = 70; s < C.PATH_LENGTH - 80; s += 112) {
    const p = at(s);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.dy, p.dx));
    ctx.fillStyle = "#152b30";
    ctx.fillRect(0, -15, 2, 30);
    ctx.strokeStyle = "#65756a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, 4);
    ctx.stroke();
    ctx.restore();
  }
  text(ctx, "INLET", 39, 16, 9, GOLD);
  sprite(
    ctx,
    "maw",
    C.CHANNEL[C.CHANNEL.length - 1].x,
    C.CHANNEL[C.CHANNEL.length - 1].y,
  );
}
function core(
  ctx: CanvasRenderingContext2D,
  charge: C.ChargeId,
  x: number,
  y: number,
  scale = 1,
  mark: C.MachineryKind | null = null,
) {
  ctx.save();
  ctx.shadowColor = COLORS[charge];
  ctx.shadowBlur = 7;
  sprite(ctx, charge, x, y, scale);
  ctx.restore();
  if (mark) sprite(ctx, mark, x, y);
}
function injector(ctx: CanvasRenderingContext2D, s: DeepReadonly<VoluteState>) {
  ctx.save();
  ctx.translate(C.INJECTOR_X, C.INJECTOR_Y);
  ctx.strokeStyle = "#58736e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 31, 0, Math.PI * 2);
  ctx.stroke();
  for (let a = 0; a < 360; a += 30) {
    const r = radians(a);
    ctx.fillStyle = "#55716c";
    ctx.fillRect(Math.cos(r) * 36 - 1, Math.sin(r) * 36 - 1, 2, 2);
  }
  sprite(ctx, "injector-base", 0, 0);
  ctx.rotate(radians(s.aim));
  const frame =
    s.fireCooldown > 0
      ? Math.min(
          3,
          Math.floor(
            ((C.FIRE_COOLDOWN - s.fireCooldown) / C.FIRE_COOLDOWN) * 4,
          ),
        )
      : -1;
  sprite(ctx, frame < 0 ? "injector-barrel" : `recoil-${frame}`, 12, 0);
  ctx.restore();
  if (s.loaded) core(ctx, s.loaded, C.INJECTOR_X, C.INJECTOR_Y, 0.72);
  if (s.machinery?.kind === "sightline") {
    const a = radians(s.aim);
    let length = 0;
    for (; length < 1200; length += 2) {
      const x = C.INJECTOR_X + Math.cos(a) * length,
        y = C.INJECTOR_Y + Math.sin(a) * length;
      if (
        x < 0 ||
        x > C.FIELD_W ||
        y < 0 ||
        y > C.FIELD_H ||
        s.cores.some(
          (c) => Math.hypot(at(c.s).x - x, at(c.s).y - y) <= C.CORE_RADIUS,
        )
      )
        break;
    }
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#a9edd1";
    ctx.beginPath();
    ctx.moveTo(
      C.INJECTOR_X + Math.cos(a) * 40,
      C.INJECTOR_Y + Math.sin(a) * 40,
    );
    ctx.lineTo(
      C.INJECTOR_X + Math.cos(a) * length,
      C.INJECTOR_Y + Math.sin(a) * length,
    );
    ctx.stroke();
    ctx.restore();
  }
}
function effects(
  ctx: CanvasRenderingContext2D,
  s: DeepReadonly<VoluteState>,
  dt: number,
) {
  for (const [i, v] of s.visuals.entries()) {
    const age = Math.max(0, s.simTime - v.at);
    if (age > 0.8) continue;
    if (v.kind === "burst" && age < 0.3) {
      const frame = Math.min(5, Math.floor((age / 0.3) * 6));
      // A tiny isolated surface tints the authored neutral flash without tinting the hall.
      ctx.save();
      ctx.globalAlpha = 1 - age / 0.3;
      sprite(
        ctx,
        images[`flash-${v.charge}-${frame}`]
          ? `flash-${v.charge}-${frame}`
          : `flash-${frame}`,
        v.x,
        v.y,
      );
      ctx.restore();
    }
    if (v.kind === "swallow" && age < 0.48)
      sprite(
        ctx,
        `swallow-${Math.min(5, Math.floor((age / 0.48) * 6))}`,
        C.CHANNEL[C.CHANNEL.length - 1].x,
        C.CHANNEL[C.CHANNEL.length - 1].y,
      );
    const system = systems[v.kind];
    if (!system) continue;
    ctx.save();
    ctx.translate(v.x - 64, v.y - 64);
    ctx.scale(128 / ctx.canvas.width, 128 / ctx.canvas.height);
    const tinted: ParticleSystem =
      v.kind === "burst"
        ? {
            ...system,
            emitters: system.emitters.map((e) => ({
              ...e,
              particle: {
                ...e.particle,
                colorGradient: [
                  { color: COLORS[v.charge], at: 0 },
                  { color: "#d5fff0", at: 1 },
                ],
              },
            })),
          }
        : system;
    const player = new ParticleCanvasPlayer(tinted, ctx, {
      clear: false,
      seed: Math.floor(v.at * 100000) + i * 7919,
      pixelRadius: 2,
    });
    // Replay the pure particle simulation to the event age; no state lives in drawing.
    const frameDelta = Math.min(age, dt);
    player.simulator.step((age - frameDelta) * 1000);
    player.update(frameDelta);
    ctx.restore();
  }
}
function hud(ctx: CanvasRenderingContext2D, s: DeepReadonly<VoluteState>) {
  panel(ctx, 239, 65, 548, 34);
  text(ctx, "VOLUTE", 252, 87, 15, GOLD);
  text(ctx, "SCORE", 350, 79, 8, MUTED);
  text(ctx, String(s.score).padStart(6, "0"), 350, 92, 12);
  text(ctx, "HALL", 436, 79, 8, MUTED);
  text(
    ctx,
    `${String(s.level).padStart(2, "0")} / ${C.LEVEL_COUNT}`,
    436,
    92,
    12,
  );
  for (let i = 0; i < s.cells; i++) sprite(ctx, "cell", 522 + i * 19, 83, 0.7);
  sprite(ctx, "pressure", 600, 82, 0.75);
  text(ctx, "PRESSURE", 618, 78, 8, MUTED);
  ctx.fillStyle = "#0c1a20";
  ctx.fillRect(618, 84, 100, 6);
  ctx.fillStyle = s.pressure > 70 ? "#ed8b72" : "#85c3ae";
  ctx.fillRect(618, 84, s.pressure, 6);
  text(ctx, `${Math.round(s.pressure)}%`, 772, 87, 10, INK, "right");
  text(ctx, "INJECTOR / 01", C.INJECTOR_X, 274, 10, MUTED, "center");
  text(ctx, "LOADED", 326, 363, 8, MUTED, "center");
  if (s.loaded) core(ctx, s.loaded, 326, 338);
  text(ctx, "NEXT · X", 530, 387, 8, MUTED, "center");
  if (s.queued) core(ctx, s.queued, 530, 362);
  if (s.chainTimer > 0 && s.chainStep > 1)
    text(ctx, `CHAIN ×${s.chainStep}`, C.INJECTOR_X, 393, 13, GOLD, "center");
  if (s.machinery) {
    sprite(ctx, s.machinery.kind, 710, 325);
    text(ctx, s.machinery.kind.toUpperCase(), 710, 351, 10, GOLD, "center");
    text(
      ctx,
      `${s.machinery.remaining.toFixed(1)} SEC`,
      710,
      367,
      9,
      MUTED,
      "center",
    );
  }
  text(ctx, "GEOTHERMAL PUMP HALL", 24, 535, 9, MUTED);
  text(
    ctx,
    `FEED ${s.quotaRemaining}   /   CLICK / SPACE  FIRE    X  SWAP    P  PAUSE`,
    C.FIELD_W / 2,
    535,
    9,
    MUTED,
    "center",
  );
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    936,
    535,
    9,
    GOLD,
    "right",
  );
  if (danger(s)) {
    ctx.strokeStyle = "#dc8869";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, C.FIELD_W - 4, C.FIELD_H - 4);
    text(ctx, "! INTAKE APPROACHING", 710, 194, 12, "#f1a07b", "center");
  }
}
function title(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#0a171fd9";
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Large quiet title card, set between the channel's outer rails.
  panel(ctx, 162, 140, 636, 274);
  ctx.fillStyle = "#d3ac74";
  ctx.fillRect(162, 140, 5, 274);
  text(
    ctx,
    "G E O T H E R M A L   /   P U M P   H A L L   0 1",
    191,
    169,
    9,
    GOLD,
  );
  text(ctx, C.TITLE_TEXT, 185, 246, 80, INK, "left", "Georgia, serif");
  text(ctx, "KEEP THE HALL ALIVE.", 191, 274, 12, GOLD);
  text(
    ctx,
    "Match three mineral cores. Extract the pressure.",
    191,
    297,
    10,
    MUTED,
  );
  rule(ctx, 191, 317, 349);
  text(ctx, "AIM", 191, 339, 9, GOLD);
  text(ctx, "POINTER / ← →", 254, 339, 10, INK);
  text(ctx, "FIRE", 191, 359, 9, GOLD);
  text(ctx, "CLICK / SPACE", 254, 359, 10, INK);
  text(ctx, "SWAP", 191, 379, 9, GOLD);
  text(ctx, "X", 254, 379, 10, INK);
  text(ctx, "P / ESC  PAUSE     M  SOUND", 191, 399, 9, MUTED);
  rule(ctx, 566, 169, 200);
  text(ctx, "MINERAL CHARGES", 666, 191, 9, MUTED, "center");
  C.CHARGE_IDS.forEach((charge, i) => core(ctx, charge, 590 + i * 37, 222));
  ctx.save();
  ctx.translate(662, 290);
  sprite(ctx, "injector-base", 0, 0, 1.8);
  ctx.rotate(-Math.PI / 4);
  sprite(ctx, "injector-barrel", 20, 0, 1.8);
  ctx.restore();
  text(ctx, "3 CELLS · 5 HALLS", 666, 347, 10, GOLD, "center");
  ctx.fillStyle = "#d8bb87";
  ctx.fillRect(567, 365, 199, 33);
  text(ctx, "ENTER / CLICK TO BEGIN", 666, 386, 11, "#15282d", "center");
  text(
    ctx,
    "EXTRACT / CHAIN / SURVIVE",
    C.FIELD_W / 2,
    465,
    10,
    MUTED,
    "center",
  );
  text(ctx, "V O L U T E   /   MINERAL RECOVERY DIVISION", 24, 526, 9, MUTED);
  text(ctx, "BROWSER ARCADE • 01", 936, 526, 9, MUTED, "right");
}
export function renderGame(s: DeepReadonly<VoluteState>, api: RenderApi) {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  backdrop(ctx);
  channel(ctx);
  for (const c of s.cores) {
    const p = at(c.s);
    core(ctx, c.charge, p.x, p.y, 1, c.mark);
  }
  injector(ctx, s);
  for (const p of s.projectiles) core(ctx, p.charge, p.x, p.y);
  effects(ctx, s, api.frame().lastDeltaMs / 1000);
  if (s.screen === "title") {
    title(ctx);
    return;
  }
  if (["playing", "paused", "cleared", "setback"].includes(s.screen))
    hud(ctx, s);
  if (s.screen === "playing") return;
  ctx.fillStyle = "#09161cc4";
  ctx.fillRect(155, 145, 650, 280);
  panel(ctx, 263, 168, 434, 244);
  const headings = {
    paused: "HALL ON HOLD",
    cleared: `HALL ${String(s.level).padStart(2, "0")} CLEAR`,
    setback: "CELL SPENT",
    gameover: "PRESSURE WON",
    victory: "ALL HALLS CLEAR",
  };
  text(ctx, "— VOLUTE / OPERATIONS —", 480, 200, 10, GOLD, "center");
  text(ctx, headings[s.screen], 480, 254, 32, INK, "center", "Georgia, serif");
  const copy =
    s.screen === "paused"
      ? "P / ESC TO RESUME"
      : s.screen === "setback"
        ? `${s.cells} CELLS REMAINING`
        : s.screen === "cleared"
          ? `+${C.CLEAR_SCORE}  /  PROCEEDING TO NEXT HALL`
          : s.screen === "victory"
            ? "EVERY LEVEL OF THE HALL CLEARED"
            : `REACHED HALL ${s.level} / ${C.LEVEL_COUNT}`;
  text(ctx, copy, 480, 286, 11, MUTED, "center");
  if (s.screen !== "paused")
    text(
      ctx,
      `SCORE  ${String(s.score).padStart(6, "0")}`,
      480,
      323,
      20,
      GOLD,
      "center",
    );
  const prompt =
    s.screen === "gameover" || s.screen === "victory"
      ? "ENTER / CLICK TO RETURN"
      : s.screen === "paused"
        ? "THE HALL WAITS FOR YOU."
        : `RESTART IN ${s.interlude.toFixed(1)} SEC`;
  text(ctx, prompt, 480, 380, 10, GOLD, "center");
}
