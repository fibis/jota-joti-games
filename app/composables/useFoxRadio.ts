// Fox-hunt receiver: plays "MO" like a real ARDF transmitter; louder, higher and faster as you get closer.
import { playMorse } from '~/utils/morseAudio';

/** `signal` is read before every beep, so the radio follows the latest meter. Stops with the calling component. */
export function useFoxRadio(signal: () => number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const loop = () => {
    const m = signal();
    const dur = m > 0.03 ? playMorse('MO', { unit: 0.06, freq: 420 + 700 * m, vol: 0.04 + 0.4 * m }) : 0.3;
    timer = setTimeout(loop, (dur + 1.2 - m) * 1000);
  };

  const start = () => {
    if (timer === undefined) loop();
  };
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  onScopeDispose(stop);
  return { start };
}
