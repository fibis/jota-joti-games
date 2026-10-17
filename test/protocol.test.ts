import { describe, expect, it } from 'vitest';
import { isLang, parseInput, ROOM_CODE } from '#shared/protocol';

describe('parseInput', () => {
  it('clamps the stick and turns garbage into 0', () => {
    expect(parseInput({ t: 'stick', x: 5, y: -5 })).toEqual({ t: 'stick', x: 1, y: -1 });
    expect(parseInput({ t: 'stick', x: 0.25, y: '-0.5' })).toEqual({ t: 'stick', x: 0.25, y: -0.5 });
    expect(parseInput({ t: 'stick', x: 'abc', y: NaN })).toEqual({ t: 'stick', x: 0, y: 0 });
    expect(parseInput({ t: 'stick' })).toEqual({ t: 'stick', x: 0, y: 0 });
  });

  it('takes one uppercased letter', () => {
    expect(parseInput({ t: 'letter', c: 'a' })).toEqual({ t: 'letter', c: 'A' });
    expect(parseInput({ t: 'letter', c: 'xyz' })).toEqual({ t: 'letter', c: 'X' });
    expect(parseInput({ t: 'letter', c: '' })).toBeNull();
    expect(parseInput({ t: 'letter' })).toBeNull();
  });

  it('keeps only dits and dahs, at most 8', () => {
    expect(parseInput({ t: 'sym', s: '.-<b>x</b>.' })).toEqual({ t: 'sym', s: '.-.' });
    expect(parseInput({ t: 'sym', s: '..........' })).toEqual({ t: 'sym', s: '........' });
    expect(parseInput({ t: 'sym' })).toEqual({ t: 'sym', s: '' });
  });

  it('only picks 0..3', () => {
    for (const i of [0, 1, 2, 3, '2']) expect(parseInput({ t: 'pick', i })).toEqual({ t: 'pick', i: Number(i) });
    for (const i of [-1, 4, 1.5, NaN, 'x', undefined]) expect(parseInput({ t: 'pick', i })).toBeNull();
  });

  it('rejects unknown messages and garbage', () => {
    for (const d of [null, undefined, 42, 'stick', [], {}, { t: 'presence' }, { t: 'hack' }]) expect(parseInput(d)).toBeNull();
  });
});

it('isLang', () => {
  expect(isLang('en')).toBe(true);
  expect(isLang('de')).toBe(true);
  for (const v of ['fr', 'EN', '', null, 1]) expect(isLang(v)).toBe(false);
});

it('ROOM_CODE', () => {
  expect(ROOM_CODE.test('ABCD')).toBe(true);
  for (const c of ['abcd', 'ABC', 'ABCDE', 'AB1D', ' ABCD']) expect(ROOM_CODE.test(c)).toBe(false);
});
