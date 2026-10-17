// The phone's line to the big screen: one WebSocket that reconnects on its own, and the controller it was told to show.
import {
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
  check: 'Check the code on the big screen',
  otherTab: 'Opened in another tab',
  thisTab: 'Keep playing there, or reload this page',
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
  check: 'Prüf den Code auf dem großen Bildschirm',
  otherTab: 'In einem anderen Tab geöffnet',
  thisTab: 'Spiel dort weiter oder lade diese Seite neu',
};
const TXT: Record<Lang, typeof en> = { en, de };

/** The big screen's view, or one of our own screens (those keep its language, your avatar and colour). */
export type PhoneUi = ControllerUi & Partial<Pick<PlayerView, 'avatar' | 'color' | 'lang'>>;

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

export function usePlayerConnection(room: string) {
  const id = tabId();
  const ui = shallowRef<PhoneUi>({ layout: 'wait', text: TXT[detectLang()].hello });
  const status = ref('');
  /** The big screen's language once we know it, else the browser's (for the phone's own texts and <html lang>). */
  const lang = computed(() => (isLang(ui.value.lang) ? ui.value.lang : detectLang()));
  const t = computed(() => TXT[lang.value]);

  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let name = '';

  function show(next: PhoneUi) {
    const { lang, avatar, color } = ui.value;
    ui.value = { lang, avatar, color, ...next };
    if (next.buzz) navigator.vibrate?.(next.buzz);
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}${WS_PATH}?role=player&room=${room}&id=${id}&name=${encodeURIComponent(name)}`);
    ws = socket;
    socket.onopen = () => {
      status.value = '';
      const { layout, text } = ui.value;
      if (layout === 'wait' && text === t.value.connecting) show({ layout: 'wait', text: t.value.in, sub: t.value.look });
    };
    socket.onmessage = (e: MessageEvent<string>) => {
      const d = JSON.parse(e.data) as ServerToPlayer; // relayed from the big screen, which runs the game
      show('nohost' in d ? { layout: 'wait', text: `${t.value.nohost} ${room}`, sub: t.value.check } : d);
    };
    socket.onclose = (e) => {
      if (e.code === CLOSE_REPLACED) return show({ layout: 'wait', text: t.value.otherTab, sub: t.value.thisTab }); // same player id connected elsewhere
      status.value = t.value.reconnecting;
      retry = setTimeout(connect, 1000 + Math.random() * 2000); // jitter: after a tunnel blip all phones would otherwise retry at once
    };
  }

  /** From the join form, after the player picked a name. */
  function join(playerName: string) {
    name = playerName;
    show({ layout: 'wait', text: t.value.connecting });
    connect();
  }

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

  return { ui, status, lang, t, join, send };
}
