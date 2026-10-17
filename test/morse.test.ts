import { afterEach, describe, expect, it, vi } from 'vitest';
import { CODE, DAH_MS, DECODE, GAP_MS, MorseKey } from '#shared/morse';

describe('morse', () => {
  afterEach(() => vi.useRealTimers());

  it('is a clean two-way mapping', () => {
    for (const [c, m] of Object.entries(CODE)) expect(DECODE[m]).toBe(c);
  });

  it('keys letters: short = dit, long = dah, garbage = ?', () => {
    vi.useFakeTimers(); // the GAP_MS timer must not fire between presses or leak out of the test
    const out: string[] = [];
    const key = new MorseKey(c => out.push(c));
    const press = (...lens: number[]) => {
      let t = 1000;
      for (const l of lens) { key.down(t); key.up(t += l); t += 100; }
      key.flush();
    };
    press(50, 50, 50); // S
    press(DAH_MS + 50, DAH_MS + 50, DAH_MS + 50); // O
    press(50, DAH_MS + 1); // A
    press(...Array<number>(8).fill(50)); // 8 dits: not a letter
    expect(out).toEqual(['S', 'O', 'A', '?']);
  });

  it('ends the letter after GAP_MS of silence', () => {
    vi.useFakeTimers();
    const out: string[] = [];
    const key = new MorseKey(c => out.push(c));
    key.down(1000); // not 0: MorseKey treats pressedAt 0 as "not pressed"
    key.up(1050);
    vi.advanceTimersByTime(GAP_MS - 1);
    expect(out).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(out).toEqual(['E']);
  });
});
