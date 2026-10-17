# 📻 JOTA-JOTI Games

Party games for the scout hut: the laptop/beamer is the big screen, phones are the controllers.
No phone? Up to two players can join on the laptop keyboard.

Nuxt 4 (Vue 3, TypeScript) app with a Nitro WebSocket relay. Needs Node 22.22.3+ or 24.15+.

```sh
npm install
npm run dev                  # then open http://localhost:3000 on the big screen
npm run build && npm start   # the same, production build
```

Phones scan the QR code (same Wi-Fi); the dev server listens on the LAN too. If the wrong network address shows up:
`HOST_IP=192.168.1.20 npm start` (or `npm run dev`).

### Phones on any network (Cloudflare quick tunnel)

Guest Wi-Fi that blocks devices from seeing each other, or kids on mobile data:

```sh
sudo pacman -S cloudflared   # once; other systems: https://try.cloudflare.com
npm run build                # once per code change
npm run tunnel
```

The big screen still opens `http://localhost:3000`. After a few seconds the QR code switches to a random
`https://….trycloudflare.com` address (a new one every start). It waits until that address actually resolves,
because phones that look it up too early can get stuck on "not found" for minutes.

- Quick tunnels are Cloudflare's free try-out service: no account, no uptime guarantee. For a fixed address,
  run a named tunnel on your own domain and start with `PUBLIC_URL=https://games.example.org npm start`.
- Anyone with the link and room code can join. Keep the QR code in the room; don't show the lobby in a public JOTI stream.
- Expect roughly 100 ms extra delay; Morse timing happens on the phone, so only Fox Hunt steering notices.
- A quick tunnel allows 200 open connections, so roughly 190 phones max. Keep the laptop awake: the tunnel dies with it.

### Hosted on bunny.net Magic Containers

Live at https://games.jota-joti.online. Every push to `main` runs the tests and the type check, then builds
`ghcr.io/fibis/jota-joti-games:<sha>` and rolls it out to the Magic Containers app `jota-joti-games`
(`.github/workflows/docker.yml`; repo variable `APP_ID`, secret `BUNNYNET_API_KEY`).
Locally: `docker build -t jota-joti-games . && docker run -p 3000:3000 jota-joti-games`.

The app runs **one instance in one region (DE)** on purpose: rooms live in memory, so the big screen and the phones
must all reach the same container. Env `PUBLIC_URL` sets the address in the QR code; WebSockets are on in the pull zone.

**EN / DE** switch in the lobby (defaults to the browser language); phones follow the big screen.
**✕ End game** in the bar above every game (click twice), or Esc.
`npm test` runs the unit tests (relay, Morse key, input validation, quiz and word lists), `npm run typecheck` the TypeScript check.

| Game | Controller | |
|---|---|---|
| 🦊 Fox Hunt | joystick + radio receiver | ARDF: a hidden transmitter beeps “MO”; louder/faster/higher near the fox. First to 5. |
| 📡 Morse Master | telegraph key | Key the word in Morse. Hints for the first 3 rounds. Words (en + de) in `app/games/morse-master/words.ts`. |
| ⚜️ Scout Quiz | 4 buttons + the question | Radio alphabet, Q-codes, knots, scouting history. Questions (en + de) in `app/games/quiz/questions.ts`. |
| 🔤 Call Sign Speller | 4 buttons | Spell a station's call sign in the radio alphabet, character by character. Longer call signs each round. |
| 🔦 Signal Lamp | 4 buttons | Read a word flashed by the lamp in Morse. Sound in the first rounds, then light only, faster each round. |
| 🛰️ ISS Pass | joystick + radio receiver | Turn your antenna to track the ISS (and from pass 3 the AO-91 cubesat). Hold the signal to log a QSO. |
| 🪵 Pioneering Tower | joystick + button | Two teams take turns dropping lashed poles and frames (Matter physics). Tallest tower wins. |
| 🤝 Find Your QSO Partner | number pad | Walk around the room: find the scout with your partner's call sign, swap codes, log the QSO. Phones only. |
| 🚩 Capture the Flag | joystick + dash button | Two teams, two flags, two jails. Tag intruders, free your team mates, carry the enemy flag home. First to 3. |

## How it works

The Nitro server (`server/routes/ws.ts` + `server/utils/relay.ts`) only relays messages between the big screen and
the phones of a room. The big screen (`app/pages/index.vue`) runs the games; phones (`app/pages/[code].vue`, the short
join link `/ABCD`) show whatever controller the big screen asks for: `wait`, `stick` (+ optional `meter` and action
`button`), `key`, `choices` or `keypad`. All message types live in `shared/protocol.ts`; phone input goes through `parseInput()` before a game sees it.

```
app/
  pages/          index.vue (big screen), [code].vue (phone)
  components/     lobby, stage and controller pieces
  composables/    useGame.ts: the contract between the stage and a game
  games/          index.ts (lobby cards), types.ts, one folder per game,
                  kit/ (shared helpers: random, teams, call signs, Phaser setup + player tokens)
  utils/          morseAudio.ts
server/           WebSocket relay, rooms, QR code
shared/           protocol.ts, morse.ts, choices.ts (big screen and phones)
test/             vitest
```

## Adding a game

Add a folder `app/games/<id>/` with a component, plus an entry in `GAMES` in `app/games/index.ts`
(`id`, `emoji`, `info` for en + de, `load: () => import('./<id>/MyGame.vue')`):

```vue
<script setup lang="ts">
import { useGame } from '~/composables/useGame';

// ctx: { lang: 'en' | 'de', players, send(player, ui), end(scores) }
const ctx = useGame({
  input(player, msg) {}, // { t: 'stick', x, y } | { t: 'button', down } | { t: 'letter', c } | { t: 'sym', s }
                         // | { t: 'pick', i } | { t: 'code', code }
                         // | { t: 'presence' } when a player drops or comes back (player.online)
  join(player) {},       // someone joined mid-game
});
for (const player of ctx.players) ctx.send(player, { layout: 'choices', round: 1, options: ['A', 'B', 'C', 'D'], text: 'Pick!' });
// when done: ctx.end([[player, points], ...])

onUnmounted(() => {}); // clear timers, destroy Phaser: ending a game unmounts the component
</script>
```

Use Phaser 4 for anything that moves (`usePhaserGame()` and `addPlayerToken()` in `app/games/kit/phaser.ts`), a plain
Vue template for quiz-style screens (`<GameScoreBoard>` for the side panel). Players are plain objects: key `Map`s by
them. Give the component's root element its own class and `height: 100%`.
