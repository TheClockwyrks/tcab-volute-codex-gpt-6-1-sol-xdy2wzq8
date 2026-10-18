import * as C from "./constants";
import type { CoreState, SegmentState } from "./game";
const legs = C.CHANNEL.slice(0, -1).map((p, i) => {
  const q = C.CHANNEL[i + 1];
  const length = Math.hypot(q.x - p.x, q.y - p.y);
  return { p, length, dx: (q.x - p.x) / length, dy: (q.y - p.y) / length };
});
export function at(s: number) {
  let remain = Math.max(0, s);
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    if (remain < l.length || i === legs.length - 1)
      return {
        x: l.p.x + l.dx * remain,
        y: l.p.y + l.dy * remain,
        dx: l.dx,
        dy: l.dy,
      };
    remain -= l.length;
  }
  throw new Error("channel has no legs");
}
export const normalize = (a: number) => ((a % 360) + 360) % 360;
export const radians = (a: number) => (a * Math.PI) / 180;
export const touching = (a: number, b: number) =>
  Math.abs(a - b - C.SPACING) < 1e-7;
export function groups(
  cores: readonly CoreState[],
  holds: readonly number[] = [],
): SegmentState[] {
  const out: { count: number; hold: number }[] = [];
  cores.forEach((c, i) => {
    if (i && touching(cores[i - 1].s, c.s)) out[out.length - 1].count++;
    else out.push({ count: 1, hold: holds[i] ?? 0 });
  });
  return out;
}
export function holdsFor(
  cores: readonly CoreState[],
  segments: readonly SegmentState[],
): number[] {
  const holds = segments.flatMap((g) => Array<number>(g.count).fill(g.hold));
  return cores.map((_, i) => holds[i] ?? 0);
}
export const distance = (a: C.Point, b: C.Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
