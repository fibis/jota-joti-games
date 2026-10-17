import { describe, expect, it } from 'vitest';
import { morseTimeline } from '#shared/morse';
import { WORDS } from '~/games/morse-master/words';
import { PLAN_LAMP, ROUND_S, UNIT_S, lampAt, makeRound, morseSoFar, points } from '~/games/signal-lamp/rounds';

describe('signal lamp', () => {
  it('plays a full game per language: fresh answers and distractors, four distinct options of the same tier', () => {
    expect(UNIT_S).toHaveLength(PLAN_LAMP.length);
    for (const u of UNIT_S) expect(u).toBeGreaterThanOrEqual(0.1); // flash rate: see UNIT_S
    for (const tiers of Object.values(WORDS)) {
      for (let game = 0; game < 50; game++) {
        const used = new Set<string>();
        for (const tier of PLAN_LAMP) {
          const { word, options, correct } = makeRound(tiers[tier] ?? [], used);
          expect(used.has(word)).toBe(false);
          for (const o of options) expect(used.has(o)).toBe(false); // no past answer to rule out
          used.add(word);
          expect(new Set(options).size).toBe(4);
          expect(options[correct]).toBe(word);
          for (const o of options) expect(tiers[tier]).toContain(o);
        }
      }
    }
  });

  it('prefers look-alike distractors', () => {
    const tier = ['ABCD', 'AXYZ', 'QQQQ', 'B', 'C', 'DD', 'EEEEE'];
    for (let i = 0; i < 30; i++) {
      const { options } = makeRound(tier, new Set(tier.slice(1)));
      expect(options).toEqual(expect.arrayContaining(['ABCD', 'AXYZ', 'QQQQ']));
    }
  });

  it('scores 100 down to 50 over the round', () => {
    expect(points(-0.1)).toBe(100);
    expect(points(0)).toBe(100);
    expect(points(ROUND_S / 2)).toBe(75);
    expect(points(ROUND_S + 5)).toBe(50);
  });

  it('lights the lamp on the tones and counts the dits/dahs', () => {
    const { tones } = morseTimeline('A'); // dit at 0, dah at 2..5
    expect(lampAt(tones, -0.1)).toEqual({ on: false, shown: 0 });
    expect(lampAt(tones, 0.5)).toEqual({ on: true, shown: 1 });
    expect(lampAt(tones, 1.5)).toEqual({ on: false, shown: 1 });
    expect(lampAt(tones, 4.9)).toEqual({ on: true, shown: 2 });
    expect(lampAt(tones, 5)).toEqual({ on: false, shown: 2 });
  });

  it('writes the code as far as it flashed', () => {
    expect(morseSoFar('SOS', 0)).toBe('');
    expect(morseSoFar('SOS', 4)).toBe('··· −');
    expect(morseSoFar('SOS')).toBe('··· −−− ···');
  });
});
