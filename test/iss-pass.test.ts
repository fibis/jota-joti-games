import { describe, expect, it } from 'vitest';
import { AIM_MAX, BEAM_DEG, bearing, CLOUD_DIM, fly, LOCK_DEG, LOCK_S, LOCK_SIG, PTS_S, QSO_PTS, signal, track } from '~/games/iss-pass/sky';
import type { Arc, Station, Target } from '~/games/iss-pass/sky';

const DT = 0.02;
const station = (aim = 0): Station => ({ x: 800, y: 700, aim, turn: 0, sig: 0, points: 0, links: [{ lock: 0, qso: false }, { lock: 0, qso: false }] });
const target = (x: number, y: number, weight = 1): Target => ({ x, y, up: true, weight, dim: 1 });
const run = (st: Station, targets: Target[], seconds: number) => {
  const qsos: number[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const q = track(st, targets, DT);
    if (q >= 0) qsos.push(q);
  }
  return qsos;
};

describe('ISS pass', () => {
  it('measures directions from vertical and fades the signal across the beam', () => {
    expect(bearing(800, 700, 800, 100)).toBeCloseTo(0);
    expect(bearing(800, 700, 1400, 700)).toBeCloseTo(90);
    expect(bearing(800, 700, 300, 200)).toBeCloseTo(-45);
    expect(signal(20, 20)).toBe(1);
    expect(signal(20, 20 + BEAM_DEG / 2)).toBeCloseTo(0.5 ** 1.5);
    expect(signal(-30, -30 - BEAM_DEG)).toBe(0);
    expect(signal(10, 10 - LOCK_DEG)).toBeCloseTo(LOCK_SIG); // the drawn lock core matches the curve
  });

  it('flies an arc from edge to edge, highest halfway, only during its slot', () => {
    const arc: Arc = { from: -80, to: 1680, base: 720, peak: 400, start: 2, dur: 10 };
    const tg = target(0, 0);
    fly(arc, 7, tg);
    expect(tg).toMatchObject({ x: 800, y: 320, up: true });
    fly(arc, 2, tg);
    expect(tg).toMatchObject({ x: -80, y: 720, up: true });
    fly(arc, 1, tg);
    expect(tg.up).toBe(false);
  });

  it('a steady lock earns points and one QSO per satellite', () => {
    const st = station();
    const qsos = run(st, [target(800, 100), target(0, 0)], LOCK_S + 2);
    expect(qsos).toEqual([0]);
    expect(st.sig).toBe(1);
    expect(st.points).toBeCloseTo((LOCK_S + 2) * PTS_S + QSO_PTS, 0);
  });

  it('the best satellite scores, the ×2 one double; both can be logged', () => {
    const st = station();
    const qsos = run(st, [target(800, 100), target(800, 100, 2)], LOCK_S + 1);
    expect(qsos).toEqual([0, 1]); // second one completes a frame later
    expect(st.points).toBeCloseTo((LOCK_S + 1) * PTS_S * 2 + 2 * QSO_PTS, 0);
  });

  it('a cloud leaves too little signal to score', () => {
    const st = station();
    const iss = { ...target(800, 100), dim: CLOUD_DIM };
    expect(run(st, [iss, target(0, 0)], LOCK_S + 1)).toEqual([]);
    expect(st.points).toBe(0);
    expect(st.sig).toBeCloseTo(CLOUD_DIM);
  });

  it('turns with the stick, stops at the limit, and hears nothing off target', () => {
    const st = station();
    st.turn = 1;
    run(st, [{ ...target(800, 100), up: false }, target(0, 0)], 2);
    expect(st.aim).toBe(AIM_MAX);
    expect(st.points).toBe(0);
    st.turn = -0.5;
    run(st, [target(800, 100), target(0, 0)], 0.5);
    expect(st.aim).toBeCloseTo(AIM_MAX - 27.5);
  });
});
