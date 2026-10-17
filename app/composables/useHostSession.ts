// The big screen's state: who plays, which game runs, the room, and the socket to the relay.
// The host runs every game; the server only passes messages between this page and the phones.
import { detectLang, isLang, NAME_MAX, parseInput, WS_PATH } from '#shared/protocol';
import type { ControllerUi, HostToServer, Lang, ServerToHost } from '#shared/protocol';
import type { GameContext, GameDefinition, GameInput, GameRun, Player, Score } from '~/games/types';
import { unlockAudio } from '~/utils/morseAudio';

const en = {
  games: 'Games', room: 'Room', scan: 'Scan to join', open: 'or open', wifi: 'Phones must be on the same Wi-Fi',
  scouts: 'Scouts', waiting: 'Waiting for scouts to join…', pick: 'Pick a game', last: 'Last game:',
  // Rendered as: before <kbd>space</kbd> wasd <kbd>enter</kbd> arrows
  keys: { before: 'No phone? Play on this keyboard: press', space: 'Space', wasd: '(WASD · 1-4) or', enter: 'Enter', arrows: '(arrows · 7-0) to join, again to leave.' },
  first: 'Scan the QR code or press Space first!', end: '✕ End game', sure: '✕ Click again to end', joinAt: 'Join:',
  in: 'You’re in! ⚜️', look: 'Look at the big screen 👀', won: 'You won! 🎉', played: 'Well played! Look at the big screen 👀', points: 'points',
};
const de: typeof en = {
  games: 'Spiele', room: 'Raum', scan: 'Scannen und mitspielen', open: 'oder öffne', wifi: 'Handys müssen im selben WLAN sein',
  scouts: 'Pfadfinder', waiting: 'Warte auf Pfadfinder…', pick: 'Spiel wählen', last: 'Letztes Spiel:',
  keys: { before: 'Kein Handy? Spiel an dieser Tastatur: drück', space: 'Leertaste', wasd: '(WASD · 1-4) oder', enter: 'Enter', arrows: '(Pfeiltasten · 7-0) zum Mitmachen, nochmal zum Aussteigen.' },
  first: 'Erst den QR-Code scannen oder die Leertaste drücken!', end: '✕ Spiel beenden', sure: '✕ Nochmal klicken zum Beenden', joinAt: 'Mitspielen:',
  in: 'Du bist dabei! ⚜️', look: 'Schau auf den großen Bildschirm 👀', won: 'Gewonnen! 🎉', played: 'Gut gespielt! Schau auf den großen Bildschirm 👀', points: 'Punkte',
};
const TXT: Record<Lang, typeof en> = { en, de };
export type HostText = typeof en;

// Patrol animals as avatars (🦊 is taken by the fox).
const AVATARS = ['🐻', '🦉', '🐺', '🦌', '🐿️', '🦔', '🐸', '🦅', '🦡', '🐗', '🦫', '🐝', '🐢', '🦆', '🐞', '🐧'];
const COLORS = ['#ff9f1c', '#2ec4b6', '#ff5a5f', '#b388ff', '#4cc9f0', '#f9c74f', '#90be6d', '#f15bb5', '#fefae0', '#ff7b39', '#06d6a0', '#5e9bff'];

export const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;

// Storage can throw (blocked in some private modes): then a reload just gets a new room / the browser language.
function load(store: () => Storage, key: string) {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function save(store: () => Storage, key: string, value: string) {
  try {
    store().setItem(key, value);
  } catch {}
}

function savedLang(): Lang | undefined {
  const l = load(() => localStorage, 'jjLang');
  return isLang(l) ? l : undefined;
}

export function useHostSession() {
  // Deep reactive so the chips follow name/online. Games get the plain objects behind it (toGame,
  // ctx.players): they key Maps by player, and a reactive Map stores new keys raw, so handing them
  // proxies would split one scout into two keys.
  const players: Map<string, Player> = reactive(new Map());
  const run = shallowRef<GameRun | null>(null);
  const room = ref({ code: '', url: '', tunnel: false, qr: '' }); // url: the join link without scheme
  const lastRanked = shallowRef<Score[] | null>(null);
  const lang = ref<Lang>(savedLang() ?? detectLang());
  const t = computed(() => TXT[lang.value]);
  const lobbyUi = (): ControllerUi => ({ layout: 'wait', text: t.value.in, sub: t.value.look });
  let runs = 0;

  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function connect() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const code = load(() => sessionStorage, 'jjRoom') ?? '', key = load(() => sessionStorage, 'jjKey') ?? '';
    ws = new WebSocket(`${scheme}://${location.host}${WS_PATH}?role=host&room=${code}&key=${key}`);
    // After a server restart only phones that really come back get a 'join'; everyone else is gone.
    // (No game notification here: the server replays live phones within milliseconds, so a blip must not end a round.)
    ws.onopen = () => {
      for (const p of players.values()) if (!p.keyboard) p.online = false;
    };
    ws.onmessage = e => receive(JSON.parse(String(e.data)) as ServerToHost);
    ws.onclose = () => {
      if (!closed) retry = setTimeout(connect, 1000);
    };
  }
  onMounted(connect);
  onUnmounted(() => {
    closed = true;
    clearTimeout(retry);
    ws?.close();
  });

  function receive(m: ServerToHost) {
    switch (m.t) {
      case 'room':
        save(() => sessionStorage, 'jjRoom', m.code);
        save(() => sessionStorage, 'jjKey', m.key);
        room.value = { code: m.code, url: m.url.replace(/^https?:\/\//, ''), tunnel: m.url.startsWith('https:'), qr: m.qr };
        break;
      case 'join':
        join(m.id, m.name);
        break;
      case 'leave': {
        const p = players.get(m.id);
        if (p) presence(p, false);
        break;
      }
      case 'msg': {
        const p = players.get(m.id);
        const d = parseInput(m.d);
        if (p && d) toGame(p, d);
      }
    }
  }

  function join(id: string, name: string, keyboard = false): Player {
    const known = players.get(id);
    const p: Player = known ?? reactive({ id, name, avatar: unused(AVATARS, 'avatar'), color: unused(COLORS, 'color'), online: true, keyboard });
    if (!known) players.set(id, p);
    p.name = name.slice(0, NAME_MAX);
    presence(p, true);
    if (!known && run.value) run.value.handlers.join?.(toRaw(p));
    else send(p, p.ui ?? lobbyUi()); // reconnecting phones get their last controller back
    return p;
  }

  const toGame = (p: Player, msg: GameInput) => run.value?.handlers.input?.(toRaw(p), msg);

  // Games hear about comings and goings: a dropped scout stops running, a round can end without them.
  function presence(p: Player, online: boolean) {
    p.online = online;
    toGame(p, { t: 'presence' });
  }

  // First avatar/colour nobody has (keyboard players can leave, so counting players would hand out duplicates).
  function unused(list: readonly string[], key: 'avatar' | 'color') {
    return list.find(v => ![...players.values()].some(p => p[key] === v)) ?? list[players.size % list.length]!;
  }

  // Games call this to set a player's controller. Keyboard players just remember it.
  function send(p: Player, ui: ControllerUi) {
    p.ui = ui;
    if (!p.keyboard && ws?.readyState === WebSocket.OPEN) {
      const msg: HostToServer = { to: p.id, d: { ...ui, avatar: p.avatar, color: p.color, lang: lang.value } };
      ws.send(JSON.stringify(msg));
    }
  }

  // Phones follow the big screen's language (the switch only shows in the lobby).
  watch(lang, l => {
    save(() => localStorage, 'jjLang', l);
    if (!run.value) for (const p of players.values()) send(p, lobbyUi());
  });

  async function startGame(game: GameDefinition) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); // so Space/Enter can't re-click the card
    unlockAudio();
    const id = ++runs;
    // A redeploy renames the game chunks this page links to. Reloading keeps the room (sessionStorage) and the phones.
    const mod = await game.load().catch(() => null);
    if (!mod) return location.reload();
    if (id !== runs) return; // clicked another card while this one loaded: the last click wins
    const ctx: GameContext = {
      lang: lang.value,
      players: [...players.values()].map(p => toRaw(p)),
      send,
      end: scores => {
        if (run.value?.id === id) endGame(scores); // a late timer of a finished run must not end the next one
      },
    };
    run.value = { id, game, component: markRaw(mod.default), ctx, handlers: {} };
  }

  // scores: [[player, points], ...] or nothing when aborted. Clearing the run unmounts the game.
  function endGame(scores?: Score[]) {
    run.value = null;
    for (const p of players.values()) send(p, lobbyUi());
    if (!scores) return;
    const ranked = [...scores].sort((a, b) => b[1] - a[1]);
    lastRanked.value = ranked;
    ranked.forEach(([p, s], i) => send(p, { layout: 'wait', text: `${medal(i)} ${s} ${t.value.points}`, sub: i === 0 ? t.value.won : t.value.played }));
  }

  return { players, run, room, lang, t, lastRanked, join, toGame, startGame, endGame };
}

export type HostSession = ReturnType<typeof useHostSession>;
