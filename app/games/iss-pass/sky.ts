// ISS Pass, the pure part: where a satellite is, how well an antenna hears it, and the score.
// Angles are degrees from vertical, positive to the right; screen y grows downwards.

/** Beam half-angle: the signal fades to nothing this far off target. Also the drawn cone. */
export const BEAM_DEG = 9;
/** Antenna turn rate at full stick, degrees per second. */
export const ROT_DEG_S = 110;
/** A Yagi on a mast can't point into the ground. */
export const AIM_MAX = 85;
/** Signal needed to score points, and to count towards a QSO. */
export const SCORE_SIG = 0.3, LOCK_SIG = 0.6;
/** Signal falloff across the beam: above 1 the last few degrees count. */
const CURVE = 1.5;
/** How far off target the signal still reaches LOCK_SIG (signal() inverted): the beam's QSO core, drawn brighter. */
export const LOCK_DEG = BEAM_DEG * (1 - LOCK_SIG ** (1 / CURVE));
/** Points per second at full signal (times the satellite's weight). */
export const PTS_S = 10;
/** Seconds of good signal on one satellite (cumulative, per pass) for a contact, and its bonus. */
export const LOCK_S = 4, QSO_PTS = 25;
/** Signal left while the satellite is behind a cloud. */
export const CLOUD_DIM = 0.3;

/** A pass across the sky: from one edge to the other, `peak` px above `base` halfway. Times in seconds. */
export interface Arc { from: number; to: number; base: number; peak: number; start: number; dur: number }

/** A satellite right now. Updated in place every frame, so the game loop allocates nothing. */
export interface Target { x: number; y: number; up: boolean; weight: number; dim: number }

/** One station's contact with one satellite during the current pass. */
export interface Link { lock: number; qso: boolean }

/** A ground station: the antenna's pivot, aim, stick and score. `links` pairs with the targets by index. */
export interface Station { x: number; y: number; aim: number; turn: number; sig: number; points: number; links: Link[] }

/** Moves `out` to where the satellite on `arc` is at `time` (sine arc: rises off the edge, sets off the other). */
export function fly(arc: Arc, time: number, out: Target) {
  const u = (time - arc.start) / arc.dur;
  out.up = u >= 0 && u <= 1;
  out.x = arc.from + (arc.to - arc.from) * u;
  out.y = arc.base - arc.peak * Math.sin(Math.PI * u);
}

/** Direction from the antenna at (ax, ay) to (x, y). */
export const bearing = (ax: number, ay: number, x: number, y: number) => (Math.atan2(x - ax, ay - y) * 180) / Math.PI;

/** 1 dead on target, 0 at the beam edge; the power curve makes the last few degrees count. */
export const signal = (aim: number, dir: number) => Math.max(0, 1 - Math.abs(aim - dir) / BEAM_DEG) ** CURVE;

/**
 * One frame for one station: turn the antenna, listen to every satellite, score.
 * Points come from the best (weighted) satellite; every satellite above LOCK_SIG builds its own QSO.
 * Returns the index of the target whose QSO just completed, or -1.
 */
export function track(st: Station, targets: readonly Target[], dt: number): number {
  st.aim = Math.max(-AIM_MAX, Math.min(AIM_MAX, st.aim + st.turn * ROT_DEG_S * dt));
  st.sig = 0;
  let best = 0, done = -1;
  for (let i = 0; i < targets.length; i++) {
    const tg = targets[i]!, link = st.links[i]!; // links are made per target
    if (!tg.up) continue;
    const s = signal(st.aim, bearing(st.x, st.y, tg.x, tg.y)) * tg.dim;
    st.sig = Math.max(st.sig, s);
    if (s > SCORE_SIG) best = Math.max(best, s * tg.weight);
    if (s > LOCK_SIG) link.lock += dt;
    if (done < 0 && !link.qso && link.lock >= LOCK_S) { // a second one in the same frame completes next frame
      link.qso = true;
      st.points += QSO_PTS;
      done = i;
    }
  }
  st.points += best * PTS_S * dt;
  return done;
}
