import { describe, expect, it } from 'vitest';
import { morseTimeline } from '#shared/morse';
import { DIGITS, PHONETIC, spell, uniqueCallSigns } from '~/games/kit/callsigns';
import { shuffle } from '~/games/kit/random';
import { joinTeam, makeTeams } from '~/games/kit/teams';
import type { Player } from '~/games/types';

const player = (id: string): Player => ({ id, name: id, avatar: '🐻', color: '#fff', online: true });

describe('game kit', () => {
  it('shuffle keeps every element', () => {
    const a = Array.from({ length: 50 }, (_, i) => i);
    expect(shuffle(a).sort((x, y) => x - y)).toEqual(a);
  });

  it('call signs are well-formed, unique and spellable', () => {
    const calls = uniqueCallSigns(40, 6);
    expect(new Set(calls.map(c => c.call)).size).toBe(40);
    for (const { call, origin } of calls) {
      expect(call).toMatch(/^[A-Z]{1,3}\d[A-Z]{1,3}$/);
      expect(call.startsWith(origin.prefix)).toBe(true);
    }
    expect(spell('PA3XYZ', 'en')).toEqual(['Papa', 'Alfa', 'Three', 'X-ray', 'Yankee', 'Zulu']);
    expect(spell('DL2A', 'de')).toEqual(['Delta', 'Lima', 'Zwo', 'Alfa']);
    expect(Object.keys(PHONETIC)).toHaveLength(26);
    expect(DIGITS.en).toHaveLength(10);
    expect(DIGITS.de).toHaveLength(10);
  });

  it('teams split evenly and latecomers fill the smaller team', () => {
    const teams = makeTeams(['1', '2', '3', '4', '5'].map(player), 'en');
    expect(teams.map(t => t.players.length).sort()).toEqual([2, 3]);
    expect(joinTeam(teams, player('6')).players).toHaveLength(3);
    expect(teams.map(t => t.players.length)).toEqual([3, 3]);
  });

  it('morse timeline: dit 1, dah 3, 1 between symbols, 3 between letters', () => {
    expect(morseTimeline('E')).toEqual({ tones: [[0, 1]], length: 4 });
    const sos = morseTimeline('SOS');
    expect(sos.tones.map(t => t[1])).toEqual([1, 1, 1, 3, 3, 3, 1, 1, 1]);
    expect(sos.tones[3]![0]).toBe(8); // S = 0,2,4 (+1 +2 letter gap) -> O starts at 8
  });
});
