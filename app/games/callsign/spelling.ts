// The four answer buttons for one call-sign character: the right radio word plus the wrong ones scouts really say.
import type { Lang } from '#shared/protocol';
import { DIGITS, PHONETIC, spellChar } from '~/games/kit/callsigns';
import { shuffle } from '~/games/kit/random';

/** The WW2 Able–Baker alphabet. Its Charlie, Mike, Victor and X-ray are NATO words too: left out. */
export const ABLE_BAKER: Readonly<Record<string, string>> = {
  A: 'Able', B: 'Baker', D: 'Dog', E: 'Easy', F: 'Fox', G: 'George', H: 'How', I: 'Item', J: 'Jig', K: 'King', L: 'Love',
  N: 'Nan', O: 'Oboe', P: 'Peter', Q: 'Queen', R: 'Roger', S: 'Sugar', T: 'Tare', U: 'Uncle', W: 'William', Y: 'Yoke', Z: 'Zebra',
};

/** The classic German DIN 5009 alphabet. Its Viktor sounds exactly like NATO's Victor: left out. */
export const DIN_5009: Readonly<Record<string, string>> = {
  A: 'Anton', B: 'Berta', C: 'Cäsar', D: 'Dora', E: 'Emil', F: 'Friedrich', G: 'Gustav', H: 'Heinrich', I: 'Ida',
  J: 'Julius', K: 'Kaufmann', L: 'Ludwig', M: 'Martha', N: 'Nordpol', O: 'Otto', P: 'Paula', Q: 'Quelle', R: 'Richard',
  S: 'Samuel', T: 'Theodor', U: 'Ulrich', W: 'Wilhelm', X: 'Xanthippe', Y: 'Ypsilon', Z: 'Zacharias',
};

/** Digit words people say off the radio. German says "Zwo" on air so it can't be mistaken for "drei". */
const DIGIT_TRAP: Partial<Record<Lang, Readonly<Record<string, string>>>> = { de: { 2: 'Zwei' } };

/** Letter names that sound alike on a crackly radio (the reason the alphabet exists). Their NATO words top up. */
const SOUND_ALIKE = ['BCDEGPTVZ', 'AHJK', 'FLMNSX', 'IY', 'QUW'];
const soundAlike = (c: string) => [...(SOUND_ALIKE.find(g => g.includes(c)) ?? '')].map(l => PHONETIC[l]);

/** Four shuffled words for `char`, exactly one of them right (spellChar). */
export function options(char: string, lang: Lang): string[] {
  const right = spellChar(char, lang);
  const others = /\d/.test(char)
    ? [DIGIT_TRAP[lang]?.[char], ...shuffle(DIGITS[lang])]
    : [ABLE_BAKER[char], DIN_5009[char], ...shuffle(soundAlike(char)), ...shuffle(Object.values(PHONETIC))];
  const wrong = [...new Set(others)].filter((w): w is string => w !== undefined && w !== right).slice(0, 3);
  return shuffle([right, ...wrong]);
}

/** The call sign with the current character marked: "P A [3] X Y Z". */
export const marked = (call: string, at: number) => [...call].map((c, i) => (i === at ? `[${c}]` : c)).join(' ');
