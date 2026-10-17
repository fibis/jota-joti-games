// Pioneering Tower: the wooden pieces, the turn order and the tower maths. No Phaser here, so it is easy to test.
import type { Lang } from '#shared/protocol';
import { shuffle } from '~/games/kit/random';
import type { Player } from '~/games/types';

export const PX_PER_M = 40;
/** A piece counts for the height once it lay this still for REST_S (Matter speeds: px and rad per 60 Hz step)… */
export const REST_S = 0.8, STILL_SPEED = 0.3, STILL_SPIN = 0.02;
/** …and stops counting only above these: a wobble from a piece landing on top must not shrink the tower. */
export const MOVING_SPEED = 4, MOVING_SPIN = 0.12;
/**
 * Height lost within CRASH_S that makes a crash. A real collapse avalanches for 1–3 s, so a 1 s window missed most of them.
 * Headless Matter sim, 24 games: 2.5 s bangs for 56 of 69 lasting >3 m collapses (1 s: 26), ~3 per game, no false alarm.
 */
export const CRASH_M = 3, CRASH_S = 2.5;
export const WIN_BONUS = 15, PIECE_BONUS = 2;

/** One wooden bar of a piece: centre and size in px, angle in radians, all relative to the piece. */
export interface Bar { x: number; y: number; w: number; h: number; angle: number }

export interface PieceDef {
  name: Record<Lang, string>;
  bars: Bar[];
  /** Where bars are lashed together: rope knots are drawn there. */
  knots: [x: number, y: number][];
}

const bar = (x: number, y: number, w: number, h: number, angle = 0): Bar => ({ x, y, w, h, angle });

// Square frame: four bars, overlapping at the lashed corners.
const S = 110, T = 14, E = (S - T) / 2;
// A-frame: two legs from the apex down to the feet, braced by a crossbar near the bottom.
const APEX = -62, FOOT = 62, SPREAD = 52, BRACE = 34;
const LEG = Math.hypot(SPREAD, FOOT - APEX) + 12; // ends stick out past the apex lashing, like real spars
const braceX = SPREAD * (BRACE - APEX) / (FOOT - APEX);
const leg = (side: 1 | -1) => bar(side * SPREAD / 2, (APEX + FOOT) / 2, LEG, T, Math.atan2(FOOT - APEX, side * SPREAD));

export const PIECES = {
  pole: { name: { en: 'Long pole', de: 'Lange Stange' }, bars: [bar(0, 0, 240, 18)], knots: [] },
  beam: { name: { en: 'Beam', de: 'Balken' }, bars: [bar(0, 0, 130, 22)], knots: [] },
  plank: { name: { en: 'Plank', de: 'Brett' }, bars: [bar(0, 0, 170, 14)], knots: [] },
  frame: {
    name: { en: 'Square frame', de: 'Rahmen' },
    bars: [bar(0, -E, S, T), bar(0, E, S, T), bar(-E, 0, T, S), bar(E, 0, T, S)],
    knots: [[-E, -E], [E, -E], [-E, E], [E, E]],
  },
  aframe: {
    name: { en: 'A-frame', de: 'A-Bock' },
    bars: [leg(-1), leg(1), bar(0, BRACE, 2 * braceX + 22, T)],
    knots: [[0, APEX + 6], [-braceX, BRACE], [braceX, BRACE]],
  },
} satisfies Record<string, PieceDef>;

export type PieceKind = keyof typeof PIECES;
const KINDS = Object.keys(PIECES) as PieceKind[];

/** Bag shuffle: every kind once per bag. Both teams build from the same list, so nobody gets luckier pieces. */
export const pieceSequence = (bags: number): PieceKind[] => Array.from({ length: bags }, () => shuffle(KINDS)).flat();

/** Who builds after `last`: the next online member in team order (`last` again if alone), nobody if all are offline. */
export function nextBuilder(members: readonly Player[], last?: Player): Player | undefined {
  const from = last ? members.indexOf(last) + 1 : 0;
  for (let i = 0; i < members.length; i++) {
    const p = members[(from + i) % members.length]!;
    if (p.online) return p;
  }
}

export interface Rest {
  /** Seconds the piece has been lying still. */
  still: number;
  counted: boolean;
}

/** Advances a piece's resting clock by dt seconds; `counted` says whether it is part of the tower. */
export function settle(r: Rest, speed: number, spin: number, dt: number) {
  r.still = speed < STILL_SPEED && spin < STILL_SPIN ? r.still + dt : 0;
  if (r.still >= REST_S) r.counted = true;
  else if (speed > MOVING_SPEED || spin > MOVING_SPIN) r.counted = false;
}

/** Tower height in metres: the top of the highest counted piece whose centre is within [x0, x1). Screen y points down. */
export function towerHeight(pieces: Iterable<{ x: number; top: number; counted: boolean }>, x0: number, x1: number, baseY: number) {
  let top = baseY;
  for (const p of pieces) if (p.counted && p.x >= x0 && p.x < x1) top = Math.min(top, p.top);
  return (baseY - top) / PX_PER_M;
}

/** Feeds one height sample (seconds, metres); true when the tower lost more than CRASH_M within CRASH_S. */
export function crashed(history: [t: number, m: number][], now: number, m: number): boolean {
  while (history[0] && history[0][0] < now - CRASH_S) history.shift();
  const crash = history.some(([, old]) => old - m > CRASH_M);
  if (crash) history.length = 0; // one crash, one bang
  history.push([now, m]);
  return crash;
}

/** Heights compared as shown (0.1 m), so a tie on screen is a tie. */
const shown = (m: number) => Math.round(m * 10);

/** Indexes of the tallest towers among teams with members: several on a tie, none when nothing stands. */
export function winners(teams: readonly { players: readonly unknown[] }[], heights: readonly number[]): number[] {
  const best = Math.max(0, ...teams.map((t, i) => (t.players.length ? shown(heights[i] ?? 0) : 0)));
  return best ? teams.flatMap((t, i) => (t.players.length && shown(heights[i] ?? 0) === best ? [i] : [])) : [];
}

/** A member's points: the team's height ×10, the win bonus, and a bonus per own piece still on the tower. */
export const points = (height: number, won: boolean, standing: number) =>
  Math.round(height * 10) + (won ? WIN_BONUS : 0) + standing * PIECE_BONUS;
