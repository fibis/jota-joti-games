export const CODE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
export const DECODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));

// Calibration knobs: beginner-friendly. Shorter press than DAH_MS = dit; silence of GAP_MS ends the letter.
export const DAH_MS = 220, GAP_MS = 900;

// Telegraph key: call down()/up() on press/release, get whole letters back via onLetter.
export class MorseKey {
  constructor(onLetter, onSymbols = () => {}) { Object.assign(this, { onLetter, onSymbols, sym: '', t: 0 }); }
  down(now = performance.now()) { clearTimeout(this.timer); this.t = now; }
  up(now = performance.now()) {
    if (!this.t) return;
    this.sym += now - this.t < DAH_MS ? '.' : '-';
    this.t = 0;
    this.onSymbols(this.sym);
    this.timer = setTimeout(() => this.flush(), GAP_MS);
  }
  flush() {
    if (!this.sym) return;
    this.onLetter(DECODE[this.sym] || '?');
    this.sym = '';
    this.onSymbols('');
  }
}

// Sidetone for the key, and playback of whole words. One shared AudioContext (needs a user tap first).
let ac;
export const audio = () => (ac ??= new AudioContext());
export function tone(on, freq = 700) {
  const a = audio();
  if (on) {
    tone.o?.stop();
    tone.o = Object.assign(a.createOscillator(), { type: 'sine' });
    tone.o.frequency.value = freq;
    tone.g = a.createGain();
    tone.g.gain.value = 0.25;
    tone.o.connect(tone.g).connect(a.destination);
    tone.o.start();
  } else if (tone.o) {
    tone.g.gain.setTargetAtTime(0, a.currentTime, 0.01); // avoid click
    tone.o.stop(a.currentTime + 0.05);
    tone.o = null;
  }
}
export function playWord(word, unit = 0.09, freq = 650, vol = 0.2) {
  const a = audio(), g = a.createGain();
  g.connect(a.destination);
  let t = a.currentTime + 0.1;
  for (const ch of word.toUpperCase()) {
    for (const s of CODE[ch] || '') {
      const o = a.createOscillator();
      o.frequency.value = freq;
      o.connect(g);
      g.gain.setValueAtTime(vol, t);
      o.start(t);
      o.stop(t += unit * (s === '.' ? 1 : 3));
      g.gain.setValueAtTime(0, t);
      t += unit;
    }
    t += unit * 2;
  }
  return t - a.currentTime;
}
