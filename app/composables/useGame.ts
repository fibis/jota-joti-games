import type { InjectionKey } from 'vue';
import type { GameContext, GameHandlers, GameRun } from '~/games/types';

const RUN: InjectionKey<GameRun> = Symbol('game-run');

/** Stage side: hand the running game its context. */
export const provideGameRun = (run: GameRun) => provide(RUN, run);

/**
 * Game side: register how this game reacts to input and latecomers, get its context back.
 * Timers and Phaser instances belong in onUnmounted: ending a game unmounts its component.
 */
export function useGame(handlers: GameHandlers): GameContext {
  const run = inject(RUN);
  if (!run) throw new Error('useGame() only works inside the game stage');
  Object.assign(run.handlers, handlers);
  return run.ctx;
}
