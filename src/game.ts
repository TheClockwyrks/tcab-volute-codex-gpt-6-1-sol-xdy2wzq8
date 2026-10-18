import type { ChargeId, MachineryKind, ScreenName } from "./constants";

export type { ChargeId, MachineryKind, ScreenName };

export interface CoreState {
  readonly charge: ChargeId;
  readonly s: number;
  readonly mark: MachineryKind | null;
}

export interface SegmentState {
  readonly count: number;
  readonly hold: number;
}

export interface ProjectileState {
  readonly charge: ChargeId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

export interface MachineryState {
  readonly kind: MachineryKind;
  readonly remaining: number;
}

export interface VoluteState {
  readonly screen: ScreenName;

  readonly score: number;
  readonly level: number;
  readonly cells: number;
  readonly quotaRemaining: number;

  readonly pressure: number;
  readonly chainStep: number;
  readonly chainTimer: number;
  readonly machinery: MachineryState | null;

  readonly cores: readonly CoreState[];
  readonly segments: readonly SegmentState[];
  readonly projectiles: readonly ProjectileState[];

  readonly loaded: ChargeId | null;
  readonly queued: ChargeId | null;
  readonly aim: number;
  readonly fireCooldown: number;

  readonly interlude: number;
  readonly simTime: number;
  readonly accumulator: number;
  readonly emission: boolean;
  readonly feed: boolean;
  readonly nextEmitted: ChargeId | null;
  readonly muted: boolean;
}

import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import { createDebug } from "./debug";
import { reset, updateGame } from "./simulation";
import { loadAssets, renderGame } from "./presentation";
import * as C from "./constants";

export interface Snapshot {
  version: number;
  screen: ScreenName;
  score: number;
  level: number;
  cells: number;
  quotaRemaining: number;
  emitted: number;
  pressure: number;
  feedSpeed: number;
  chainStep: number;
  chainTimer: number;
  interlude: number;
  danger: boolean;
  train: (CoreState & { x: number; y: number; segment: number })[];
  segments: SegmentState[];
  injector: {
    aim: number;
    cooldown: number;
    loaded: ChargeId | null;
    queued: ChargeId | null;
  };
  projectiles: ProjectileState[];
  machinery: MachineryState | null;
  emission: boolean;
  feed: boolean;
  nextEmitted: ChargeId | null;
  muted: boolean;
  simTime: number;
}
export interface VoluteDebugApi {
  readonly version: number;
  reset(s: DeepReadonly<VoluteState>): VoluteState;
  reconcile(s: DeepReadonly<VoluteState>): VoluteState;
  snapshot(s: DeepReadonly<VoluteState>): Snapshot;
  setScreen(s: DeepReadonly<VoluteState>, name: ScreenName): VoluteState;
  setLevel(s: DeepReadonly<VoluteState>, level: number): VoluteState;
  setScore(s: DeepReadonly<VoluteState>, n: number): VoluteState;
  setCells(s: DeepReadonly<VoluteState>, n: number): VoluteState;
  setChainStep(s: DeepReadonly<VoluteState>, k: number): VoluteState;
  startLevel(s: DeepReadonly<VoluteState>, level: number): VoluteState;
  poseTrain(
    s: DeepReadonly<VoluteState>,
    cores: readonly (readonly [number, ChargeId, MachineryKind | null])[],
  ): VoluteState;
  clearTrain(s: DeepReadonly<VoluteState>): VoluteState;
  setLoaded(s: DeepReadonly<VoluteState>, charge: ChargeId): VoluteState;
  setQueued(s: DeepReadonly<VoluteState>, charge: ChargeId): VoluteState;
  setAim(s: DeepReadonly<VoluteState>, angleDegrees: number): VoluteState;
  fire(s: DeepReadonly<VoluteState>): VoluteState;
  setPressure(s: DeepReadonly<VoluteState>, value: number): VoluteState;
  setQuotaRemaining(s: DeepReadonly<VoluteState>, n: number): VoluteState;
  setEmission(s: DeepReadonly<VoluteState>, enabled: boolean): VoluteState;
  setNextEmitted(
    s: DeepReadonly<VoluteState>,
    charge: ChargeId | null,
  ): VoluteState;
  setFeed(s: DeepReadonly<VoluteState>, enabled: boolean): VoluteState;
  grantMachinery(
    s: DeepReadonly<VoluteState>,
    kind: Exclude<MachineryKind, "bore">,
  ): VoluteState;
  pause(s: DeepReadonly<VoluteState>): VoluteState;
  resume(s: DeepReadonly<VoluteState>): VoluteState;
}

// Presentation history is derived from simulation events, and never read by rules.
export interface VisualEvent {
  readonly kind: "burst" | "bore" | "pickup" | "swallow";
  readonly x: number;
  readonly y: number;
  readonly charge: ChargeId;
  readonly at: number;
}
export interface VoluteState {
  readonly visuals: readonly VisualEvent[];
}
export const BACKGROUND = "#101e24";
export const game: Game<VoluteState, VoluteDebugApi> = {
  async initialize(api) {
    C.ACTIONS.forEach((name) =>
      api.input.register(name, { keys: [...C.BINDINGS[name]] }),
    );
    await loadAssets(api);
    const debug = createDebug();
    const readings = {
      screen: (s: DeepReadonly<VoluteState>) => s.screen,
      run: (s: DeepReadonly<VoluteState>) => `L${s.level} · ${s.score} points`,
      cells: (s: DeepReadonly<VoluteState>) => s.cells,
      quota: (s: DeepReadonly<VoluteState>) => s.quotaRemaining,
      pressure: (s: DeepReadonly<VoluteState>) =>
        `${s.pressure.toFixed(1)} · ${debug.snapshot(s).feedSpeed.toFixed(1)}/s`,
      chain: (s: DeepReadonly<VoluteState>) => s.chainStep,
      train: (s: DeepReadonly<VoluteState>) =>
        `${s.cores.length} · head ${s.cores[0]?.s.toFixed(1) ?? "—"}`,
      segments: (s: DeepReadonly<VoluteState>) => s.segments.length,
      danger: (s: DeepReadonly<VoluteState>) => debug.snapshot(s).danger,
      injector: (s: DeepReadonly<VoluteState>) =>
        `${s.loaded}/${s.queued} · ${s.aim.toFixed(0)}° · ${s.fireCooldown.toFixed(2)}s`,
      projectiles: (s: DeepReadonly<VoluteState>) => s.projectiles.length,
      machinery: (s: DeepReadonly<VoluteState>) =>
        s.machinery
          ? `${s.machinery.kind} ${s.machinery.remaining.toFixed(1)}s`
          : "—",
    };
    Object.entries(readings).forEach(([name, source]) =>
      api.diagnostics.register(name, source),
    );
    return [reset(), debug];
  },
  update: updateGame,
  render: renderGame,
};
