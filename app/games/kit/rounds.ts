// Rules shared by the round-based games (quiz-style and Morse games).
import type { Player } from '~/games/types';

/**
 * Every online player is done. A dropped phone isn't waited for; if everyone dropped, this stays false
 * and the round's own timer runs. Check it on every input, `presence` included, so a drop can end a round.
 */
export function allOnlineDone(players: Iterable<Player>, done: (p: Player) => boolean) {
  const online = [...players].filter(p => p.online);
  return online.length > 0 && online.every(done);
}

/** 50 for being right, up to 50 more for being fast: 100 right away, 50 at the buzzer. */
export const speedPoints = (elapsedS: number, totalS: number) => 50 + Math.round(50 * Math.max(0, 1 - Math.max(0, elapsedS) / totalS));
