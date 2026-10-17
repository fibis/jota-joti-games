import { describe, expect, it } from 'vitest';
import { ABLE_BAKER, DIN_5009, marked, options } from '~/games/callsign/spelling';
import { PHONETIC, spellChar } from '~/games/kit/callsigns';

const CHARS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
/** "X-ray" and "Xray", "Victor" and "Viktor" would read as the same answer. */
const looks = (w: string) => w.toLowerCase().replace(/[^a-zäöü]/g, '').replace(/k/g, 'c');

describe('call sign options', () => {
  it('four clearly different words for every character, the right one exactly once', () => {
    for (const lang of ['en', 'de'] as const) {
      for (const c of CHARS) {
        for (let n = 0; n < 20; n++) {
          const o = options(c, lang);
          expect(o).toHaveLength(4);
          expect(new Set(o.map(looks)).size).toBe(4);
          expect(o.filter(w => w === spellChar(c, lang))).toHaveLength(1);
        }
      }
    }
  });

  it('offers the classic wrong answers', () => {
    expect(options('P', 'en')).toEqual(expect.arrayContaining(['Papa', 'Peter', 'Paula']));
    expect(options('2', 'de')).toEqual(expect.arrayContaining(['Zwo', 'Zwei']));
    expect(options('5', 'de').every(w => ['Null', 'Eins', 'Zwo', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun'].includes(w))).toBe(true);
  });

  it('old alphabets never contain a NATO word (no right answer offered as a wrong one)', () => {
    const nato = new Set(Object.values(PHONETIC).map(looks));
    for (const w of [...Object.values(ABLE_BAKER), ...Object.values(DIN_5009)]) expect(nato.has(looks(w))).toBe(false);
  });

  it('marks the current character', () => {
    expect(marked('PA3XYZ', 2)).toBe('P A [3] X Y Z');
    expect(marked('DL1A', 0)).toBe('[D] L 1 A');
  });
});
