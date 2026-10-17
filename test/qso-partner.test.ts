import { describe, expect, it } from 'vitest';
import { CLUB, clue, CODE_DIGITS, logCode, makeRound, PLAN, QSO_POINTS, STYLES, stationOf, toClub } from '~/games/qso-partner/pairing';
import type { Round } from '~/games/qso-partner/pairing';
import { spell } from '~/games/kit/callsigns';

const names = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const stations = (r: Round<string>) => [r.club, ...r.seats.values()];

describe('QSO partner pairing', () => {
  it('pairs everyone exactly once, symmetric, the odd one out with the club', () => {
    for (let n = 1; n <= 17; n++) {
      const r = makeRound(names(n), 'en', 0);
      expect(r.seats.size).toBe(n);
      let club = 0;
      for (const [p, s] of r.seats) {
        if (s.partner === CLUB) club++;
        else expect(r.seats.get(s.partner)?.partner).toBe(p);
      }
      expect(club).toBe(n % 2);
    }
  });

  it('call signs and codes are unique, club included', () => {
    const r = makeRound(names(30), 'de', 1);
    const all = stations(r);
    expect(new Set(all.map(s => s.call)).size).toBe(31);
    expect(new Set(all.map(s => s.code)).size).toBe(31);
    for (const s of all) expect(s.code).toMatch(new RegExp(`^[1-9]\\d{${CODE_DIGITS - 1}}$`));
    expect(r.club.call).toMatch(/^[A-Z]{1,3}\dCLB$/);
  });

  it('clues spell the partner call in the round style', () => {
    // Narrow no-break spaces inside a letter, em spaces between letters: nothing white-space: pre-line collapses.
    expect(clue('PA3', 'morse', 'en')).toBe('·\u202F−\u202F−\u202F·\u2003·\u202F−\u2003·\u202F·\u202F·\u202F−\u202F−');
    expect(clue('DL2A', 'phonetic', 'de')).toBe('Delta Lima Zwo Alfa');
    PLAN.forEach((style, index) => {
      const r = makeRound(names(6), 'en', index);
      for (const s of r.seats.values()) {
        const call = stationOf(r, s.partner)!.call;
        expect(style === 'mix' ? STYLES : [style]).toContain(s.style);
        expect(s.clue).toBe(clue(call, s.style, 'en'));
      }
    });
    const r = makeRound(names(2), 'en', 1);
    const s = r.seats.get('p0')!;
    expect(s.clue).toBe(spell(r.seats.get('p1')!.call, 'en').join(' '));
  });

  it('a QSO needs both halves; points go by confirmation order', () => {
    const r = makeRound(names(4), 'en', 0); // even: two pairs, no club
    const partner = (p: string) => r.seats.get(p)!.partner as string;
    const code = (p: string) => r.seats.get(p)!.code;
    const a = 'p0', b = partner(a);
    expect(logCode(r, a, ['100', '101'].find(c => c !== code(b))!)).toBe('wrong');
    expect(logCode(r, a, code(b))).toBe('logged');
    expect(logCode(r, a, code(b))).toBeUndefined(); // half already in
    expect(logCode(r, b, code(a))).toBe('confirmed');
    expect([r.seats.get(a)!.pts, r.seats.get(b)!.pts]).toEqual([QSO_POINTS[0], QSO_POINTS[0]]);
    const c = names(4).find(p => p !== a && p !== b)!, d = partner(c);
    logCode(r, d, code(c));
    expect(logCode(r, c, code(d))).toBe('confirmed');
    expect(r.seats.get(c)!.pts).toBe(QSO_POINTS[1]);
  });

  it('the club needs one half; latecomers and stranded pairs move to the club', () => {
    const r = makeRound(names(1), 'en', 0);
    expect(logCode(r, 'p0', r.club.code)).toBe('confirmed');
    expect(r.seats.get('p0')!.pts).toBe(QSO_POINTS[0]);

    const r2 = makeRound(names(2), 'en', 2);
    toClub(r2, 'late');
    const late = r2.seats.get('late')!;
    expect(late.partner).toBe(CLUB);
    expect(late.clue).toBe(clue(r2.club.call, 'morse', 'en'));
    expect(new Set(stations(r2).map(s => s.code)).size).toBe(4);
    logCode(r2, 'p0', r2.seats.get('p1')!.code); // half logged, then p1 goes off air
    toClub(r2, 'p0');
    expect([r2.seats.get('p0')!.partner, r2.seats.get('p1')!.partner]).toEqual([CLUB, CLUB]);
    expect(r2.seats.get('p0')!.logged).toBe(false);
    expect(logCode(r2, 'p0', r2.club.code)).toBe('confirmed');
    expect(logCode(r2, 'late', r2.club.code)).toBe('confirmed');
    expect(late.pts).toBe(QSO_POINTS[1]);
  });
});
