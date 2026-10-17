// The contract between the big screen and a game. A game is a Vue component that calls useGame().
import type { Component } from 'vue';
import type { ControllerUi, Lang, PlayerInput } from '#shared/protocol';

export interface Player {
  readonly id: string;
  name: string;
  readonly avatar: string;
  readonly color: string;
  online: boolean;
  /** Last controller sent, replayed when the phone reconnects. */
  ui?: ControllerUi;
  /** Plays on the big screen's keyboard instead of a phone. */
  keyboard?: boolean;
}

/** What a game hears: phone input, or `presence` when a player drops or comes back (see player.online). */
export type GameInput = PlayerInput | { t: 'presence' };

export type Score = [player: Player, points: number];

export interface GameContext {
  readonly lang: Lang;
  /** Everyone in the lobby when the game started. Latecomers arrive through GameHandlers.join. */
  readonly players: readonly Player[];
  /** Sets a player's phone controller. */
  send(player: Player, ui: ControllerUi): void;
  /**
   * Back to the lobby. Pass scores to show the ranking; nothing when aborted.
   * `winners`: who gets "You won!" on their phone (a whole team); default: the top scorer.
   */
  end(scores?: Score[], winners?: readonly Player[]): void;
}

export interface GameHandlers {
  input?(player: Player, msg: GameInput): void;
  /** Someone joined mid-game. */
  join?(player: Player): void;
}

/** One running game: what the stage renders and where the host forwards input. */
export interface GameRun {
  readonly id: number;
  readonly game: GameDefinition;
  readonly component: Component;
  readonly ctx: GameContext;
  readonly handlers: GameHandlers;
}

export interface GameInfo {
  title: string;
  controller: string;
  description: string;
  /** The intro before the game: three short lines, read out loud by the leader and shown on the phones. */
  howTo: readonly [string, string, string];
}

export interface GameDefinition {
  id: string;
  emoji: string;
  info: Record<Lang, GameInfo>;
  /** Keyboard players can't take part (e.g. typing codes): the intro leaves out the keyboard help. */
  phonesOnly?: true;
  /** Lazy, so Phaser & co. only load when that game starts. */
  load: () => Promise<{ default: Component }>;
}
