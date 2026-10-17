// Wire protocol between the big screen (host), the relay (server/routes/ws.ts) and the phones (players).
// The server only relays; the host runs every game and tells each phone which controller to show.

export const LANGS = ['en', 'de'] as const;
export type Lang = (typeof LANGS)[number];
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
/** Browser language, falling back to English. */
export const detectLang = (): Lang => (globalThis.navigator?.language?.startsWith('de') ? 'de' : 'en');

export const WS_PATH = '/ws';
export const ROOM_CODE = /^[A-Z]{4}$/;
export const NAME_MAX = 14;
/** WebSocket close code: the same player id connected again from another tab. */
export const CLOSE_REPLACED = 4000;

export type Layout = 'wait' | 'stick' | 'key' | 'choices';

/** A phone's controller, as a game describes it. */
export interface ControllerUi {
  layout: Layout;
  text?: string;
  sub?: string;
  /** Bump to force a fresh controller even when the layout stays the same (next question, next word). */
  round?: number;
  /** `stick` only: fox signal 0..1. Shows the meter and plays the beacon. */
  meter?: number;
  /** `choices` only: the four answers. */
  options?: string[];
  /** navigator.vibrate() pattern. */
  buzz?: number | number[];
}

/** What a phone receives: its controller, plus who it is and which language the big screen speaks. */
export interface PlayerView extends ControllerUi {
  avatar: string;
  color: string;
  lang: Lang;
}

/** Phone → host, after parseInput(). */
export type PlayerInput =
  | { t: 'stick'; x: number; y: number }
  | { t: 'letter'; c: string }
  | { t: 'sym'; s: string }
  | { t: 'pick'; i: number };

export type ServerToHost =
  | { t: 'room'; code: string; key: string; url: string; qr: string }
  | { t: 'join'; id: string; name: string }
  | { t: 'leave'; id: string }
  | { t: 'msg'; id: string; d: unknown }; // straight from a phone: run it through parseInput()

/** Host → server: `to` one player id, or every phone in the room when omitted. */
export interface HostToServer {
  to?: string;
  d: PlayerView;
}

export type ServerToPlayer = PlayerView | { nohost: true };

const clamp1 = (v: unknown) => Math.max(-1, Math.min(1, Number(v) || 0));

/** Phones are untrusted: validate and normalise what they send before any game sees it. */
export function parseInput(d: unknown): PlayerInput | null {
  if (!d || typeof d !== 'object') return null;
  const m = d as Record<string, unknown>;
  switch (m.t) {
    case 'stick':
      return { t: 'stick', x: clamp1(m.x), y: clamp1(m.y) };
    case 'letter': {
      const c = String(m.c ?? '').toUpperCase().slice(0, 1);
      return c ? { t: 'letter', c } : null;
    }
    case 'sym':
      return { t: 'sym', s: String(m.s ?? '').replace(/[^.-]/g, '').slice(0, 8) };
    case 'pick': {
      const i = Number(m.i);
      return Number.isInteger(i) && i >= 0 && i < 4 ? { t: 'pick', i } : null;
    }
  }
  return null;
}
