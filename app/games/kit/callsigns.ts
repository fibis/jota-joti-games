// Amateur radio call signs and the radio alphabet, for the games that spell or swap call signs.
import type { Lang } from '#shared/protocol';
import { pick } from './random';

/** The international (NATO/ITU) spelling alphabet: the same words in every language. */
export const PHONETIC: Readonly<Record<string, string>> = {
  A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India',
  J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo',
  S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
};

/** Figures as radio amateurs say them on air (German uses "Zwo" so it can't be mistaken for "drei"). */
export const DIGITS: Record<Lang, readonly string[]> = {
  en: ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'],
  de: ['Null', 'Eins', 'Zwo', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun'],
};

/** The spoken word for one call-sign character. */
export const spellChar = (c: string, lang: Lang) => (/\d/.test(c) ? DIGITS[lang][Number(c)]! : PHONETIC[c] ?? c);
/** "PA3XYZ" → ['Papa', 'Alfa', 'Three', 'X-ray', 'Yankee', 'Zulu'] */
export const spell = (call: string, lang: Lang) => [...call].map(c => spellChar(c, lang));

export interface Prefix {
  /** Prefix incl. its digit when the country's prefix has one (HB9). */
  readonly prefix: string;
  readonly flag: string;
  readonly country: Record<Lang, string>;
}

export const PREFIXES: readonly Prefix[] = [
  { prefix: 'DL', flag: '🇩🇪', country: { en: 'Germany', de: 'Deutschland' } },
  { prefix: 'DK', flag: '🇩🇪', country: { en: 'Germany', de: 'Deutschland' } },
  { prefix: 'PA', flag: '🇳🇱', country: { en: 'Netherlands', de: 'Niederlande' } },
  { prefix: 'ON', flag: '🇧🇪', country: { en: 'Belgium', de: 'Belgien' } },
  { prefix: 'OE', flag: '🇦🇹', country: { en: 'Austria', de: 'Österreich' } },
  { prefix: 'HB9', flag: '🇨🇭', country: { en: 'Switzerland', de: 'Schweiz' } },
  { prefix: 'F', flag: '🇫🇷', country: { en: 'France', de: 'Frankreich' } },
  { prefix: 'G', flag: '🇬🇧', country: { en: 'England', de: 'England' } },
  { prefix: 'EI', flag: '🇮🇪', country: { en: 'Ireland', de: 'Irland' } },
  { prefix: 'I', flag: '🇮🇹', country: { en: 'Italy', de: 'Italien' } },
  { prefix: 'EA', flag: '🇪🇸', country: { en: 'Spain', de: 'Spanien' } },
  { prefix: 'CT', flag: '🇵🇹', country: { en: 'Portugal', de: 'Portugal' } },
  { prefix: 'SP', flag: '🇵🇱', country: { en: 'Poland', de: 'Polen' } },
  { prefix: 'OK', flag: '🇨🇿', country: { en: 'Czechia', de: 'Tschechien' } },
  { prefix: 'OZ', flag: '🇩🇰', country: { en: 'Denmark', de: 'Dänemark' } },
  { prefix: 'LA', flag: '🇳🇴', country: { en: 'Norway', de: 'Norwegen' } },
  { prefix: 'SM', flag: '🇸🇪', country: { en: 'Sweden', de: 'Schweden' } },
  { prefix: 'OH', flag: '🇫🇮', country: { en: 'Finland', de: 'Finnland' } },
  { prefix: 'K', flag: '🇺🇸', country: { en: 'USA', de: 'USA' } },
  { prefix: 'W', flag: '🇺🇸', country: { en: 'USA', de: 'USA' } },
  { prefix: 'VE', flag: '🇨🇦', country: { en: 'Canada', de: 'Kanada' } },
  { prefix: 'VK', flag: '🇦🇺', country: { en: 'Australia', de: 'Australien' } },
  { prefix: 'ZL', flag: '🇳🇿', country: { en: 'New Zealand', de: 'Neuseeland' } },
  { prefix: 'JA', flag: '🇯🇵', country: { en: 'Japan', de: 'Japan' } },
  { prefix: 'PY', flag: '🇧🇷', country: { en: 'Brazil', de: 'Brasilien' } },
  { prefix: 'LU', flag: '🇦🇷', country: { en: 'Argentina', de: 'Argentinien' } },
  { prefix: 'ZS', flag: '🇿🇦', country: { en: 'South Africa', de: 'Südafrika' } },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface CallSign {
  readonly call: string;
  readonly origin: Prefix;
}

/**
 * A made-up but well-formed call sign: prefix + region digit + 1-3 letter suffix, `length` characters
 * where the prefix allows it (4..7 makes sense). Random, so it rarely matches a real station.
 */
export function randomCallSign(length = 6): CallSign {
  const origin = pick(PREFIXES);
  const head = /\d$/.test(origin.prefix) ? origin.prefix : origin.prefix + Math.floor(Math.random() * 10);
  const suffix = Math.min(3, Math.max(1, length - head.length));
  let call = head;
  for (let i = 0; i < suffix; i++) call += pick([...LETTERS]);
  return { call, origin };
}

/** `count` call signs, all different. */
export function uniqueCallSigns(count: number, length = 6): CallSign[] {
  const out = new Map<string, CallSign>();
  while (out.size < count) {
    const c = randomCallSign(length);
    out.set(c.call, c);
  }
  return [...out.values()];
}
