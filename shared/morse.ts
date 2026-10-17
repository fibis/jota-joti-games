export const CODE: Readonly<Record<string, string>> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
export const DECODE: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));

// Calibration knobs: beginner-friendly. Shorter press than DAH_MS = dit; silence of GAP_MS ends the letter.
export const DAH_MS = 220;
export const GAP_MS = 900;

/** `.-` → `·−`, for display. */
export const prettyMorse = (s: string) => s.replace(/\./g, '·').replace(/-/g, '−');

/** Telegraph key: call down()/up() on press/release, get whole letters back ('?' for no letter). */
export class MorseKey {
  #sym = '';
  #pressedAt = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  readonly #onLetter: (letter: string) => void;
  readonly #onSymbols: (symbols: string) => void;

  constructor(onLetter: (letter: string) => void, onSymbols: (symbols: string) => void = () => {}) {
    this.#onLetter = onLetter;
    this.#onSymbols = onSymbols;
  }

  down(now = performance.now()) {
    clearTimeout(this.#timer);
    this.#pressedAt = now;
  }

  up(now = performance.now()) {
    if (!this.#pressedAt) return;
    this.#sym += now - this.#pressedAt < DAH_MS ? '.' : '-';
    this.#pressedAt = 0;
    this.#onSymbols(this.#sym);
    this.#timer = setTimeout(() => this.flush(), GAP_MS);
  }

  flush() {
    clearTimeout(this.#timer);
    if (!this.#sym) return;
    this.#onLetter(DECODE[this.#sym] ?? '?');
    this.#sym = '';
    this.#onSymbols('');
  }
}
