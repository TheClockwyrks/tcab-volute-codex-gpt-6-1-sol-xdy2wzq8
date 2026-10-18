import type { DeepReadonly } from "ts-essentials";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CoreState, VoluteState, VisualEvent } from "./game";
import {
  at,
  distance,
  groups,
  holdsFor,
  normalize,
  radians,
  touching,
} from "./geometry";
type State = DeepReadonly<VoluteState>;
export function reset(s?: State): VoluteState {
  return {
    screen: "title",
    score: 0,
    level: 1,
    cells: C.CELLS,
    quotaRemaining: C.LEVELS[0].quota,
    pressure: 0,
    chainStep: 1,
    chainTimer: 0,
    machinery: null,
    cores: [],
    segments: [],
    projectiles: [],
    loaded: null,
    queued: null,
    aim: C.AIM_START,
    fireCooldown: 0,
    interlude: 0,
    simTime: 0,
    accumulator: 0,
    emission: s?.emission ?? true,
    feed: s?.feed ?? true,
    nextEmitted: null,
    muted: s?.muted ?? false,
    visuals: [],
  };
}
export function drawCharge(s: State): C.ChargeId {
  const choices = s.cores.length
    ? [...new Set(s.cores.map((c) => c.charge))]
    : C.LEVELS[s.level - 1].charges;
  return choices[Math.floor(Math.random() * choices.length)];
}
function markFor(n: number): C.MachineryKind | null {
  return n % C.MARK_INTERVAL === 0
    ? C.MACHINERY_KINDS[
        (((n / C.MARK_INTERVAL - 1) % C.MACHINERY_KINDS.length) +
          C.MACHINERY_KINDS.length) %
          C.MACHINERY_KINDS.length
      ]
    : null;
}
export function openLevel(s: State, level: number): VoluteState {
  const row = C.LEVELS[level - 1];
  const cores = Array.from({ length: C.SEEDED_CORES }, (_, i) => ({
    s: C.SEEDED_HEAD_S - i * C.SPACING,
    charge: row.charges[Math.floor(Math.random() * row.charges.length)],
    mark: markFor(i + 1),
  }));
  const next: VoluteState = {
    ...s,
    screen: "playing",
    level,
    cores,
    segments: groups(cores),
    quotaRemaining: row.quota - C.SEEDED_CORES,
    pressure: 0,
    chainStep: 1,
    chainTimer: 0,
    machinery: null,
    projectiles: [],
    fireCooldown: 0,
    interlude: 0,
    accumulator: 0,
    visuals: [],
  };
  return { ...next, loaded: drawCharge(next), queued: drawCharge(next) };
}
export const feedSpeed = (s: State) =>
  C.LEVELS[s.level - 1].feedSpeed *
  (1 + s.pressure / C.PRESSURE_MAX) *
  (s.machinery?.kind === "choke" ? C.CHOKE_FEED_MULTIPLIER : 1);
export const danger = (s: State) => (s.cores[0]?.s ?? -Infinity) >= C.DANGER_S;
export function launch(s: State): VoluteState {
  return {
    ...s,
    projectiles: [
      ...s.projectiles,
      {
        charge: s.loaded ?? drawCharge(s),
        x: C.INJECTOR_X,
        y: C.INJECTOR_Y,
        angle: s.aim,
      },
    ],
    loaded: s.queued ?? drawCharge(s),
    queued: drawCharge(s),
    fireCooldown: C.FIRE_COOLDOWN,
  };
}
const fall = (n: number, dt: number) => (n - dt < 1e-9 ? 0 : n - dt);
const clampPressure = (p: number) =>
  Math.max(C.PRESSURE_MIN, Math.min(C.PRESSURE_MAX, p));
// A tick works on fresh arrays; the engine's previous value is never mutated.
export function tick(
  input: State,
  dt: number,
  emit: (cue: C.CueName) => void = () => {},
): VoluteState {
  let s: VoluteState = {
    ...input,
    cores: input.cores.map((c) => ({ ...c })),
    segments: input.segments.map((g) => ({ ...g, hold: fall(g.hold, dt) })),
    fireCooldown: fall(input.fireCooldown, dt),
    chainTimer: fall(input.chainTimer, dt),
  };
  if (s.chainTimer === 0) s = { ...s, chainStep: 1 };
  if (s.machinery)
    s = {
      ...s,
      machinery:
        s.machinery.remaining - dt < 1e-9
          ? null
          : { ...s.machinery, remaining: s.machinery.remaining - dt },
    };
  let cores = s.cores.map((c) => ({ ...c }));
  let holds = holdsFor(cores, s.segments);
  let tokens = cores.map((_, i) => i);
  const effect = (kind: VisualEvent["kind"], core: CoreState) => {
    const p = at(core.s);
    s = {
      ...s,
      visuals: [
        ...s.visuals,
        { kind, x: p.x, y: p.y, charge: core.charge, at: s.simTime },
      ],
    };
  };
  function remove(indices: Set<number>) {
    if (!indices.size) return;
    const front = Math.max(...[...indices].map((i) => cores[i].s));
    const kept = cores.filter((_, i) => !indices.has(i));
    const keptHolds = holds.filter((_, i) => !indices.has(i));
    const original = kept.map((c) => c.s);
    let i = 0;
    while (i < kept.length) {
      const start = i;
      while (i + 1 < kept.length && touching(original[i], original[i + 1])) i++;
      const end = i;
      if (original[start] < front) {
        const room = Math.min(
          original[end],
          end + 1 < kept.length
            ? original[end] - original[end + 1] - C.SPACING
            : C.RECOIL,
        );
        const moved = Math.max(0, Math.min(C.RECOIL, room));
        for (let j = start; j <= end; j++) {
          kept[j] = { ...kept[j], s: original[j] - moved };
          keptHolds[j] = C.RECOIL_HOLD;
        }
      }
      i++;
    }
    tokens = tokens.filter((_, i) => !indices.has(i));
    cores = kept;
    holds = keptHolds;
    s = {
      ...s,
      pressure: clampPressure(
        s.pressure - indices.size * C.PRESSURE_DROP_PER_CORE,
      ),
      score: s.score + indices.size * C.SCORE_PER_CORE * s.chainStep,
    };
  }
  function extract(index: number, merge: boolean) {
    if (!cores[index]) return;
    let first = index,
      last = index;
    while (
      first > 0 &&
      touching(cores[first - 1].s, cores[first].s) &&
      cores[first - 1].charge === cores[index].charge
    )
      first--;
    while (
      last + 1 < cores.length &&
      touching(cores[last].s, cores[last + 1].s) &&
      cores[last + 1].charge === cores[index].charge
    )
      last++;
    if (last - first + 1 < C.MIN_RUN) return;
    const taken = cores.slice(first, last + 1);
    s = {
      ...s,
      chainStep: merge ? s.chainStep + 1 : 1,
      chainTimer: C.CHAIN_RESET,
    };
    emit(C.EXTRACT_CUES[Math.min(s.chainStep, C.EXTRACT_CUES.length) - 1]);
    taken.forEach((c) => effect("burst", c));
    remove(new Set(Array.from({ length: taken.length }, (_, i) => first + i)));
    for (const c of taken)
      if (c.mark) {
        emit(C.CUES.machinery);
        effect("pickup", c);
        if (c.mark === "bore") {
          effect("bore", c);
          const p = at(c.s);
          remove(
            new Set(
              cores
                .map((core, i) =>
                  distance(at(core.s), p) <= C.BORE_RADIUS ? i : -1,
                )
                .filter((i) => i >= 0),
            ),
          );
        } else
          s = {
            ...s,
            machinery: {
              kind: c.mark,
              remaining: C.MACHINERY_DURATIONS[c.mark],
            },
          };
      }
  }
  if (s.feed) {
    if (s.machinery?.kind === "backflow") {
      for (let i = cores.length - 1; i >= 0; i--) {
        if (cores[i].s < 0) continue;
        const limit = i === cores.length - 1 ? 0 : cores[i + 1].s + C.SPACING;
        cores[i] = {
          ...cores[i],
          s: Math.max(limit, cores[i].s - C.BACKFLOW_SPEED * dt),
        };
      }
    } else {
      // Remember segment members by object identity; a removal can change indices.
      const originalGroups: number[][] = [];
      let start = 0;
      for (const g of groups(cores, holds)) {
        originalGroups.push(tokens.slice(start, start + g.count));
        start += g.count;
      }
      for (const members of originalGroups) {
        const live = members.filter((token) => tokens.includes(token));
        const index = tokens.indexOf(live[0]);
        if (index < 0) continue;
        const count = live.length;
        const advance =
          holds[index] > 0
            ? 0
            : (index === 0 ? feedSpeed(s) : C.CATCHUP_SPEED) * dt;
        const max =
          index === 0
            ? Infinity
            : cores[index - 1].s - C.SPACING - cores[index].s;
        const shift = Math.min(advance, Math.max(0, max));
        for (let j = index; j < index + count; j++)
          cores[j] = { ...cores[j], s: cores[j].s + shift };
        if (index > 0 && touching(cores[index - 1].s, cores[index].s)) {
          const hold = holds[index - 1];
          for (let j = index; j < index + count; j++) holds[j] = hold;
          if (cores[index - 1].charge === cores[index].charge)
            extract(index, true);
        }
      }
    }
  }
  const projectiles = [];
  for (const projectile of s.projectiles) {
    const a = radians(projectile.angle);
    const p = {
      ...projectile,
      x: projectile.x + Math.cos(a) * C.PROJECTILE_SPEED * dt,
      y: projectile.y + Math.sin(a) * C.PROJECTILE_SPEED * dt,
    };
    if (p.x < 0 || p.x > C.FIELD_W || p.y < 0 || p.y > C.FIELD_H) continue;
    let hit = -1,
      nearest = Infinity;
    cores.forEach((core, i) => {
      const d = distance(p, at(core.s));
      if (d <= C.STRIKE_DISTANCE && d < nearest) {
        nearest = d;
        hit = i;
      }
    });
    if (hit < 0) {
      projectiles.push(p);
      continue;
    }
    const c = cores[hit],
      pos = at(c.s);
    const ahead = (p.x - pos.x) * pos.dx + (p.y - pos.y) * pos.dy > 0;
    const insertion = c.s - (ahead ? 0 : C.SPACING);
    const inheritedHold = holds[hit];
    cores = cores.map((core) =>
      core.s <= insertion ? { ...core, s: core.s - C.SPACING } : core,
    );
    const idx = cores.findIndex((core) => core.s < insertion);
    const where = idx < 0 ? cores.length : idx;
    cores.splice(where, 0, { s: insertion, charge: p.charge, mark: null });
    holds.splice(where, 0, inheritedHold);
    emit(C.CUES.seat);
    extract(where, false);
  }
  s = { ...s, cores, segments: groups(cores, holds), projectiles };
  const rise =
    Math.max(0, cores.length - C.PRESSURE_FREE) * C.PRESSURE_RISE_PER_CORE;
  const bleed = cores.length <= C.PRESSURE_FREE ? C.PRESSURE_BLEED : 0;
  s = { ...s, pressure: clampPressure(s.pressure + (rise - bleed) * dt) };
  if (cores[0]?.s >= C.INTAKE_S) {
    emit(C.CUES.intake);
    emit(C.CUES.cellLost);
    effect("swallow", cores[0]);
    s = {
      ...s,
      cells: Math.max(0, s.cells - 1),
      cores: [],
      segments: [],
      projectiles: [],
      pressure: 0,
      machinery: null,
      chainStep: 1,
      chainTimer: 0,
      quotaRemaining: C.LEVELS[s.level - 1].quota - C.SEEDED_CORES,
      screen: s.cells <= 1 ? "gameover" : "setback",
      interlude: s.cells <= 1 ? 0 : C.INTERLUDE,
    };
    return s;
  }
  if (s.quotaRemaining === 0 && cores.length === 0) {
    emit(C.CUES.levelClear);
    return {
      ...s,
      score: s.score + C.CLEAR_SCORE,
      screen: s.level === C.LEVEL_COUNT ? "victory" : "cleared",
      interlude: s.level === C.LEVEL_COUNT ? 0 : C.INTERLUDE,
    };
  }
  if (
    s.emission &&
    s.machinery?.kind !== "backflow" &&
    s.quotaRemaining > 0 &&
    (!cores.length || cores[cores.length - 1].s >= C.SPACING)
  ) {
    const charge = s.nextEmitted ?? drawCharge(s);
    const emitted = C.LEVELS[s.level - 1].quota - s.quotaRemaining + 1;
    cores = [...cores, { s: 0, charge, mark: markFor(emitted) }];
    holds.push(0);
    s = {
      ...s,
      cores,
      segments: groups(cores, holds),
      quotaRemaining: s.quotaRemaining - 1,
      nextEmitted: null,
    };
  }
  return s;
}
export function updateGame(
  input: State,
  api: UpdateApi,
  dt: number,
): VoluteState {
  let s: VoluteState = {
    ...input,
    simTime: input.simTime + dt,
    visuals: input.visuals.filter((v) => input.simTime - v.at < 0.8),
  };
  const pressed = (name: string) => api.input.pressed(name);
  if (pressed("mute")) api.audio.setMuted(!api.audio.muted());
  s = { ...s, muted: api.audio.muted() };
  const pointer = api.input.pointer();
  const inside =
    pointer.x >= 0 &&
    pointer.x <= C.FIELD_W &&
    pointer.y >= 0 &&
    pointer.y <= C.FIELD_H;
  const click = inside && api.input.pointerPressed();
  if (s.screen === "title" && (pressed("confirm") || click))
    s = openLevel(s, 1);
  else if (
    (s.screen === "victory" || s.screen === "gameover") &&
    (pressed("confirm") || click)
  )
    s = reset(s);
  else if (s.screen === "playing" || s.screen === "paused") {
    if (pressed("pause"))
      s = { ...s, screen: s.screen === "playing" ? "paused" : "playing" };
    else if (s.screen === "playing") {
      if (
        api.input.pointerSamples().length &&
        inside &&
        (pointer.x !== C.INJECTOR_X || pointer.y !== C.INJECTOR_Y)
      )
        s = {
          ...s,
          aim: normalize(
            (Math.atan2(pointer.y - C.INJECTOR_Y, pointer.x - C.INJECTOR_X) *
              180) /
              Math.PI,
          ),
        };
      s = {
        ...s,
        aim: normalize(
          s.aim +
            (api.input.value("right") - api.input.value("left")) *
              C.AIM_TURN_RATE *
              dt,
        ),
      };
      if (pressed("b")) {
        s = { ...s, loaded: s.queued, queued: s.loaded };
        api.audio.play(C.CUES.swap);
      }
      if (pressed("a") || click) {
        if (s.fireCooldown > 0) api.audio.play(C.CUES.denied);
        else {
          s = launch(s);
          api.audio.play(C.CUES.fire);
        }
      }
    }
  }
  if (
    s.screen === "playing" ||
    s.screen === "cleared" ||
    s.screen === "setback"
  ) {
    let accumulator = s.accumulator + dt;
    while (accumulator + 1e-10 >= C.TICK_DT) {
      accumulator = Math.max(0, accumulator - C.TICK_DT);
      if (s.screen === "playing") {
        const cues = new Set<C.CueName>();
        s = tick(s, C.TICK_DT, (cue) => cues.add(cue));
        cues.forEach((cue) => api.audio.play(cue));
      } else if (s.screen === "cleared" || s.screen === "setback") {
        s = { ...s, interlude: fall(s.interlude, C.TICK_DT) };
        if (s.interlude < 1e-9)
          s = openLevel(s, s.level + (s.screen === "cleared" ? 1 : 0));
      } else {
        accumulator = 0;
        break;
      }
    }
    s = {
      ...s,
      accumulator:
        s.screen === "playing" ||
        s.screen === "cleared" ||
        s.screen === "setback"
          ? accumulator
          : 0,
    };
  } else s = { ...s, accumulator: 0 };
  const bed =
    s.screen === "playing"
      ? danger(s)
        ? C.CUES.dangerLoop
        : C.CUES.hallLoop
      : null;
  for (const cue of C.LOOPING_CUES)
    if (cue === bed) {
      if (!api.audio.looping(cue)) api.audio.loop(cue);
    } else if (api.audio.looping(cue)) api.audio.stop(cue);
  return s;
}
