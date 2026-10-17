// Signal Lamp: the word each round flashes and its look-alikes, the lamp at any moment, the scoring.
import { CODE, prettyMorse } from '#shared/morse';
import { pick, shuffle } from '~/games/kit/random';
import { speedPoints } from '~/games/kit/rounds';

/** Word tier per round (Morse Master's WORDS). Tier 0 is only SOS: nothing to mix it up with. */
export const PLAN_LAMP = [1, 1, 1, 2, 2, 2, 3, 3];
/**
 * Morse unit (one dit) per round in seconds, 0.14 s ≈ 9 wpm to 0.11 s ≈ 11 wpm. Slow again from round 5, where
 * the sound goes (SOUND_ROUNDS): light only is hard enough. Never under 0.1 s, so the lamp stays near 4 flashes/s.
 */
export const UNIT_S = [0.14, 0.13, 0.12, 0.11, 0.14, 0.13, 0.12, 0.11];

export const ROUND_S = 30;
export const FASTEST_BONUS = 10;

/** A word not played yet this game, plus three others of its tier as the four shuffled options. */
export function makeRound(tier: readonly string[], used: ReadonlySet<string>) {
  const word = pick(tier.filter(w => !used.has(w)));
  // Past answers only when the tier runs short: a word known not to come again could be ruled out unread.
  const rest = tier.filter(w => w !== word && !used.has(w));
  const pool = rest.length >= 3 ? rest : tier.filter(w => w !== word);
  // Look-alikes first (same length, same first letter), so the light really has to be read.
  const like = (w: string) => Number(w.length === word.length) + Number(w[0] === word[0]);
  const others = shuffle(pool).sort((a, b) => like(b) - like(a));
  const options = shuffle([word, ...others.slice(0, 3)]);
  return { word, options, correct: options.indexOf(word) };
}

/** 50 for reading it right, up to 50 more for reading it fast. */
export const points = (elapsedS: number) => speedPoints(elapsedS, ROUND_S);

/** The lamp `u` Morse units into the word: lit or not, and how many dits/dahs have flashed so far. */
export function lampAt(tones: readonly (readonly [start: number, length: number])[], u: number) {
  let on = false, shown = 0;
  for (const [start, length] of tones) {
    if (u < start) break;
    shown++;
    on = u < start + length;
  }
  return { on, shown };
}

/** The first `shown` dits/dahs of `word`, letters apart: `morseSoFar('SOS', 4)` → `··· −`. */
export function morseSoFar(word: string, shown = Infinity) {
  const letters: string[] = [];
  for (const c of word) {
    if (shown <= 0) break;
    const code = CODE[c] ?? '';
    letters.push(code.slice(0, shown));
    shown -= code.length;
  }
  return prettyMorse(letters.join(' '));
}
