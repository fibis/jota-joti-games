// Sidetone for the key, and playback of whole words. One shared AudioContext (browsers need a user tap first).
import { CODE } from '#shared/morse';

let ctx: AudioContext | undefined;
export const audioContext = () => (ctx ??= new AudioContext());
/** Call from a click/tap/keypress handler so later sounds are allowed. */
export const unlockAudio = () => void audioContext().resume();

let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;

export function sidetone(on: boolean, freq = 700) {
  const a = audioContext();
  if (on) {
    osc?.stop();
    osc = new OscillatorNode(a, { type: 'sine', frequency: freq });
    gain = new GainNode(a, { gain: 0.25 });
    osc.connect(gain).connect(a.destination);
    osc.start();
  } else if (osc && gain) {
    gain.gain.setTargetAtTime(0, a.currentTime, 0.01); // fade out: no click
    osc.stop(a.currentTime + 0.05);
    osc = null;
  }
}

/** Plays `word` in Morse; returns how long that takes in seconds. */
export function playMorse(word: string, { unit = 0.09, freq = 650, vol = 0.2 } = {}) {
  const a = audioContext();
  const g = new GainNode(a, { gain: 0 });
  g.connect(a.destination);
  let t = a.currentTime + 0.1;
  for (const ch of word.toUpperCase()) {
    for (const s of CODE[ch] ?? '') {
      const o = new OscillatorNode(a, { frequency: freq });
      o.connect(g);
      g.gain.setValueAtTime(vol, t);
      o.start(t);
      o.stop((t += unit * (s === '.' ? 1 : 3)));
      g.gain.setValueAtTime(0, t);
      t += unit;
    }
    t += unit * 2;
  }
  return t - a.currentTime;
}
