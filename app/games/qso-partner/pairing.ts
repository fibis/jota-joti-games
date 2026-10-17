// Find Your QSO Partner: who works whom, under which call sign, with which code and clue.
// Generic over the player type, so the tests can pair plain strings.
import { CODE, prettyMorse } from '#shared/morse';
import type { Lang } from '#shared/protocol';
import { randomCallSign, spell } from '~/games/kit/callsigns';
import { pick, shuffle } from '~/games/kit/random';

/** How a clue spells the partner's call sign. */
export type ClueStyle = 'call' | 'phonetic' | 'morse';
export const STYLES: readonly ClueStyle[] = ['call', 'phonetic', 'morse'];
/** Clue style per round; `mix` deals every player a random style. Its length is the number of rounds. */
export const PLAN = ['call', 'phonetic', 'morse', 'mix'] as const;
export type RoundStyle = (typeof PLAN)[number];

/** Both partners get these points, by the order the round's QSOs were confirmed in. */
export const QSO_POINTS = [15, 12, 10, 8], LATE_POINTS = 6;
// Calibration knob: 5 characters (DL3AB) are quick to shout and to read from Morse; 6 gets tough.
const CALL_LEN = 5;
// 3 digits: typing through 900 codes takes minutes, far longer than finding the partner (90 took 20 s).
export const CODE_DIGITS = 3;
const CODES = Array.from({ length: 900 }, (_, i) => String(i + 100)); // 100..999: always CODE_DIGITS digits

/** The club station on the big screen. */
export const CLUB = 'club';

export interface Station {
  readonly call: string;
  readonly code: string;
}

export interface Seat<P> extends Station {
  partner: P | typeof CLUB;
  style: ClueStyle;
  /** The partner's call sign, spelled in `style`. */
  clue: string;
  /** This player typed the partner's code: their half of the QSO. */
  logged: boolean;
  /** Points of the confirmed QSO; 0 until both halves are in (one half with the club). */
  pts: number;
}

export interface Round<P> {
  readonly index: number;
  readonly lang: Lang;
  readonly seats: Map<P, Seat<P>>;
  /** Partner of the odd one out, of latecomers and of anyone whose partner went off air. Any number of QSOs. */
  readonly club: Station;
  /** QSOs confirmed so far: the next one's place in QSO_POINTS. */
  confirmed: number;
}

/** "PA3XYZ" as the plain call, the radio alphabet or Morse. */
export function clue(call: string, style: ClueStyle, lang: Lang) {
  if (style === 'phonetic') return spell(call, lang).join(' ');
  // Narrow no-break spaces keep a letter's dits and dahs countable and on one line; em spaces between
  // letters survive white-space: pre-line (two plain spaces collapse to one) and are where a clue may wrap.
  if (style === 'morse') return [...call].map(c => [...prettyMorse(CODE[c] ?? '')].join('\u202F')).join('\u2003');
  return call;
}

const styleOf = (index: number): ClueStyle => {
  const s = PLAN[index];
  return s && s !== 'mix' ? s : pick(STYLES);
};

/** A call sign and code nobody in the round has yet. */
function freshStation(taken: readonly Station[]): Station {
  let call: string;
  do call = randomCallSign(CALL_LEN).call;
  while (taken.some(s => s.call === call));
  return { call, code: pick(CODES.filter(c => !taken.some(s => s.code === c))) };
}

export const stationOf = <P>(round: Round<P>, partner: P | typeof CLUB): Station | undefined =>
  partner === CLUB ? round.club : round.seats.get(partner);

function link<P>(round: Round<P>, seat: Seat<P>, partner: P | typeof CLUB) {
  seat.partner = partner;
  seat.clue = clue(stationOf(round, partner)?.call ?? '', seat.style, round.lang);
  seat.logged = false;
}

function addSeat<P>(round: Round<P>, p: P): Seat<P> {
  const seat: Seat<P> = { ...freshStation([round.club, ...round.seats.values()]), partner: CLUB, style: styleOf(round.index), clue: '', logged: false, pts: 0 };
  round.seats.set(p, seat);
  return seat;
}

/** Pairs everyone at random; with an odd count the one left over works the club station. */
export function makeRound<P>(players: readonly P[], lang: Lang, index: number): Round<P> {
  const c = freshStation([]);
  const club = { call: c.call.replace(/[A-Z]+$/, 'CLB'), code: c.code }; // DL3AB → DL3CLB: clearly the club
  const round: Round<P> = { index, lang, seats: new Map(), club, confirmed: 0 };
  const order = shuffle(players);
  const seats = order.map(p => addSeat(round, p));
  for (let i = 0; i < order.length; i += 2) {
    const a = seats[i]!, b = seats[i + 1];
    link(round, a, b ? order[i + 1]! : CLUB);
    if (b) link(round, b, order[i]!);
  }
  return round;
}

/** `p` (a latecomer gets a seat first) and their partner both work the club station instead of each other. */
export function toClub<P>(round: Round<P>, p: P) {
  const seat = round.seats.get(p) ?? addSeat(round, p);
  const other = seat.partner === CLUB ? undefined : round.seats.get(seat.partner);
  if (other) link(round, other, CLUB);
  link(round, seat, CLUB);
}

/** `p` typed `code`. Nothing happens (undefined) without a seat or once their half is logged. */
export function logCode<P>(round: Round<P>, p: P, code: string): 'wrong' | 'logged' | 'confirmed' | undefined {
  const seat = round.seats.get(p);
  if (!seat || seat.logged) return;
  if (code !== stationOf(round, seat.partner)?.code) return 'wrong';
  seat.logged = true;
  const other = seat.partner === CLUB ? undefined : round.seats.get(seat.partner);
  if (other && !other.logged) return 'logged';
  seat.pts = QSO_POINTS[round.confirmed++] ?? LATE_POINTS;
  if (other) other.pts = seat.pts;
  return 'confirmed';
}
