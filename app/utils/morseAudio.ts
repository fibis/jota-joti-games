// Sidetone for the key, and playback of whole words. One shared AudioContext (browsers need a user tap first).
import { morseTimeline } from '#shared/morse';

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

/** playMorse() starts the first tone this many seconds after the call (sync a lamp to it). */
export const MORSE_LEAD_S = 0.1;

/** Plays `word` in Morse; returns how long that takes in seconds. Aborting `signal` silences it at once. */
export function playMorse(word: string, { unit = 0.09, freq = 650, vol = 0.2, signal }: { unit?: number; freq?: number; vol?: number; signal?: AbortSignal } = {}) {
  const a = audioContext();
  const g = new GainNode(a, { gain: 0 });
  g.connect(a.destination);
  signal?.addEventListener('abort', () => g.disconnect(), { once: true });
  const start = a.currentTime + MORSE_LEAD_S;
  const { tones, length } = morseTimeline(word);
  for (const [at, len] of tones) {
    const o = new OscillatorNode(a, { frequency: freq });
    o.connect(g);
    g.gain.setValueAtTime(vol, start + at * unit);
    o.start(start + at * unit);
    o.stop(start + (at + len) * unit);
    g.gain.setValueAtTime(0, start + (at + len) * unit);
  }
  return MORSE_LEAD_S + length * unit;
}
