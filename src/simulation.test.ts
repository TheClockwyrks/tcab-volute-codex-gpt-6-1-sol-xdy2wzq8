import { describe, it, expect, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { game } from "./game";
import type { VoluteState } from "./game";
import { createDebug } from "./debug";
import { at } from "./geometry";
import { reset, tick, updateGame } from "./simulation";
vi.mock("./presentation", () => ({
  loadAssets: async (api: InitApi<VoluteState>) => {
    Object.values(C.CUES).forEach((cue) =>
      api.audio.define(cue, { freq: 200, durationMs: 30 }),
    );
  },
  renderGame: () => {},
}));
const d = createDebug();
function hall() {
  let s = d.startLevel(reset(), 1);
  s = d.setEmission(s, false);
  return d.clearTrain(s);
}
function step(s: VoluteState, n = 1) {
  for (let i = 0; i < n; i++) s = tick(s, C.TICK_DT);
  return s;
}
function api(
  pressed: string[] = [],
  held: Record<string, number> = {},
  click = false,
  point = { x: -1, y: -1 },
): UpdateApi {
  let muted = false;
  const loops = new Set<string>();
  return {
    input: {
      value: (n) => held[n] ?? 0,
      pressed: (n) => pressed.includes(n),
      pointer: () => ({ ...point, down: click, device: "mouse", buttons: [] }),
      pointerPressed: () => click,
      pointerReleased: () => false,
      pointerSamples: () => [],
      pointerContacts: () => [],
      wheel: () => ({ x: 0, y: 0, z: 0 }),
    },
    audio: {
      play: vi.fn(),
      loop: (n) => {
        loops.add(n);
      },
      stop: (n) => {
        loops.delete(n);
      },
      looping: (n) => loops.has(n),
      setMuted: (m) => {
        muted = m;
      },
      muted: () => muted,
    },
    frame: () => ({ count: 0, timeMs: 0, lastDeltaMs: 0 }),
    viewport: () => ({
      width: C.FIELD_W,
      height: C.FIELD_H,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }),
  };
}
describe("channel geometry and debug poses", () => {
  it("selects the outgoing leg at corners and holds negative arcs at the inlet", () => {
    expect(at(880)).toEqual({ x: 920, y: 40, dx: 0, dy: 1 });
    expect(at(-42).x).toBe(40);
    expect(at(C.PATH_LENGTH)).toMatchObject({ x: 480, y: 320, dx: -1 });
  });
  it("starts with the complete title value and preserves caller gates on reset", () => {
    const s = reset({ ...hall(), emission: false, feed: false, muted: true });
    expect(s).toMatchObject({
      screen: "title",
      score: 0,
      cells: C.CELLS,
      level: 1,
      loaded: null,
      queued: null,
      aim: C.AIM_START,
      simTime: 0,
      emission: false,
      feed: false,
      muted: true,
    });
  });
  it("seeds quotas, charges and the twelfth machinery mark", () => {
    const s = d.startLevel(reset(), 5);
    expect(s.cores).toHaveLength(C.SEEDED_CORES);
    expect(s.cores[0].s).toBe(C.SEEDED_HEAD_S);
    expect(s.cores[s.cores.length - 1]?.mark).toBe("choke");
    expect(s.quotaRemaining).toBe(C.LEVELS[4].quota - C.SEEDED_CORES);
  });
  it("sorts a pose, builds segments, and snapshots live derived readings", () => {
    const s = d.poseTrain(hall(), [
      [100, "halide", null],
      [180, "cobalt", null],
      [152, "cobalt", null],
      [-28, "sulfur", null],
    ]);
    const snap = d.snapshot(d.setPressure(s, 50));
    expect(snap.segments.map((g) => g.count)).toEqual([2, 1, 1]);
    expect(snap.train.map((c) => c.segment)).toEqual([0, 0, 1, 2]);
    expect(snap.feedSpeed).toBe(C.LEVELS[0].feedSpeed * 1.5);
    expect(d.reconcile(d.reconcile(s))).toEqual(s);
  });
  it("rejects invalid domains without clamping or silently ignoring them", () => {
    const s = hall();
    expect(() => d.setLevel(s, 0)).toThrow();
    expect(() => d.setPressure(s, 101)).toThrow();
    expect(() => d.setCells(s, 0.5)).toThrow();
    expect(() => d.setAim(s, NaN)).toThrow();
    expect(() => d.poseTrain(s, [[5001, "halide", null]])).toThrow();
    expect(() => d.grantMachinery(s, "bore" as "choke")).toThrow();
    expect(d.setAim(s, -450).aim).toBe(270);
    expect(d.setQuotaRemaining(s, 999).quotaRemaining).toBe(999);
  });
});
describe("train and pressure", () => {
  it("advances lead and trailing segments at different rates", () => {
    const s = step(
      d.poseTrain(hall(), [
        [500, "halide", null],
        [100, "cobalt", null],
      ]),
    );
    expect(s.cores[0].s).toBeCloseTo(500 + C.LEVELS[0].feedSpeed * C.TICK_DT);
    expect(s.cores[1].s).toBeCloseTo(100 + C.CATCHUP_SPEED * C.TICK_DT);
  });
  it("clamps a catchup merge exactly to spacing without extracting an unrelated run", () => {
    const s = step(
      d.poseTrain(hall(), [
        [100, "halide", null],
        [70, "cobalt", null],
        [42, "cobalt", null],
      ]),
    );
    expect(s.segments).toHaveLength(1);
    expect(s.cores[0].s - s.cores[1].s).toBeCloseTo(C.SPACING);
    expect(s.score).toBe(0);
  });
  it("does not extract a seeded triple without insertion or merge", () => {
    const s = step(
      d.poseTrain(hall(), [
        [200, "halide", null],
        [172, "halide", null],
        [144, "halide", null],
      ]),
    );
    expect(s.cores).toHaveLength(3);
    expect(s.score).toBe(0);
  });
  it("emits one posed charge and marks each interval", () => {
    let s = d.setEmission(hall(), true);
    s = d.setQuotaRemaining(s, C.LEVELS[0].quota - C.MARK_INTERVAL + 1);
    s = d.setNextEmitted(s, "garnet");
    s = step(s);
    expect(s.cores[0]).toEqual({ s: 0, charge: "garnet", mark: "choke" });
    expect(s.nextEmitted).toBeNull();
    expect(step(s).cores).toHaveLength(1);
  });
  it("holds emission independently of feed and quota", () => {
    let s = d.setNextEmitted(d.setFeed(hall(), false), "cobalt");
    s = step(s, 60);
    expect(s.cores).toHaveLength(0);
    expect(s.nextEmitted).toBe("cobalt");
    s = step(d.setEmission(s, true));
    expect(s.cores).toHaveLength(1);
  });
  it("raises and bleeds pressure by elapsed seconds, and caps both ends", () => {
    let s = d.poseTrain(
      hall(),
      Array.from(
        { length: 30 },
        (_, i) => [2000 - i * C.SPACING, "halide", null] as const,
      ),
    );
    s = d.setFeed(s, false);
    s = step(s, 60);
    expect(s.pressure).toBeCloseTo(6 * C.PRESSURE_RISE_PER_CORE);
    s = step(d.setPressure(d.clearTrain(s), 1), 60);
    expect(s.pressure).toBe(0);
  });
  it("holds a recoiled segment then resumes its advance", () => {
    let s = d.poseTrain(hall(), [[300, "cobalt", null]]);
    s = { ...s, segments: [{ count: 1, hold: C.RECOIL_HOLD }] };
    const still = step(s, 10);
    expect(still.cores[0].s).toBe(300);
    expect(step(still, 30).cores[0].s).toBeGreaterThan(300);
  });
});
describe("projectiles, extractions and machinery", () => {
  function shot(mark: C.MachineryKind | null = null) {
    let s = d.setFeed(hall(), false);
    s = d.poseTrain(s, [
      [410, "halide", mark],
      [382, "halide", null],
      [354, "cobalt", null],
    ]);
    // Above the injector on the first channel leg; the third core is behind the match.
    s = d.setLoaded(s, "halide");
    s = d.setAim(s, 270);
    return d.fire(s);
  }
  it("launches from the center and swaps its queue even on a paused screen", () => {
    let s = d.setQueued(d.setLoaded(d.pause(hall()), "halide"), "sulfur");
    s = d.fire(d.setAim(s, 450));
    expect(s.projectiles[0]).toEqual({
      x: C.INJECTOR_X,
      y: C.INJECTOR_Y,
      angle: 90,
      charge: "halide",
    });
    expect(s.loaded).toBe("sulfur");
    expect(s.fireCooldown).toBe(C.FIRE_COOLDOWN);
  });
  it("inserts, extracts a triple, scores, and recoils the trailing core", () => {
    const sounds: string[] = [];
    let s = shot();
    for (let i = 0; i < 30; i++)
      s = tick(s, C.TICK_DT, (cue) => sounds.push(cue));
    expect(s.score).toBe(3 * C.SCORE_PER_CORE);
    expect(s.cores).toHaveLength(1);
    expect(s.cores[0].s).toBe(354 - C.SPACING - C.RECOIL);
    expect(sounds).toContain(C.CUES.seat);
    expect(sounds).toContain(C.CUES.extract1);
  });
  it("scores a merge at the incremented chain step", () => {
    let s = d.poseTrain(hall(), [
      [200, "halide", null],
      [172, "halide", null],
      [142, "halide", null],
    ]);
    s = d.setChainStep(s, 2);
    s = step(s);
    expect(s.cores).toHaveLength(0);
    expect(s.chainStep).toBe(3);
    expect(s.score).toBe(3 * C.SCORE_PER_CORE * 3);
  });
  it.each(["choke", "backflow", "sightline"] as const)(
    "grants %s from a marked extraction",
    (kind) => {
      const s = step(shot(kind), 27);
      expect(s.machinery?.kind).toBe(kind);
      expect(s.visuals.some((v) => v.kind === "pickup")).toBe(true);
    },
  );
  it("bore removes nearby cores, scores them, and does not grant their marks", () => {
    let s = shot("bore");
    s = d.poseTrain(s, [
      [450, "cobalt", "sightline"],
      [410, "halide", "bore"],
      [382, "halide", null],
      [200, "sulfur", null],
    ]);
    s = step(s, 27);
    expect(s.cores).toHaveLength(1);
    expect(s.cores[0].charge).toBe("sulfur");
    expect(s.score).toBe(4 * C.SCORE_PER_CORE);
    expect(s.machinery).toBeNull();
  });
  it("backflow packs against the inlet and suppresses emissions", () => {
    let s = d.poseTrain(hall(), [
      [100, "halide", null],
      [30, "cobalt", null],
      [0, "sulfur", null],
    ]);
    s = d.setEmission(d.grantMachinery(s, "backflow"), true);
    s = step(s, 120);
    expect(s.cores.map((c) => c.s)).toEqual([56, 28, 0]);
    expect(s.quotaRemaining).toBe(C.LEVELS[0].quota - C.SEEDED_CORES);
  });
  it("choke scales only the lead feed, and timed machinery expires", () => {
    let s = d.grantMachinery(
      d.poseTrain(hall(), [
        [500, "halide", null],
        [100, "cobalt", null],
      ]),
      "choke",
    );
    s = step(s);
    expect(s.cores[0].s).toBeCloseTo(
      500 + C.LEVELS[0].feedSpeed * C.CHOKE_FEED_MULTIPLIER * C.TICK_DT,
    );
    expect(s.cores[1].s).toBe(103);
    s = step(s, 480);
    expect(s.machinery).toBeNull();
  });
  it("discarded shots outside the field never alter the train", () => {
    let s = d.fire(d.setAim(d.setLoaded(hall(), "halide"), 90));
    s = step(s, 60);
    expect(s.projectiles).toHaveLength(0);
    expect(s.score).toBe(0);
  });
});
it("expires the chain window and timed machinery on their exact final tick", () => {
  let s = d.setFeed(d.poseTrain(hall(), [[100, "halide", null]]), false);
  s = d.setChainStep(d.grantMachinery(s, "backflow"), 4);
  s = step(s, C.CHAIN_RESET * C.TICK_HZ);
  expect(s.chainStep).toBe(1);
  expect(s.chainTimer).toBe(0);
  s = step(s, (C.MACHINERY_DURATIONS.backflow - C.CHAIN_RESET) * C.TICK_HZ);
  expect(s.machinery).toBeNull();
});
describe("screens, fixed ticks and engine integration", () => {
  it("spends one cell per intake tick and ends on the last cell", () => {
    let s = d.poseTrain(hall(), [[C.PATH_LENGTH, "cobalt", null]]);
    s = step(s);
    expect(s.screen).toBe("setback");
    expect(s.cells).toBe(C.CELLS - 1);
    expect(s.cores).toEqual([]);
    s = d.poseTrain(d.setCells(hall(), 1), [[C.PATH_LENGTH, "cobalt", null]]);
    s = step(s);
    expect(s.screen).toBe("gameover");
    expect(s.interlude).toBe(0);
  });
  it("clears an exhausted hall and awards the final victory", () => {
    let s = step(d.setQuotaRemaining(hall(), 0));
    expect(s).toMatchObject({
      screen: "cleared",
      score: C.CLEAR_SCORE,
      interlude: C.INTERLUDE,
    });
    s = step(d.setQuotaRemaining(d.setLevel(hall(), C.LEVEL_COUNT), 0));
    expect(s.screen).toBe("victory");
  });
  it("pause freezes rules while simTime and mute still update", () => {
    const s = d.pause(d.poseTrain(hall(), [[100, "halide", null]]));
    const next = updateGame(s, api(["mute"]), 1);
    expect(next.cores).toEqual(s.cores);
    expect(next.simTime).toBe(1);
    expect(next.muted).toBe(true);
    expect(next.accumulator).toBe(0);
  });
  it("reads pointer confirm only inside the field, and never fires on the start press", () => {
    expect(updateGame(reset(), api([], {}, true), C.TICK_DT).screen).toBe(
      "title",
    );
    const s = updateGame(
      reset(),
      api([], {}, true, { x: 500, y: 300 }),
      C.TICK_DT,
    );
    expect(s.screen).toBe("playing");
    expect(s.projectiles).toEqual([]);
  });
  it("uses edges for fire, swaps during cooldown, and refuses a second shot", () => {
    let s = d.setLoaded(hall(), "halide");
    s = d.setQueued(s, "cobalt");
    const a = api(["a"]);
    s = updateGame(s, a, C.TICK_DT);
    expect(s.projectiles).toHaveLength(1);
    const b = api(["a", "b"]);
    s = updateGame(s, b, C.TICK_DT);
    expect(s.projectiles).toHaveLength(1);
    expect(b.audio.play).toHaveBeenCalledWith(C.CUES.denied);
    expect(b.audio.play).toHaveBeenCalledWith(C.CUES.swap);
  });
  it("produces the same train after equal elapsed time at different frame rates", () => {
    const initial = d.poseTrain(hall(), [[100, "halide", null]]);
    let a = initial,
      b = initial;
    for (let i = 0; i < 60; i++) a = updateGame(a, api(), 1 / 60);
    for (let i = 0; i < 20; i++) b = updateGame(b, api(), 1 / 20);
    expect(a.cores).toEqual(b.cores);
    expect(a.pressure).toBe(b.pressure);
  });
  it("opens the next hall after the interlude and dismisses endings", () => {
    let s = step(d.setQuotaRemaining(hall(), 0));
    s = updateGame(s, api(), C.INTERLUDE);
    expect(s.screen).toBe("playing");
    expect(s.level).toBe(2);
    s = updateGame(d.setScreen(s, "victory"), api(["confirm"]), C.TICK_DT);
    expect(s.screen).toBe("title");
    expect(s.score).toBe(0);
  });
  it("runs over the real engine with a ConstantClock, diagnoses state, and switches beds", async () => {
    const engine = createEngine({
      canvas: createCanvas(
        C.FIELD_W,
        C.FIELD_H,
      ) as unknown as HTMLCanvasElement,
      width: C.FIELD_W,
      height: C.FIELD_H,
      game,
      clock: new ConstantClock(1000 / C.TICK_HZ),
      surface: {
        cssWidth: () => C.FIELD_W,
        cssHeight: () => C.FIELD_H,
        dpr: () => 1,
        events: () => new EventTarget(),
      },
    });
    const cues: string[] = [];
    engine.events.on("cue:looped", (e) => cues.push(e.cue));
    await engine.initialize();
    engine.apply((s) => engine.debug.startLevel(s, 1));
    engine.apply((s) => engine.debug.setEmission(s, false));
    engine.apply((s) =>
      engine.debug.poseTrain(s, [[C.DANGER_S, "halide", null]]),
    );
    await engine.advance(60);
    expect(engine.debug.snapshot(engine.state).simTime).toBeCloseTo(1);
    expect(cues).toContain(C.CUES.dangerLoop);
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(12);
    engine.apply((s) => engine.debug.pause(s));
    await engine.advance(1);
    expect(engine.state.screen).toBe("paused");
    engine.destroy();
  });
});
