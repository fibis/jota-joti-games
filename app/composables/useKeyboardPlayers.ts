// No phone? Up to two scouts play on the big screen's keyboard. They send the same messages a phone
// would, straight to the game (no parseInput: this input is ours, not a phone's).
import { MorseKey } from '#shared/morse';
import type { PlayerInput } from '#shared/protocol';
import type { HostSession } from '~/composables/useHostSession';
import { sidetone } from '~/utils/morseAudio';

const KEYBOARDS = [
  { id: 'kb-wasd', name: 'WASD ⌨', join: 'Space', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', act: 'Space', picks: ['Digit1', 'Digit2', 'Digit3', 'Digit4'] },
  { id: 'kb-arrows', name: '↑←↓→ ⌨', join: 'Enter', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', act: 'Enter', picks: ['Digit7', 'Digit8', 'Digit9', 'Digit0'] },
];
const ALL_KEYS = new Set(KEYBOARDS.flatMap(k => [k.up, k.down, k.left, k.right, k.act, ...k.picks]));
const DIRS = new Set(KEYBOARDS.flatMap(k => [k.up, k.down, k.left, k.right]));
/** The digit on each pick key per keyboard player ('kb-wasd' → '1234'), for answer chips on the big screen. */
export const PICK_KEYS: Readonly<Record<string, string>> = Object.fromEntries(KEYBOARDS.map(k => [k.id, k.picks.map(c => c.slice(-1)).join('')]));

export function useKeyboardPlayers({ players, intro, run, join, toGame: send }: Pick<HostSession, 'players' | 'intro' | 'run' | 'join' | 'toGame'>) {
  const held = new Set<string>();
  const toGame = (id: string, msg: PlayerInput) => {
    const p = players.get(id);
    if (p) send(p, msg);
  };
  const keyboards = KEYBOARDS.map(k => ({
    ...k,
    morse: new MorseKey(c => toGame(k.id, { t: 'letter', c }), s => toGame(k.id, { t: 'sym', s })),
  }));

  function key(e: KeyboardEvent, down: boolean) {
    if (!ALL_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat && !DIRS.has(e.code)) return; // a held direction re-sends the stick, so a controller that just appeared picks it up
    if (down) held.add(e.code);
    else held.delete(e.code);
    // A release always silences, even when the game or layout changed while the key was held.
    if (!down && keyboards.some(k => k.act === e.code)) sidetone(false);
    for (const k of keyboards) {
      const p = players.get(k.id);
      if (!run.value) { // lobby: the join key toggles this keyboard player; during a game's intro it only joins
        if (down && e.code === k.join) {
          if (!p) join(k.id, k.name, true);
          else if (!intro.value) players.delete(k.id);
        }
        continue;
      }
      if (!p) continue;
      const layout = p.ui?.layout;
      if (layout === 'stick' && [k.up, k.down, k.left, k.right].includes(e.code)) {
        let x = Number(held.has(k.right)) - Number(held.has(k.left));
        let y = Number(held.has(k.down)) - Number(held.has(k.up));
        if (x && y) {
          x *= Math.SQRT1_2;
          y *= Math.SQRT1_2;
        }
        toGame(k.id, { t: 'stick', x, y });
      }
      if (layout === 'stick' && p.ui?.button && e.code === k.act) toGame(k.id, { t: 'button', down });
      if (layout === 'key' && e.code === k.act) {
        if (down) k.morse.down();
        else k.morse.up();
        if (down) sidetone(true);
      }
      if (layout === 'choices' && down && k.picks.includes(e.code)) toGame(k.id, { t: 'pick', i: k.picks.indexOf(e.code) });
    }
  }

  const onDown = (e: KeyboardEvent) => key(e, true);
  const onUp = (e: KeyboardEvent) => key(e, false);
  onMounted(() => {
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
  });
  onUnmounted(() => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
  });
}
