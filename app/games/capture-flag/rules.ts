// Capture the Flag rules: the field and one simulation step, free of Phaser so they can be tested.
// Side 0 owns the left half, side 1 the right half; everything on the field is mirror-symmetric.

export const W = 1600, H = 900, MID = W / 2;
/** Height of the score band at the top; the field is below it. */
export const TOP = 76;
export const FIELD_Y = (TOP + H) / 2;

// Calibration knobs (px, seconds).
export const R = 22; // token radius; touching = centres closer than 2R
export const SPEED = 300;
export const DASH_SPEED = 2.3, DASH_S = 0.35, DASH_COOLDOWN_S = 2.2;
export const CARRY_SPEED = 0.8;
/** Freed prisoners (and their rescuer, unless carrying a flag) can't be tagged this long: time to run home. */
export const INVULN_S = 3;
/** Centre distance at which a runner touches a flag. */
export const FLAG_REACH = 40;
/** No guarding: while their flag is home, owners stay this far from it, so a camper can't tag every grabber. */
export const GUARD_R = FLAG_REACH + 2 * R + 16;
/** How far a token's name label hangs below the token: the field and jails end where it still fits. */
export const NAME_H = 26;
export const POINTS = { tag: 2, rescue: 1, capture: 5, win: 10 };

export type Side = 0 | 1;
export interface Spot { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface Obstacle extends Spot { r: number; emoji: string }

export interface Runner<P> extends Spot {
  readonly p: P;
  readonly side: Side;
  /** Stick, length <= 1. */
  vx: number;
  vy: number;
  /** Seconds left: dashing, dash cooldown, can't be tagged. */
  dash: number;
  cool: number;
  safe: number;
  jailed: boolean;
  /** Offline: stands still, can't tag or be tagged. */
  ghost: boolean;
  points: number;
}

export interface Flag<P> extends Spot {
  readonly side: Side;
  carrier: Runner<P> | null;
}

export interface World<P> {
  readonly runners: Runner<P>[];
  readonly flags: readonly [Flag<P>, Flag<P>];
  readonly captures: [number, number];
}

export type Event<P> =
  | { t: 'tag'; by: Runner<P>; who: Runner<P> }
  | { t: 'grab'; who: Runner<P> }
  | { t: 'return'; by: Runner<P> }
  | { t: 'jailbreak'; by: Runner<P>; freed: Runner<P>[] }
  | { t: 'capture'; who: Runner<P> };

export type Situation = 'jail' | 'carry' | 'defend' | 'attack';

export const other = (s: Side): Side => (s ? 0 : 1);
export const sideOf = (x: number): Side => (x < MID ? 0 : 1);
/** x measured from the side's back wall. */
const onSide = (s: Side, x: number) => (s ? W - x : x);

export const FLAG_BASES: readonly [Spot, Spot] = [{ x: 100, y: FIELD_Y }, { x: W - 100, y: FIELD_Y }];
/** JAILS[s] is in side s's back corner and holds the other side's prisoners. */
export const JAILS: readonly [Box, Box] = [{ x: 0, y: H - 180, w: 180, h: 180 }, { x: W - 180, y: H - 180, w: 180, h: 180 }];

const LEFT: Obstacle[] = [
  { x: 330, y: 210, r: 30, emoji: '🌲' },
  { x: 480, y: 360, r: 32, emoji: '🌳' },
  { x: 360, y: 600, r: 28, emoji: '🪨' },
  { x: 640, y: 190, r: 26, emoji: '🪨' },
  { x: 650, y: 600, r: 32, emoji: '🌳' },
  { x: 520, y: 790, r: 30, emoji: '🌲' },
];
export const OBSTACLES: readonly Obstacle[] = [
  ...LEFT.flatMap(o => [o, { ...o, x: W - o.x }]),
  { x: MID, y: 400, r: 30, emoji: '🪨' }, // on the centre line: its own mirror image
];

// Back line: rows around the flag's height, fewer below it because the jail is there; a second column past 10.
// 64 px apart so a name label isn't hidden under the next token; x clear of the no-guarding circle.
const SPAWN_X = 210, SPAWN_COL = 60, SPAWN_GAP = 64;
const SPAWN_ROWS = [0, -1, 1, -2, 2, -3, 3, -4, -5, -6];
export function spawn(s: Side, i: number): Spot {
  const col = Math.floor(i / SPAWN_ROWS.length), row = SPAWN_ROWS[i % SPAWN_ROWS.length]!;
  return { x: onSide(s, SPAWN_X + col * SPAWN_COL), y: FIELD_Y + row * SPAWN_GAP };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist2 = (a: Spot, b: Spot) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
/** Distance from a point to a box (0 inside). */
const boxDist = (p: Spot, b: Box) => Math.hypot(p.x - clamp(p.x, b.x, b.x + b.w), p.y - clamp(p.y, b.y, b.y + b.h));
const active = (r: Runner<unknown>) => !r.jailed && !r.ghost;
const carrying = <P>(w: World<P>, r: Runner<P>) => w.flags[other(r.side)].carrier === r;
const prisoners = <P>(w: World<P>, s: Side) => w.runners.filter(r => r.side === s && r.jailed);
/** The flag sits untouched on its base. */
const atHome = (f: Flag<unknown>) => !f.carrier && f.x === FLAG_BASES[f.side].x && f.y === FLAG_BASES[f.side].y;

export function createWorld<P>(sides: readonly [readonly P[], readonly P[]]): World<P> {
  const w: World<P> = {
    runners: [],
    flags: [{ side: 0, ...FLAG_BASES[0], carrier: null }, { side: 1, ...FLAG_BASES[1], carrier: null }],
    captures: [0, 0],
  };
  sides.forEach((ps, s) => ps.forEach(p => addRunner(w, p, s as Side)));
  return w;
}

/** A newcomer starts on their side's back line. */
export function addRunner<P>(w: World<P>, p: P, side: Side): Runner<P> {
  const at = spawn(side, w.runners.filter(r => r.side === side).length);
  const r: Runner<P> = { p, side, ...at, vx: 0, vy: 0, dash: 0, cool: 0, safe: 0, jailed: false, ghost: false, points: 0 };
  w.runners.push(r);
  return r;
}

/** After a capture: flags home, jails open, everyone back on their back line. */
export function kickOff<P>(w: World<P>) {
  for (const f of w.flags) home(w, f.side);
  const count: [number, number] = [0, 0];
  for (const r of w.runners) {
    Object.assign(r, spawn(r.side, count[r.side]++), { dash: 0, cool: 0, safe: 0, jailed: false });
  }
}

export function steer(r: Runner<unknown>, x: number, y: number) {
  const len = Math.hypot(x, y);
  const k = len > 1 ? 1 / len : 1; // phones send each axis clamped to -1..1, so the corners reach 1.41
  r.vx = x * k;
  r.vy = y * k;
}

/** Starts a dash; false when not allowed (cooling down, jailed, offline, carrying, standing still). */
export function dash<P>(w: World<P>, r: Runner<P>) {
  if (r.cool > 0 || !active(r) || carrying(w, r) || !(r.vx || r.vy)) return false;
  r.dash = DASH_S;
  r.cool = DASH_COOLDOWN_S;
  return true;
}

/** Offline runners stop; a carrier going offline drops the flag where they stand. */
export function setGhost<P>(w: World<P>, r: Runner<P>, ghost: boolean) {
  r.ghost = ghost;
  r.vx = r.vy = r.dash = 0;
  if (!ghost) r.safe = INVULN_S; // back from a dropout: a moment to look around before anyone can tag them
  const f = w.flags[other(r.side)];
  if (ghost && f.carrier === r) f.carrier = null;
}

export function situation<P>(w: World<P>, r: Runner<P>): Situation {
  if (r.jailed) return 'jail';
  if (carrying(w, r)) return 'carry';
  return sideOf(r.x) === r.side ? 'defend' : 'attack';
}

/** Side with more captures, null on a draw. */
export const leader = (w: World<unknown>): Side | null =>
  w.captures[0] === w.captures[1] ? null : w.captures[0] > w.captures[1] ? 0 : 1;

/** Personal points plus the win bonus for every member of the leading side. */
export function finalScores<P>(w: World<P>): [P, number][] {
  const win = leader(w);
  return w.runners.map(r => [r.p, r.points + (r.side === win ? POINTS.win : 0)]);
}

/**
 * Advances the game by dt seconds and appends what happened to `events`.
 * A capture ends the step and kicks off the next round.
 */
export function step<P>(w: World<P>, dt: number, events: Event<P>[]) {
  for (const r of w.runners) move(w, r, dt);
  for (const f of w.flags) {
    if (f.carrier) { f.x = f.carrier.x; f.y = f.carrier.y; }
  }
  for (const r of w.runners) {
    if (!active(r)) continue;
    if (touchFlags(w, r, events)) return kickOff(w);
    breakOut(w, r, events);
  }
  // ponytail: O(n²) pair scan, fine for <= 30 players; a spatial grid if crowds ever get bigger.
  for (const a of w.runners) for (const b of w.runners) if (canTag(a, b)) jail(w, a, b, events);
}

function move<P>(w: World<P>, r: Runner<P>, dt: number) {
  r.dash = Math.max(0, r.dash - dt);
  r.cool = Math.max(0, r.cool - dt);
  r.safe = Math.max(0, r.safe - dt);
  if (r.ghost) return;
  const v = SPEED * dt * (carrying(w, r) ? CARRY_SPEED : r.dash > 0 ? DASH_SPEED : 1);
  r.x += r.vx * v;
  r.y += r.vy * v;
  if (r.jailed) { // free to pace inside the fence, never out
    const j = JAILS[other(r.side)];
    r.x = clamp(r.x, j.x + R, j.x + j.w - R);
    r.y = clamp(r.y, j.y + R, j.y + j.h - R - NAME_H);
    return;
  }
  if (atHome(w.flags[r.side])) keepOff(r, FLAG_BASES[r.side], GUARD_R); // before the clamp: the circle touches the back wall
  r.x = clamp(r.x, R, W - R);
  r.y = clamp(r.y, TOP + R, H - R - NAME_H);
  for (const o of OBSTACLES) keepOff(r, o, R + o.r); // trunks and rocks
  for (const j of JAILS) pushOut(r, j);
}

/** Pushes r out of the circle of radius min round c. */
function keepOff(r: Runner<unknown>, c: Spot, min: number) {
  const dx = r.x - c.x, dy = r.y - c.y, d = Math.hypot(dx, dy);
  if (d >= min) return;
  if (d > 0) { r.x = c.x + dx / d * min; r.y = c.y + dy / d * min; }
  else r.x = c.x + (r.side ? -min : min); // dead centre (parked on the flag): out towards the field
}

// Jails are fenced: free runners slide along the fence.
function pushOut(r: Spot, b: Box) {
  const cx = clamp(r.x, b.x, b.x + b.w), cy = clamp(r.y, b.y, b.y + b.h);
  const dx = r.x - cx, dy = r.y - cy, d = Math.hypot(dx, dy);
  if (d >= R) return;
  if (d > 0) { r.x = cx + dx / d * R; r.y = cy + dy / d * R; return; }
  // A fast dash got the centre inside: out through the nearest field-facing wall (jails sit in corners).
  const left = r.x - b.x, right = b.x + b.w - r.x, up = r.y - b.y, down = b.y + b.h - r.y;
  const m = Math.min(left, right, up, down);
  if (m === up) r.y = b.y - R;
  else if (m === down) r.y = b.y + b.h + R;
  else if (m === left) r.x = b.x - R;
  else r.x = b.x + b.w + R;
}

/** Grab, bring back or capture a flag. True on a capture. */
function touchFlags<P>(w: World<P>, r: Runner<P>, events: Event<P>[]) {
  const enemy = w.flags[other(r.side)], own = w.flags[r.side];
  if (enemy.carrier === r) {
    if (sideOf(r.x) !== r.side) return false;
    w.captures[r.side]++;
    r.points += POINTS.capture;
    events.push({ t: 'capture', who: r });
    return true;
  }
  const reach = FLAG_REACH ** 2;
  // Freed prisoners run home under protection; no grabbing on that free ride.
  if (!enemy.carrier && r.safe <= 0 && dist2(r, enemy) < reach) {
    enemy.carrier = r;
    events.push({ t: 'grab', who: r });
  }
  if (!own.carrier && !atHome(own) && dist2(r, own) < reach) {
    home(w, r.side);
    events.push({ t: 'return', by: r });
  }
  return false;
}

/** A free runner touching the enemy jail frees all of their side's prisoners. */
function breakOut<P>(w: World<P>, r: Runner<P>, events: Event<P>[]) {
  const j = JAILS[other(r.side)];
  if (boxDist(r, j) >= R + 2) return; // the fence push-out leaves a toucher exactly R away
  const freed = prisoners(w, r.side);
  if (!freed.length) return;
  // Out through the fence facing home (side 1's prisoners sit in the left jail), mirrored in it so they don't land on one spot.
  const fence = r.side ? j.x + j.w : j.x, out = r.side ? 2 : -2;
  for (const f of freed) Object.assign(f, { jailed: false, safe: INVULN_S, x: 2 * fence - f.x + out });
  if (!carrying(w, r)) r.safe = INVULN_S; // a carrier stays taggable: no free ride home with the flag
  r.points += POINTS.rescue * freed.length;
  events.push({ t: 'jailbreak', by: r, freed });
}

/** a tags b: an intruder (b in a's half) touched by a defender standing in their own half. */
function canTag<P>(a: Runner<P>, b: Runner<P>) {
  return a.side !== b.side && active(a) && active(b) && b.safe <= 0
    && sideOf(b.x) === a.side && sideOf(a.x) === a.side && dist2(a, b) < (2 * R) ** 2;
}

function jail<P>(w: World<P>, by: Runner<P>, who: Runner<P>, events: Event<P>[]) {
  if (carrying(w, who)) home(w, by.side);
  // A 3x3 grid of cells around the jail's centre, so prisoners don't stack; raised so the bottom row's names fit.
  const j = JAILS[by.side], k = prisoners(w, who.side).length;
  Object.assign(who, { jailed: true, dash: 0, x: j.x + j.w / 2 + ((k % 3) - 1) * 50, y: j.y + (j.h - NAME_H) / 2 + ((Math.floor(k / 3) % 3) - 1) * 50 });
  by.points += POINTS.tag;
  events.push({ t: 'tag', by, who });
}

function home<P>(w: World<P>, s: Side) {
  Object.assign(w.flags[s], FLAG_BASES[s], { carrier: null });
}
