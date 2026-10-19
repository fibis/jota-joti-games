// The phone's line to the big screen: one WebSocket that reconnects on its own, and the controller it was told to show.
import {
  CLOSE_KICKED,
  CLOSE_REPLACED,
  WS_PATH,
  detectLang,
  isLang,
  type ControllerUi,
  type Lang,
  type PlayerInput,
  type PlayerView,
  type ServerToPlayer,
} from '#shared/protocol';

// Texts the phone shows on its own. Everything else comes from the big screen, in its language.
const en = {
  hello: 'Join the game!',
  name: 'Your name',
  join: 'Join 📻',
  connecting: 'Connecting…',
  in: 'You’re in!',
  look: 'Look at the big screen 👀',
  reconnecting: 'reconnecting…',
  drag: 'drag anywhere here',
  signal: '📡 Signal',
  key: 'KEY',
  nohost: 'No big screen with code',
  check: 'Check the code on the big screen. The games need one: open this website on a laptop or beamer first.',
  other: 'Enter another code',
  otherTab: 'Opened in another tab',
  thisTab: 'Keep playing there, or reload this page',
  removed: 'Removed by the big screen',
  again: 'Enter your name to join again',
};
const de: typeof en = {
  hello: 'Mach mit!',
  name: 'Dein Name',
  join: 'Mitmachen 📻',
  connecting: 'Verbinde…',
  in: 'Du bist dabei!',
  look: 'Schau auf den großen Bildschirm 👀',
  reconnecting: 'verbinde neu…',
  drag: 'irgendwo hier ziehen',
  signal: '📡 Signal',
  key: 'TASTE',
  nohost: 'Kein großer Bildschirm mit Code',
  check: 'Prüf den Code auf dem großen Bildschirm. Ohne den geht’s nicht: Öffne die Website zuerst auf einem Laptop oder Beamer.',
  other: 'Anderen Code eingeben',
  otherTab: 'In einem anderen Tab geöffnet',
  thisTab: 'Spiel dort weiter oder lade diese Seite neu',
  removed: 'Vom großen Bildschirm entfernt',
  again: 'Gib deinen Namen ein, um wieder mitzumachen',
};
const TXT: Record<Lang, typeof en> = { en, de };

/** The big screen's view, or one of our own screens (those keep its language, your avatar and colour). */
export type PhoneUi = ControllerUi & Partial<Pick<PlayerView, 'avatar' | 'color' | 'lang'>> & {
  /** Our own screen: no big screen has this room code (yet). */
  nohost?: true;
};

/** Per tab: survives reloads, two tabs = two players. */
function tabId() {
  const fresh = String(Math.random()).slice(2);
  try {
    const saved = sessionStorage.getItem('jjId');
    if (saved !== null) return saved;
    sessionStorage.setItem('jjId', fresh);
  } catch {
    // storage blocked (some private modes): still plays, just as a new player after a reload
  }
  return fresh;
}

// The name this tab joined with, so a reload rejoins straight away (per tab, like the id). Storage may be blocked.
const JOINED = 'jjJoined';
function joinedAs() {
  try {
    return sessionStorage.getItem(JOINED) ?? undefined;
  } catch {
    return undefined;
  }
}
function rememberJoin(name: string | undefined) {
  try {
    if (name) sessionStorage.setItem(JOINED, name);
    else sessionStorage.removeItem(JOINED);
  } catch {}
}

export function usePlayerConnection(room: string) {
  const id = tabId();
  const ui = shallowRef<PhoneUi>({ layout: 'wait', text: TXT[detectLang()].hello });
  const status = ref('');
  /** Goes up on every (re)connect: the page keys its controller on it, so a pick lost in a blip can't leave the buttons locked. */
  const epoch = ref(0);
  /** The big screen's language once we know it, else the browser's (for the phone's own texts and <html lang>). */
  const lang = computed(() => (isLang(ui.value.lang) ? ui.value.lang : detectLang()));
  const t = computed(() => TXT[lang.value]);

  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Who we play as; undefined until the join form (or a reload of a joined tab) sets it. */
  const name = ref<string>();

  function show(next: PhoneUi) {
    const { lang, avatar, color } = ui.value;
    ui.value = { lang, avatar, color, ...next };
    if (next.buzz) navigator.vibrate?.(next.buzz);
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}${WS_PATH}?role=player&room=${room}&id=${id}&name=${encodeURIComponent(name.value ?? '')}`);
    ws = socket;
    socket.onopen = () => {
      epoch.value++;
      status.value = '';
      const { layout, text } = ui.value;
      if (layout === 'wait' && text === t.value.connecting) show({ layout: 'wait', text: t.value.in, sub: t.value.look });
    };
    socket.onmessage = (e: MessageEvent<string>) => {
      const d = JSON.parse(e.data) as ServerToPlayer; // relayed from the big screen, which runs the game
      show('nohost' in d ? { layout: 'wait', text: `${t.value.nohost} ${room}`, sub: t.value.check, nohost: true } : d);
    };
    socket.onclose = (e) => {
      if (e.code === CLOSE_REPLACED) return show({ layout: 'wait', text: t.value.otherTab, sub: t.value.thisTab }); // same player id connected elsewhere
      if (e.code === CLOSE_KICKED) { // removed on the big screen: back to the join form, no reconnect
        name.value = undefined;
        rememberJoin(undefined);
        return show({ layout: 'wait', text: t.value.removed, sub: t.value.again });
      }
      status.value = t.value.reconnecting;
      retry = setTimeout(connect, 1000 + Math.random() * 2000); // jitter: after a tunnel blip all phones would otherwise retry at once
    };
  }

  /** From the join form, after the player picked a name. */
  function join(playerName: string) {
    name.value = playerName;
    rememberJoin(playerName);
    show({ layout: 'wait', text: t.value.connecting });
    connect();
  }

  // This tab had joined before the reload: straight back in as the same player.
  const before = joinedAs();
  onMounted(() => before && join(before));

  /** Sends only while connected; returns whether it went out. */
  function send(msg: PlayerInput) {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  onScopeDispose(() => {
    clearTimeout(retry);
    if (!ws) return;
    ws.onclose = null; // leaving the page: no reconnect
    ws.close();
  });

  return { ui, status, lang, t, name, join, send, epoch };
}
