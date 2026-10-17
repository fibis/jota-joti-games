// A dumb WebSocket relay. The big screen (host) runs all game logic;
// phones only send input and render whatever controller layout the host tells them to.
// Plain crossws hooks without Nitro globals, so test/relay.test.ts can drive it with fake peers.
import { randomUUID } from 'node:crypto';
import type { Hooks, Peer } from 'crossws';
import QRCode from 'qrcode';
import { CLOSE_REPLACED, NAME_MAX, ROOM_CODE, type ServerToHost, type ServerToPlayer } from '#shared/protocol';
import { joinUrl } from './network';

interface Room {
  host: Peer | null;
  /** Proves that a reloading big screen owns the room. Set by the first host. */
  key?: string;
  players: Map<string, { peer: Peer; name: string }>;
}

/** Per socket: the heartbeat flag, plus the message/close handlers that open() installs for its role (host or phone). */
interface Conn {
  alive: boolean;
  onMessage?: (text: string) => void;
  onClose?: () => void;
}

/** On Node, peer.websocket is the `ws` socket, which does protocol-level ping/pong. */
interface NodeSocket {
  ping(): void;
  on(event: 'pong', listener: () => void): unknown;
}
const isNodeSocket = (ws: object): ws is NodeSocket =>
  'ping' in ws && typeof ws.ping === 'function' && 'on' in ws && typeof ws.on === 'function';

const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[(Math.random() * 24) | 0]).join('');

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// Never throws (stringify can blow the stack on hostile nesting) and drops messages
// for peers that stopped reading instead of buffering them until we run out of memory.
function send(peer: Peer | null, msg: unknown) {
  if (!peer) return;
  try {
    const ws = peer.websocket;
    if (ws.readyState === 1 /* OPEN */ && (ws.bufferedAmount ?? 0) < 1e6) peer.send(JSON.stringify(msg));
  } catch {}
}
const toHost = (host: Peer | null, msg: ServerToHost) => send(host, msg);

export function createRelay(opts: { joinUrl: (code: string) => string }) {
  const rooms = new Map<string, Room>(); // dropped when empty
  const conns = new Map<Peer, Conn>(); // every open socket

  function room(code: string) {
    let r = rooms.get(code);
    if (!r) rooms.set(code, (r = { host: null, players: new Map() }));
    return r;
  }
  const prune = (code: string) => {
    const r = rooms.get(code);
    if (r && !r.host && !r.players.size) rooms.delete(code);
  };

  async function sendRoom(host: Peer, code: string, key: string) {
    const url = opts.joinUrl(code);
    toHost(host, { t: 'room', code, key, url, qr: await QRCode.toString(url, { type: 'svg', margin: 1 }) });
  }

  const hooks = {
    open(peer) {
      const conn: Conn = { alive: true };
      conns.set(peer, conn);
      const ws = peer.websocket;
      if (isNodeSocket(ws))
        ws.on('pong', () => {
          conn.alive = true;
        });
      // URL.parse, not new URL: a weird request URL must not crash us
      const q = URL.parse(peer.request.url, 'http://x')?.searchParams ?? new URLSearchParams();
      let code = (q.get('room') || '').toUpperCase();

      if (q.get('role') === 'host') {
        // A reloading big screen reclaims its old code (proving it with the room key) so phones reconnect on their own.
        const old = rooms.get(code);
        if (!ROOM_CODE.test(code) || old?.host || (old?.key && old.key !== q.get('key'))) do code = newCode(); while (rooms.has(code));
        const r = room(code);
        r.host = peer;
        r.key ??= randomUUID();
        void sendRoom(peer, code, r.key);
        for (const [id, p] of r.players) toHost(peer, { t: 'join', id, name: p.name });
        conn.onMessage = text => {
          const { to, d } = (parse(text) ?? {}) as { to?: unknown; d?: unknown };
          for (const [id, p] of r.players) if (to == null || to === id) send(p.peer, d);
        };
        conn.onClose = () => {
          if (r.host === peer) r.host = null;
          prune(code);
        };
        return;
      }

      const id = q.get('id') || '';
      if (!ROOM_CODE.test(code) || !/^\d{1,40}$/.test(id)) return peer.close(); // phones use numeric ids; kb-* belong to the big screen
      const r = room(code);
      const name = (q.get('name') || 'Scout').slice(0, NAME_MAX);
      r.players.get(id)?.peer.close(CLOSE_REPLACED); // same id again: a reload (old socket is dead) or a duplicated tab (told to stop)
      r.players.set(id, { peer, name });
      if (r.host) toHost(r.host, { t: 'join', id, name });
      else send(peer, { nohost: true } satisfies ServerToPlayer);
      conn.onMessage = text => {
        const d = parse(text);
        if (d) toHost(r.host, { t: 'msg', id, d });
      };
      conn.onClose = () => {
        if (r.players.get(id)?.peer !== peer) return;
        r.players.delete(id);
        toHost(r.host, { t: 'leave', id });
        prune(code);
      };
    },
    message(peer, message) {
      conns.get(peer)?.onMessage?.(message.text());
    },
    close(peer) {
      const conn = conns.get(peer);
      conns.delete(peer);
      conn?.onClose?.();
    },
  } satisfies Partial<Hooks>;

  return {
    hooks,
    rooms, // for tests
    // Heartbeat, every 30 s: keeps idle sockets open through proxies (measured: Cloudflare drops idle ones
    // after ~2 min) and closes phones that vanished without saying goodbye. Protocol-level ping, because
    // browsers answer that themselves, even in a backgrounded tab.
    heartbeat() {
      for (const [peer, conn] of conns) {
        const ws = peer.websocket;
        if (!isNodeSocket(ws)) continue; // no ping on this runtime: never judge the socket dead
        if (!conn.alive) {
          peer.terminate();
          continue;
        }
        conn.alive = false;
        ws.ping();
      }
    },
    /** The join URL changed (tunnel up or down): refresh the QR codes already on screen. */
    refresh() {
      for (const [code, r] of rooms) if (r.host && r.key) void sendRoom(r.host, code, r.key);
    },
  };
}

/** The one relay. Rooms live in memory, so the app runs as a single instance on purpose. */
export const relay = createRelay({ joinUrl });
