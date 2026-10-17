import { describe, expect, it } from 'vitest';
import {
  crashed, CRASH_M, CRASH_S, nextBuilder, PIECES, pieceSequence, points, PX_PER_M, REST_S, settle, towerHeight, winners,
  type Rest,
} from '~/games/tower/pieces';
import type { Player } from '~/games/types';

const player = (id: string, online = true): Player => ({ id, name: id, avatar: '🐻', color: '#fff', online });

describe('pioneering tower', () => {
  it('pieces are named and made of real bars', () => {
    for (const def of Object.values(PIECES)) {
      expect(def.name.en && def.name.de).toBeTruthy();
      for (const b of def.bars) expect(b.w > 0 && b.h > 0).toBe(true);
    }
    const [left, right] = PIECES.aframe.bars;
    expect(left!.x).toBeCloseTo(-right!.x); // the A-frame is symmetric
  });

  it('every bag holds each piece once', () => {
    const kinds = Object.keys(PIECES).sort();
    const seq = pieceSequence(3);
    expect(seq).toHaveLength(3 * kinds.length);
    for (let i = 0; i < seq.length; i += kinds.length) expect(seq.slice(i, i + kinds.length).sort()).toEqual(kinds);
  });

  it('builders take turns among the online members', () => {
    const [a, b, c] = [player('a'), player('b', false), player('c')];
    const team = [a, b, c];
    expect(nextBuilder(team)).toBe(a);
    expect(nextBuilder(team, a)).toBe(c); // b is offline: skipped
    expect(nextBuilder(team, c)).toBe(a); // wraps around
    expect(nextBuilder([a], a)).toBe(a); // alone: again
    expect(nextBuilder([b])).toBeUndefined();
    expect(nextBuilder(team, player('stranger'))).toBe(a);
  });

  it('a piece counts once it lay still, and keeps counting through a wobble', () => {
    const r: Rest = { still: 0, counted: false };
    for (let t = 0; t < REST_S - 0.1; t += 0.1) settle(r, 0, 0, 0.1);
    expect(r.counted).toBe(false);
    settle(r, 0, 0, 0.2);
    expect(r.counted).toBe(true);
    settle(r, 1, 0.03, 1 / 60); // nudged by a landing piece
    expect(r.counted).toBe(true);
    settle(r, 8, 0, 1 / 60); // falling
    expect(r.counted).toBe(false);
  });

  it('measures the highest resting piece in the team half', () => {
    const baseY = 700;
    const pieces = [
      { x: 300, top: baseY - 2 * PX_PER_M, counted: true },
      { x: 320, top: baseY - 5 * PX_PER_M, counted: false }, // still falling
      { x: 900, top: baseY - 9 * PX_PER_M, counted: true }, // the other team's
    ];
    expect(towerHeight(pieces, 0, 800, baseY)).toBe(2);
    expect(towerHeight([], 0, 800, baseY)).toBe(0);
  });

  it('a big height loss within CRASH_S is one crash', () => {
    const h: [number, number][] = [];
    expect(crashed(h, 0, 6)).toBe(false);
    expect(crashed(h, 0.5, 6 - CRASH_M - 0.5)).toBe(true);
    expect(crashed(h, 0.6, 1)).toBe(false); // the same collapse does not bang twice
    expect(crashed(h, 10, 8)).toBe(false);
    expect(crashed(h, 10 + CRASH_S + 0.5, 2)).toBe(false); // slow decline over more than CRASH_S
  });

  it('an avalanche that takes two seconds still crashes', () => {
    const h: [number, number][] = [];
    let crashes = 0;
    // 10 m down to 5.5 m at 2.25 m/s: never 3 m within one second
    for (let t = 0; t <= 2; t += 1 / 60) if (crashed(h, t, 10 - 2.25 * t)) crashes++;
    expect(crashes).toBe(1);
  });

  it('the tallest team wins, ties share, empty teams never do', () => {
    const two = [{ players: [1] }, { players: [2] }];
    expect(winners(two, [4.2, 3.1])).toEqual([0]);
    expect(winners(two, [4.21, 4.24])).toEqual([0, 1]); // both read 4.2 m
    expect(winners(two, [0, 0])).toEqual([]);
    expect(winners([{ players: [1] }, { players: [] }], [1, 5])).toEqual([0]);
    expect(points(4.26, true, 3)).toBe(43 + 15 + 6);
    expect(points(0, false, 0)).toBe(0);
  });
});
