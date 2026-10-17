import { describe, expect, it } from 'vitest';
import {
  createWorld, dash, DASH_S, type Event, finalScores, FLAG_BASES, GUARD_R, H, INVULN_S, JAILS, kickOff, MID, NAME_H, OBSTACLES, POINTS, R,
  setGhost, situation, spawn, SPEED, step, steer, TOP, W, type Runner, type World,
} from '~/games/capture-flag/rules';

const DT = 1 / 60;
const world = (n0 = 2, n1 = 2) =>
  createWorld<string>([Array.from({ length: n0 }, (_, i) => `a${i}`), Array.from({ length: n1 }, (_, i) => `b${i}`)]);
const runner = (w: World<string>, p: string) => w.runners.find(r => r.p === p)!;
const put = (r: Runner<string>, x: number, y: number) => Object.assign(r, { x, y, vx: 0, vy: 0 });
/** Steps `frames` frames of 1/60 s, returns what happened. */
const run = (w: World<string>, frames = 1) => {
  const events: Event<string>[] = [];
  for (let i = 0; i < frames; i++) step(w, DT, events);
  return events;
};
const inside = (r: Runner<string>, s: 0 | 1) => {
  const j = JAILS[s];
  return r.x >= j.x && r.x <= j.x + j.w && r.y >= j.y && r.y <= j.y + j.h;
};

describe('capture the flag field', () => {
  it('is mirror-symmetric', () => {
    for (const o of OBSTACLES) expect(OBSTACLES.some(m => m.x === W - o.x && m.y === o.y && m.r === o.r)).toBe(true);
    expect(FLAG_BASES[1]).toEqual({ x: W - FLAG_BASES[0].x, y: FLAG_BASES[0].y });
    expect(JAILS[1]).toEqual({ ...JAILS[0], x: W - JAILS[0].x - JAILS[0].w });
  });

  it('spawns 20 per side on their own back line, clear of everything', () => {
    for (const s of [0, 1] as const) {
      const spots = Array.from({ length: 20 }, (_, i) => spawn(s, i));
      for (const [i, p] of spots.entries()) {
        expect(p.x < MID).toBe(s === 0);
        expect(p.y - R).toBeGreaterThanOrEqual(TOP);
        expect(p.y + R).toBeLessThanOrEqual(H);
        expect(OBSTACLES.every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.r + R)).toBe(true);
        expect(JAILS.every(j => p.y + R < j.y || p.x - R > j.x + j.w || p.x + R < j.x)).toBe(true);
        expect(Math.hypot(p.x - FLAG_BASES[s].x, p.y - FLAG_BASES[s].y)).toBeGreaterThanOrEqual(GUARD_R);
        expect(spots.slice(i + 1).every(q => Math.hypot(q.x - p.x, q.y - p.y) >= 2 * R)).toBe(true);
      }
    }
  });
});

describe('capture the flag rules', () => {
  it('a defender tags an intruder in their own half: jail and +2', () => {
    const w = world(), a = runner(w, 'a0'), b = runner(w, 'b0');
    put(a, 600, 300);
    put(b, 600 + R, 300); // b intrudes into side 0's half
    const events = run(w);
    expect(events).toEqual([{ t: 'tag', by: a, who: b }]);
    expect(b.jailed).toBe(true);
    expect(inside(b, 0)).toBe(true);
    expect(a.points).toBe(POINTS.tag);
    expect(situation(w, b)).toBe('jail');
  });

  it('no tag in the intruder-free half or on a protected runner', () => {
    const w = world(), a = runner(w, 'a0'), b = runner(w, 'b0');
    put(a, 900, 300); // a intrudes: b may tag a, not the other way round
    put(b, 900 + R, 300);
    expect(run(w)).toEqual([{ t: 'tag', by: b, who: a }]);
    const w2 = world(), c = runner(w2, 'a0'), d = runner(w2, 'b0');
    put(c, 600, 300);
    put(d, 600 + R, 300);
    d.safe = 1;
    expect(run(w2)).toEqual([]);
  });

  it('jailed runners stay inside the fence', () => {
    const w = world(), a = runner(w, 'a0'), b = runner(w, 'b0');
    put(a, 600, 300);
    put(b, 610, 300);
    run(w);
    steer(b, 1, -1);
    put(a, 100, 150);
    run(w, 180);
    expect(b.jailed).toBe(true);
    expect(inside(b, 0)).toBe(true);
  });

  it('grab, run home, capture: +5, +1 capture, everyone back on the line', () => {
    const w = world(), a = runner(w, 'a0');
    put(a, FLAG_BASES[1].x - 30, FLAG_BASES[1].y);
    expect(run(w)).toEqual([{ t: 'grab', who: a }]);
    expect(situation(w, a)).toBe('carry');
    expect(dash(w, a)).toBe(false); // carriers can't dash
    put(a, MID + 5, 150);
    steer(a, -1, 0); // 5 px per frame: the second frame crosses the line
    const events = run(w, 2);
    expect(events).toEqual([{ t: 'capture', who: a }]);
    expect(w.captures).toEqual([1, 0]);
    expect(a.points).toBe(POINTS.capture);
    expect(w.flags[1]).toMatchObject({ ...FLAG_BASES[1], carrier: null });
    expect(w.runners.map(r => ({ x: r.x, y: r.y }))).toEqual([spawn(0, 0), spawn(0, 1), spawn(1, 0), spawn(1, 1)]);
  });

  it('no guarding: a defender parked on their flag is pushed off it and the grab gets through', () => {
    const w = world(1, 1), a = runner(w, 'a0'), b = runner(w, 'b0'), base = FLAG_BASES[0];
    put(a, base.x, base.y);
    put(b, base.x, base.y - 150);
    steer(b, 0, 1); // straight down through the flag
    const events = run(w, 60);
    expect(events).toEqual([{ t: 'grab', who: b }]);
    expect(w.flags[0].carrier).toBe(b);
    expect(Math.hypot(a.x - base.x, a.y - base.y)).toBeGreaterThanOrEqual(GUARD_R);
  });

  it('a tagged carrier sends the flag home', () => {
    const w = world(), a = runner(w, 'a0'), b = runner(w, 'b0');
    put(a, FLAG_BASES[1].x - 30, FLAG_BASES[1].y);
    run(w);
    put(b, a.x + R, a.y);
    run(w);
    expect(a.jailed).toBe(true);
    expect(inside(a, 1)).toBe(true);
    expect(w.flags[1]).toMatchObject({ ...FLAG_BASES[1], carrier: null });
  });

  it('jailbreak frees every prisoner, protects them and pays the rescuer', () => {
    const w = world(3, 1), b = runner(w, 'b0');
    for (const p of ['a0', 'a1']) {
      put(runner(w, p), 1000, 300);
      put(b, 1000 + R, 300);
      run(w);
    }
    expect(w.runners.filter(r => r.jailed)).toHaveLength(2);
    const hero = runner(w, 'a2'), j = JAILS[1];
    put(b, 900, 200);
    put(hero, j.x - R - 30, j.y + 50);
    steer(hero, 1, 0);
    const events = run(w, 18);
    expect(events.map(e => e.t)).toEqual(['jailbreak']);
    expect(w.runners.filter(r => r.jailed)).toHaveLength(0);
    expect([runner(w, 'a0').safe, runner(w, 'a1').safe, hero.safe].every(s => s > INVULN_S - 0.5)).toBe(true);
    expect(hero.points).toBe(2 * POINTS.rescue);
    const [f0, f1] = [runner(w, 'a0'), runner(w, 'a1')];
    expect(Math.max(f0.x, f1.x) + R).toBeLessThan(j.x); // out on the side facing home
    expect(Math.hypot(f0.x - f1.x, f0.y - f1.y)).toBeGreaterThanOrEqual(2 * R); // not on one spot
  });

  it('a carrier who frees prisoners stays taggable', () => {
    const w = world(2, 1), a0 = runner(w, 'a0'), a1 = runner(w, 'a1'), b = runner(w, 'b0'), j = JAILS[1];
    put(a1, 1000, 300);
    put(b, 1000 + R, 300);
    run(w); // a1 to jail
    put(b, 900, 200);
    put(a0, FLAG_BASES[1].x - 30, FLAG_BASES[1].y);
    run(w); // a0 grabs
    put(a0, j.x - R - 10, j.y + 40);
    steer(a0, 1, 0);
    expect(run(w, 10).map(e => e.t)).toEqual(['jailbreak']);
    expect(a1.safe).toBeGreaterThan(0);
    expect(a0.safe).toBe(0);
    put(b, a0.x - R, a0.y);
    run(w);
    expect(a0.jailed).toBe(true);
    expect(w.flags[1]).toMatchObject({ ...FLAG_BASES[1], carrier: null });
  });

  it('dash: faster for a moment, then a cooldown', () => {
    const w = world(), a = runner(w, 'a0');
    put(a, 300, 150);
    expect(dash(w, a)).toBe(false); // standing still
    steer(a, 0, 1);
    expect(dash(w, a)).toBe(true);
    expect(dash(w, a)).toBe(false);
    run(w, Math.round(DASH_S * 60));
    expect(a.y - 150).toBeGreaterThan(SPEED * DASH_S * 2);
    run(w, 120);
    expect(dash(w, a)).toBe(true);
  });

  it('ghosts neither tag nor get tagged; a ghost carrier drops the flag for the owners to bring back', () => {
    const w = world(), a = runner(w, 'a0'), b = runner(w, 'b0');
    put(a, FLAG_BASES[1].x - 30, FLAG_BASES[1].y);
    run(w);
    put(a, 1200, 300);
    run(w);
    setGhost(w, a, true);
    put(b, 1200, 300 + 2 * R - 2); // touching the ghost, just out of the flag's reach
    expect(run(w, 6)).toEqual([]);
    expect(w.flags[1]).toMatchObject({ x: 1200, y: 300, carrier: null });
    put(b, 1200 + 30, 300);
    expect(run(w)).toEqual([{ t: 'return', by: b }]);
    expect(w.flags[1]).toMatchObject(FLAG_BASES[1]);
  });

  it('final scores: personal points, +10 for the winners, nothing extra on a draw', () => {
    const w = world(1, 1);
    w.runners[0]!.points = 7;
    expect(finalScores(w)).toEqual([['a0', 7], ['b0', 0]]);
    w.captures[1] = 1;
    expect(finalScores(w)).toEqual([['a0', 7], ['b0', POINTS.win]]);
  });

  it('survives a long random match: everyone stays on the field, prisoners in jail', () => {
    const w = world(10, 10), events: Event<string>[] = [];
    let captures = 0;
    for (let i = 0; i < 60 * 120; i++) {
      for (const r of w.runners) {
        if (Math.random() < 0.05) steer(r, Math.random() * 2 - 1, Math.random() * 2 - 1);
        if (Math.random() < 0.01) dash(w, r);
        if (Math.random() < 0.001) setGhost(w, r, !r.ghost);
      }
      step(w, 0.05, events);
      captures += events.filter(e => e.t === 'capture').length;
      events.length = 0;
      for (const r of w.runners) {
        expect(Number.isFinite(r.x + r.y)).toBe(true);
        expect(r.x >= R && r.x <= W - R && r.y >= TOP + R - 1e-9 && r.y <= H - R - NAME_H).toBe(true); // names stay on the canvas
        if (r.jailed) expect(inside(r, r.side ? 0 : 1)).toBe(true);
      }
    }
    expect(w.captures[0] + w.captures[1]).toBe(captures);
    kickOff(w);
    expect(w.runners.every(r => !r.jailed)).toBe(true);
  });
});
