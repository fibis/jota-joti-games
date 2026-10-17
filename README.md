# 📻 JOTA-JOTI Games

Party games for the scout hut: the laptop/beamer is the big screen, phones are the controllers.
No phone? Up to two players can join on the laptop keyboard.

```sh
npm install
npm start          # then open http://localhost:3000 on the big screen
```

Phones scan the QR code (same Wi-Fi). If the wrong network address shows up: `HOST_IP=192.168.1.20 npm start`.

### Phones on any network (Cloudflare quick tunnel)

Guest Wi-Fi that blocks devices from seeing each other, or kids on mobile data:

```sh
sudo pacman -S cloudflared   # once; other systems: https://try.cloudflare.com
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

Every push to `main` builds `ghcr.io/fibis/jota-joti-games:latest` (`.github/workflows/docker.yml`).
Locally: `docker build -t jota-joti-games . && docker run -p 3000:3000 jota-joti-games`.

In Magic Containers: image `ghcr.io/fibis/jota-joti-games:latest` (make the GHCR package public or add the
registry), container port `3000`, CDN endpoint, and env `PUBLIC_URL=https://<your endpoint hostname>` so the QR code
points there. Run **one region with one instance**: rooms live in memory, so the big screen and the phones must all reach
the same container.

**EN / DE** switch in the lobby (defaults to the browser language); phones follow the big screen.
**✕ End game** in the bar above every game (click twice), or Esc. `npm test` runs the self-check.

| Game | Controller | |
|---|---|---|
| 🦊 Fox Hunt | joystick + radio receiver | ARDF: a hidden transmitter beeps “MO”; louder/faster/higher near the fox. First to 5. |
| 📡 Morse Master | telegraph key | Key the word in Morse. Hints for the first 3 rounds. |
| ⚜️ Scout Quiz | 4 buttons + the question | Radio alphabet, Q-codes, knots, scouting history. Questions (en + de) in `public/games/quiz.js`. |

## How it works

`server.js` only relays messages. The big screen (`public/index.html`) runs the games; phones (`public/play.html`)
show whatever controller the big screen asks for: `wait`, `stick` (+ optional `meter`), `key` or `choices`.

## Adding a game

Add `public/games/<name>.js` and a card in `GAMES` in `index.html`:

```js
export function start(api) { // api: { stage, players, send(player, ui), esc, end(scores), lang: 'en' | 'de' }
  api.send(player, { layout: 'choices', round: 1, options: ['A', 'B', 'C', 'D'], text: 'Pick!' });
  return {
    input(player, msg) {},  // { t: 'stick', x, y } | { t: 'letter', c } | { t: 'sym', s } | { t: 'pick', i }
                            // | { t: 'presence' } when a player drops or comes back (player.online)
    join(player) {},        // someone joined mid-game
    stop() {},              // clear timers
  };                        // call api.end([[player, points], ...]) when done
}
```

Use Phaser 4 (global `Phaser`) for anything that moves; plain DOM for quiz-style screens.
