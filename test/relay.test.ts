import type { Message, Peer } from 'crossws';
import { describe, expect, it, vi } from 'vitest';
import { CLOSE_KICKED, CLOSE_REPLACED, ROOM_CODE } from '#shared/protocol';
import { createRelay } from '../server/utils/relay';

type Msg = Record<string, unknown>;

/** A relay with fake sockets: what each one was sent, how it was closed, its heartbeat. */
function setup() {
  let base = 'http://lan:3000';
  const relay = createRelay({ joinUrl: code => `${base}/${code}` });

  function connect(query: string) {
    let pong = () => {};
    const ws = {
      readyState: 1,
      bufferedAmount: 0,
      ping: vi.fn(),
      on: (_event: 'pong', listener: () => void) => (pong = listener),
    };
    const fake = {
      request: { url: `http://localhost:3000/ws?${query}` },
      websocket: ws,
      sent: [] as Msg[],
      closedWith: undefined as number | null | undefined, // null: closed without a code
      send(data: string) {
        this.sent.push(JSON.parse(data));
      },
      close(code?: number) {
        this.closedWith = code ?? null;
        ws.readyState = 3;
      },
      terminate: vi.fn(),
    };
    const peer = fake as unknown as Peer;
    relay.hooks.open(peer);
    return Object.assign(fake, {
      pong: () => pong(),
      say: (data: unknown) => relay.hooks.message(peer, { text: () => (typeof data === 'string' ? data : JSON.stringify(data)) } as Message),
      /** The socket's close event (the relay itself only asks sockets to close). */
      gone: () => relay.hooks.close(peer),
    });
  }
  const host = async (query = '') => {
    const h = connect(`role=host&${query}`);
    const room = await vi.waitFor(() => {
      const m = h.sent.find(m => m.t === 'room'); // async: the QR code renders first
      if (!m) throw new Error('no room yet');
      return m as { code: string; key: string; url: string; qr: string };
    });
    return { h, ...room };
  };
  const player = (code: string, id: string, name?: string) => connect(`role=player&room=${code}&id=${id}${name ? `&name=${name}` : ''}`);
  const setBase = (url: string) => (base = url);
  return { relay, connect, host, player, setBase };
}

describe('relay', () => {
  it('gives a host a room with code, key, join url and QR code', async () => {
    const { host } = setup();
    const r = await host();
    expect(r.code).toMatch(ROOM_CODE);
    expect(r.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.url).toBe(`http://lan:3000/${r.code}`);
    expect(r.qr).toContain('<svg');
  });

  it('lets a reloading host reclaim its code only with the right key and while the old host is gone', async () => {
    const { host, player } = setup();
    const first = await host();
    player(first.code, '1', 'Ann'); // keeps the room alive

    expect((await host(`room=${first.code}&key=${first.key}`)).code).not.toBe(first.code); // old host still there
    first.h.gone();
    expect((await host(`room=${first.code}&key=wrong`)).code).not.toBe(first.code);
    expect((await host(`room=${first.code}`)).code).not.toBe(first.code);

    const back = await host(`room=${first.code.toLowerCase()}&key=${first.key}`);
    expect(back.code).toBe(first.code);
    expect(back.key).toBe(first.key);
    expect(back.h.sent).toContainEqual({ t: 'join', id: '1', name: 'Ann' }); // replays the players
  });

  it('closes phones with a bad room code or id', () => {
    const { connect, player, relay } = setup();
    for (const p of [player('ABCD', 'kb-1'), player('ABCD', '1'.repeat(41)), player('AB1D', '1'), player('', '1'), connect('role=player&room=ABCD')])
      expect(p.closedWith).toBeNull();
    expect(relay.rooms.size).toBe(0);
  });

  it('tells the host who joins and leaves', async () => {
    const { host, player } = setup();
    const { h, code } = await host();
    const ann = player(code, '7', 'Ann');
    player(code, '8', 'A'.repeat(20));
    player(code, '9');
    expect(h.sent).toContainEqual({ t: 'join', id: '7', name: 'Ann' });
    expect(h.sent).toContainEqual({ t: 'join', id: '8', name: 'A'.repeat(14) });
    expect(h.sent).toContainEqual({ t: 'join', id: '9', name: 'Scout' });
    ann.gone();
    expect(h.sent.at(-1)).toEqual({ t: 'leave', id: '7' });
  });

  it('tells a phone there is no host yet, and replays it to the host that comes', async () => {
    const { host, player } = setup();
    const p = player('wxyz', '5', 'Bob');
    expect(p.sent).toEqual([{ nohost: true }]);
    const { h, code } = await host('room=WXYZ'); // a room made by a phone has no key yet
    expect(code).toBe('WXYZ');
    expect(h.sent).toContainEqual({ t: 'join', id: '5', name: 'Bob' });
  });

  it('replaces a duplicate player id, and the old socket closing does not remove the new one', async () => {
    const { host, player } = setup();
    const { h, code } = await host();
    const old = player(code, '3', 'Ann');
    const now = player(code, '3', 'Ann');
    expect(old.closedWith).toBe(CLOSE_REPLACED);
    old.gone();
    expect(h.sent).not.toContainEqual({ t: 'leave', id: '3' });
    now.say({ t: 'pick', i: 1 });
    expect(h.sent.at(-1)).toEqual({ t: 'msg', id: '3', d: { t: 'pick', i: 1 } });
    h.say({ to: '3', d: { layout: 'wait' } });
    expect(now.sent).toEqual([{ layout: 'wait' }]);
    now.gone();
    expect(h.sent.at(-1)).toEqual({ t: 'leave', id: '3' });
  });

  it("routes host messages to one phone with 'to', else to all of them", async () => {
    const { host, player } = setup();
    const { h, code } = await host();
    const a = player(code, '1');
    const b = player(code, '2');
    h.say({ to: '1', d: { layout: 'key' } });
    h.say({ to: 2, d: { layout: 'stick' } }); // ids are strings: nobody
    h.say({ d: { layout: 'wait' } });
    expect(a.sent).toEqual([{ layout: 'key' }, { layout: 'wait' }]);
    expect(b.sent).toEqual([{ layout: 'wait' }]);
  });

  it('kicks a phone the host removed: closed with CLOSE_KICKED, the host hears it left', async () => {
    const { host, player } = setup();
    const { h, code } = await host();
    const a = player(code, '1', 'Anna'), b = player(code, '2', 'Ben');
    h.say({ kick: '1' });
    expect(a.closedWith).toBe(CLOSE_KICKED);
    expect(b.closedWith).toBeUndefined();
    a.gone();
    expect(h.sent.at(-1)).toEqual({ t: 'leave', id: '1' });
    h.say({ kick: 'nobody' }); // unknown id: nothing happens
    expect(b.closedWith).toBeUndefined();
  });

  it('ignores garbage', async () => {
    const { host, player } = setup();
    const { h, code } = await host();
    const p = player(code, '1');
    const before = h.sent.length;
    p.say('{not json');
    p.say('null');
    expect(h.sent.length).toBe(before);
    expect(() => h.say('{not json')).not.toThrow();
  });

  it('drops messages for sockets that are not open or stopped reading', async () => {
    const { host, player } = setup();
    const { h, code } = await host();
    const p = player(code, '1');
    p.websocket.bufferedAmount = 1e6;
    h.say({ d: { layout: 'wait' } });
    p.websocket.bufferedAmount = 0;
    p.websocket.readyState = 2;
    h.say({ d: { layout: 'wait' } });
    expect(p.sent).toEqual([]);
  });

  it('prunes a room once host and phones are gone', async () => {
    const { host, player, relay } = setup();
    const { h, code } = await host();
    const p = player(code, '1');
    h.gone();
    expect(relay.rooms.has(code)).toBe(true);
    p.gone();
    expect(relay.rooms.size).toBe(0);
  });

  it('refreshes the QR codes on screen when the join url changes', async () => {
    const { host, relay, setBase } = setup();
    const { h, code } = await host();
    setBase('https://x.trycloudflare.com');
    relay.refresh();
    await vi.waitFor(() => expect(h.sent.at(-1)).toMatchObject({ t: 'room', code, url: `https://x.trycloudflare.com/${code}` }));
  });

  it('pings every socket and terminates the ones that stopped answering', async () => {
    const { host, player, relay } = setup();
    const { h, code } = await host();
    const p = player(code, '1');
    relay.heartbeat();
    expect(h.websocket.ping).toHaveBeenCalledTimes(1);
    h.pong();
    relay.heartbeat();
    expect(h.terminate).not.toHaveBeenCalled();
    expect(p.terminate).toHaveBeenCalledTimes(1);
    expect(h.websocket.ping).toHaveBeenCalledTimes(2);
  });
});
