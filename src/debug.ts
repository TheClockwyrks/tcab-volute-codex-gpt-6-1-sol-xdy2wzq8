import type { DeepReadonly } from "ts-essentials";
import type { VoluteState, VoluteDebugApi, Snapshot } from "./game";
import * as C from "./constants";
import { at, groups, holdsFor, normalize } from "./geometry";
import { danger, feedSpeed, launch, openLevel, reset } from "./simulation";
type State = DeepReadonly<VoluteState>;
function number(n: number, min = -Infinity, max = Infinity, integer = false) {
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    throw new RangeError(`Invalid number: ${n}`);
  return n;
}
function member<T>(value: T, values: readonly T[]): T {
  if (!values.includes(value)) throw new RangeError(`Unknown value: ${value}`);
  return value;
}
function bool(value: boolean) {
  if (typeof value !== "boolean") throw new TypeError("Expected boolean");
  return value;
}
function level(n: number) {
  return number(n, 1, C.LEVEL_COUNT, true);
}
function snapshot(s: State): Snapshot {
  const segments = groups(s.cores, holdsFor(s.cores, s.segments));
  let segment = 0,
    remaining = segments[0]?.count ?? 0;
  const train = s.cores.map((c) => {
    if (remaining === 0) {
      segment++;
      remaining = segments[segment].count;
    }
    remaining--;
    const p = at(c.s);
    return { ...c, x: p.x, y: p.y, segment };
  });
  return {
    version: C.VOLUTE_DEBUG_VERSION,
    screen: s.screen,
    score: s.score,
    level: s.level,
    cells: s.cells,
    quotaRemaining: s.quotaRemaining,
    emitted: C.LEVELS[s.level - 1].quota - s.quotaRemaining,
    pressure: s.pressure,
    feedSpeed: feedSpeed(s),
    chainStep: s.chainStep,
    chainTimer: s.chainTimer,
    interlude: s.interlude,
    danger: danger(s),
    train,
    segments,
    injector: {
      aim: s.aim,
      cooldown: s.fireCooldown,
      loaded: s.loaded,
      queued: s.queued,
    },
    projectiles: s.projectiles.map((p) => ({ ...p })),
    machinery: s.machinery ? { ...s.machinery } : null,
    emission: s.emission,
    feed: s.feed,
    nextEmitted: s.nextEmitted,
    muted: s.muted,
    simTime: s.simTime,
  };
}
export function createDebug(): VoluteDebugApi {
  return {
    version: C.VOLUTE_DEBUG_VERSION,
    reset,
    reconcile: (s) => ({
      ...s,
      segments: groups(s.cores, holdsFor(s.cores, s.segments)),
    }),
    snapshot,
    setScreen: (s, screen) => ({ ...s, screen: member(screen, C.SCREENS) }),
    setLevel: (s, n) => ({ ...s, level: level(n) }),
    setScore: (s, n) => ({ ...s, score: number(n, 0, Infinity, true) }),
    setCells: (s, n) => ({ ...s, cells: number(n, 0, C.CELLS, true) }),
    setChainStep: (s, n) => ({
      ...s,
      chainStep: number(n, 1, Infinity, true),
      chainTimer: C.CHAIN_RESET,
    }),
    startLevel: (s, n) => openLevel(s, level(n)),
    poseTrain: (s, entries) => {
      const cores = entries
        .map(([arc, charge, mark]) => ({
          s: number(arc, -Infinity, C.PATH_LENGTH),
          charge: member(charge, C.CHARGE_IDS),
          mark: mark === null ? null : member(mark, C.MACHINERY_KINDS),
        }))
        .sort((a, b) => b.s - a.s);
      return { ...s, cores, segments: groups(cores) };
    },
    clearTrain: (s) => ({ ...s, cores: [], segments: [], projectiles: [] }),
    setLoaded: (s, charge) => ({ ...s, loaded: member(charge, C.CHARGE_IDS) }),
    setQueued: (s, charge) => ({ ...s, queued: member(charge, C.CHARGE_IDS) }),
    setAim: (s, a) => ({ ...s, aim: normalize(number(a)) }),
    fire: (s) => launch({ ...s, fireCooldown: 0 }),
    setPressure: (s, p) => ({
      ...s,
      pressure: number(p, C.PRESSURE_MIN, C.PRESSURE_MAX),
    }),
    setQuotaRemaining: (s, n) => ({
      ...s,
      quotaRemaining: number(n, 0, Infinity, true),
    }),
    setEmission: (s, enabled) => ({ ...s, emission: bool(enabled) }),
    setNextEmitted: (s, charge) => ({
      ...s,
      nextEmitted: charge === null ? null : member(charge, C.CHARGE_IDS),
    }),
    setFeed: (s, enabled) => ({ ...s, feed: bool(enabled) }),
    grantMachinery: (s, kind) => ({
      ...s,
      machinery: {
        kind: member(kind, ["choke", "backflow", "sightline"]),
        remaining: C.MACHINERY_DURATIONS[kind],
      },
    }),
    pause: (s) => ({ ...s, screen: "paused" }),
    resume: (s) => ({ ...s, screen: "playing" }),
  };
}
