// Patrols for the team games: players split evenly, latecomers join the smaller team.
import type { Lang } from '#shared/protocol';
import type { Player } from '~/games/types';
import { shuffle } from './random';

export interface Team {
  readonly index: number;
  readonly name: string;
  readonly emoji: string;
  /** CSS colour, e.g. for Phaser via hex(). */
  readonly color: string;
  readonly players: Player[];
}

const PATROLS = [
  { emoji: '🐺', color: '#ff7b39', name: { en: 'Wolves', de: 'Wölfe' } },
  { emoji: '🦅', color: '#4cc9f0', name: { en: 'Eagles', de: 'Adler' } },
  { emoji: '🦌', color: '#90be6d', name: { en: 'Stags', de: 'Hirsche' } },
  { emoji: '🦉', color: '#b388ff', name: { en: 'Owls', de: 'Eulen' } },
] as const;
export const MAX_TEAMS = PATROLS.length;

/** `count` teams (2..MAX_TEAMS) with the players dealt out at random. */
export function makeTeams(players: readonly Player[], lang: Lang, count = 2): Team[] {
  const teams = PATROLS.slice(0, Math.min(Math.max(count, 2), MAX_TEAMS))
    .map((t, index): Team => ({ index, name: t.name[lang], emoji: t.emoji, color: t.color, players: [] }));
  shuffle(players).forEach((p, i) => teams[i % teams.length]!.players.push(p));
  return teams;
}

/** Puts a latecomer into the smallest team and returns it. */
export function joinTeam(teams: readonly Team[], p: Player): Team {
  const team = teams.reduce((a, b) => (b.players.length < a.players.length ? b : a));
  team.players.push(p);
  return team;
}

export const teamOf = (teams: readonly Team[], p: Player) => teams.find(t => t.players.includes(p));
