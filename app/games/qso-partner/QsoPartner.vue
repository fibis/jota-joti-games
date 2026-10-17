<script setup lang="ts">
// Find Your QSO Partner: a mingling game. Every phone gets a call sign, a secret code and a clue to its
// partner's call sign. Scouts walk around calling "CQ CQ, this is …!", find their partner, show each other
// their codes and both type the other's. Both halves logged = QSO confirmed; the quicker, the more points.
import type { ControllerUi, Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import type { GameInput, Player } from '~/games/types';
import { playMorse } from '~/utils/morseAudio';
import { allOnlineDone } from '~/games/kit/rounds';
import { CLUB, CODE_DIGITS, logCode, makeRound, PLAN, stationOf, toClub } from './pairing';
import type { Round, RoundStyle, Seat } from './pairing';

const en = {
  round: 'Round',
  clue: 'Clue:',
  styles: { call: 'Call sign', phonetic: 'Radio alphabet', morse: 'Morse', mix: 'Mixed' } satisfies Record<RoundStyle, string>,
  tip: '📣 Shout your call sign: “CQ CQ, this is …!” Find the partner from your clue, show each other your 🔑 codes and both type the other’s.',
  log: 'QSO LOG',
  none: 'No contacts yet – get on the air!',
  club: '📻 Club station',
  clubTip: 'Your clue leads here? Type this code!',
  over: '⏱ Round over!',
  scores: 'SCORES',
  score: 'Score',
  station: (call: string, code: string) => `📻 ${call}  ·  🔑 ${code}`,
  find: (clue: string) => `Find: ${clue}\nThen type their code`,
  findClub: (clue: string) => `Find the club station on the big screen: ${clue}`,
  wrong: (clue: string) => `✗ Wrong code — keep looking for ${clue}`,
  partnerOff: '📴 Your partner went off air.',
  selfOff: '📴 You were off air.',
  logged: '✓ Logged!',
  waitFor: (call: string) => `Waiting for ${call} to log you…`,
  confirmed: (pts: number) => `✓ QSO confirmed! +${pts}`,
  noQso: '⏱ Time’s up — no QSO this round',
  standBy: '📻 Stand by — the next round starts soon',
};
const de: typeof en = {
  round: 'Runde',
  clue: 'Hinweis:',
  styles: { call: 'Rufzeichen', phonetic: 'Funkalphabet', morse: 'Morsecode', mix: 'Gemischt' },
  tip: '📣 Ruf dein Rufzeichen: „CQ CQ, hier ist …!“ Finde deinen Partner über den Hinweis, zeigt euch eure 🔑 Codes und tippt beide den des anderen ein.',
  log: 'LOGBUCH',
  none: 'Noch keine Verbindung – ab auf Sendung!',
  club: '📻 Clubstation',
  clubTip: 'Dein Hinweis führt hierher? Tipp diesen Code ein!',
  over: '⏱ Runde vorbei!',
  scores: 'PUNKTE',
  score: 'Punkte',
  station: (call, code) => `📻 ${call}  ·  🔑 ${code}`,
  find: clue => `Finde: ${clue}\nDann tipp den Code deines Funkpartners ein`,
  findClub: clue => `Such die Clubstation auf dem großen Bildschirm: ${clue}`,
  wrong: clue => `✗ Falscher Code – such weiter nach ${clue}`,
  partnerOff: '📴 Dein Partner ist nicht mehr auf Sendung.',
  selfOff: '📴 Du warst nicht auf Sendung.',
  logged: '✓ Geloggt!',
  waitFor: call => `Warte, bis ${call} dich loggt…`,
  confirmed: pts => `✓ QSO bestätigt! +${pts}`,
  noQso: '⏱ Zeit um – diesmal kein QSO',
  standBy: '📻 Bitte warten – gleich geht die nächste Runde los',
};
const TXT: Record<Lang, typeof en> = { en, de };

// Calibration knobs: time to find someone in a busy scout hut, the break showing the round's log,
// and how long a dropped phone may strand its partner before both work the club station instead.
const ROUND_S = 75, BREAK_S = 5, STRAND_S = 20;

/** One confirmed QSO in the log. `b` is missing for a QSO with the club station. */
interface Qso {
  a: Player;
  b?: Player;
  calls: [string, string];
  pts: number;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
// Phones only: keyboard players have no keypad, so they stay off the board (and out of the ranking).
const score = shallowReactive(new Map<Player, number>(ctx.players.filter(p => !p.keyboard).map(p => [p, 0])));
// Plain pairing data (keys are the host's plain players): triggerRef(round) after a change re-renders.
const round = shallowRef<Round<Player>>();
const log = shallowRef<Qso[]>([]);
const left = ref(0), active = ref(false);
/** Since when a player is off air; deleted when they're back. */
const offAt = new Map<Player, number>();
let rev = Date.now(); // controller `round`: unique across games, bumped so every keypad starts empty
let tick: ReturnType<typeof setInterval> | undefined;
let next = setTimeout(nextRound, 500);

const style = computed(() => round.value && PLAN[round.value.index]);
const clubOn = computed(() => [...(round.value?.seats.values() ?? [])].some(s => s.partner === CLUB));
const status = (s: Seat<Player>) => (s.pts ? 'done' : s.logged ? 'half' : 'search');

function nextRound() {
  const index = (round.value?.index ?? -1) + 1;
  if (index >= PLAN.length) return ctx.end([...score]);
  // Only phones on air now get a partner; one coming back later works the club station.
  round.value = makeRound([...score.keys()].filter(p => p.online), ctx.lang, index);
  log.value = [];
  left.value = ROUND_S;
  active.value = true;
  for (const p of score.keys()) sendPhone(p);
  tick = setInterval(second, 1000);
}

function second() {
  const r = round.value;
  if (!r) return;
  for (const [p, s] of r.seats) {
    if (s.partner === CLUB || s.pts) continue;
    const since = offAt.get(s.partner);
    if (since !== undefined && Date.now() - since >= STRAND_S * 1000) strand(r, p, s.partner);
  }
  if (--left.value <= 0) endRound();
}

function endRound() {
  active.value = false;
  clearInterval(tick);
  for (const [p, total] of score) {
    const pts = round.value?.seats.get(p)?.pts;
    ctx.send(p, { layout: 'wait', text: pts ? t.confirmed(pts) : t.noQso, sub: `${t.score}: ${total}` });
  }
  next = setTimeout(nextRound, BREAK_S * 1000);
}

/** The controller for where the player stands; `sub` replaces the usual line (wrong code, stranded). */
function sendPhone(p: Player, extra: Pick<ControllerUi, 'sub' | 'buzz'> = {}) {
  const r = round.value, seat = active.value ? r?.seats.get(p) : undefined;
  if (!r || !seat) return ctx.send(p, { layout: 'wait', text: t.standBy });
  const me = t.station(seat.call, seat.code);
  if (seat.pts) return ctx.send(p, { layout: 'wait', text: t.confirmed(seat.pts), sub: me, ...extra });
  // Still the big line: the partner may not have read this phone's code yet.
  if (seat.logged) return ctx.send(p, { layout: 'wait', text: me, sub: `${t.logged} ${t.waitFor(stationOf(r, seat.partner)?.call ?? '')}`, ...extra });
  const find = seat.partner === CLUB ? t.findClub : t.find;
  ctx.send(p, { layout: 'keypad', digits: CODE_DIGITS, round: ++rev, text: me, sub: find(seat.clue), ...extra });
}

/** `p`'s partner is off air for too long: both work the club station (the partner sees it when back). */
function strand(r: Round<Player>, p: Player, partner: Player) {
  toClub(r, p);
  for (const q of [p, partner]) sendPhone(q, { buzz: 300, sub: `${q === p ? t.partnerOff : t.selfOff}\n${t.findClub(r.seats.get(q)?.clue ?? '')}` });
  triggerRef(round);
}

/** A latecomer, or a phone that was off air when the round started: the club station is always free. */
function seatLate(r: Round<Player>, p: Player) {
  toClub(r, p);
  sendPhone(p);
  triggerRef(round);
}

function typed(r: Round<Player>, p: Player, code: string) {
  const res = logCode(r, p, code), seat = r.seats.get(p);
  if (!res || !seat) return;
  if (res === 'wrong') return sendPhone(p, { buzz: 300, sub: t.wrong(seat.clue) });
  triggerRef(round);
  if (res === 'logged') return sendPhone(p);
  const partner = seat.partner === CLUB ? undefined : seat.partner;
  for (const q of partner ? [p, partner] : [p]) {
    score.set(q, (score.get(q) ?? 0) + seat.pts);
    sendPhone(q, { buzz: [80, 60, 80] });
  }
  log.value = [{ a: p, b: partner, calls: [seat.call, stationOf(r, seat.partner)?.call ?? ''], pts: seat.pts }, ...log.value];
  playMorse('R', { unit: 0.06 }); // "R" = received: the big screen acknowledges every QSO
}

function input(p: Player, d: GameInput) {
  // Not in the game: a keyboard player, or a latecomer whose presence comes just before join() seats them.
  if (!score.has(p)) return;
  const r = round.value;
  if (d.t === 'presence') {
    if (p.online) offAt.delete(p);
    else offAt.set(p, Date.now());
    if (p.online && r && active.value && !r.seats.has(p)) seatLate(r, p);
    triggerRef(round); // the grid dims who is off air
  }
  if (!r || !active.value) return;
  if (d.t === 'code') typed(r, p, d.code);
  if (allOnlineDone(r.seats.keys(), pl => !!r.seats.get(pl)?.pts)) endRound();
}

function join(p: Player) {
  score.set(p, 0);
  const r = round.value;
  if (r && active.value) seatLate(r, p);
  else sendPhone(p);
}

onUnmounted(() => {
  clearInterval(tick);
  clearTimeout(next);
  active.value = false; // a late input can't end a round (and schedule the next one) any more
});
</script>

<template>
  <div class="qso">
    <main>
      <template v-if="round && style">
        <div class="top">
          <span>{{ t.round }} {{ round.index + 1 }} / {{ PLAN.length }}</span>
          <span class="style">{{ t.clue }} {{ t.styles[style] }}</span>
          <span class="timer" :class="{ over: !active }">{{ active ? left : t.over }}</span>
        </div>
        <p class="tip">{{ t.tip }}</p>
        <div class="mid">
          <!-- Call signs only show once confirmed: the big screen must not give away who is who. -->
          <div class="seats">
            <div
              v-for="[p, s] in round.seats"
              :key="p.id"
              class="seat"
              :class="[status(s), { off: !p.online }]"
              :style="{ '--c': p.color }"
            >
              <span class="av">{{ p.avatar }}</span><span class="name">{{ p.name }}</span>
              <span class="st">{{ s.pts ? `✓${s.call}` : s.logged ? '½' : '🔎' }}</span>
            </div>
          </div>
          <section class="log">
            <b class="muted">{{ t.log }}</b>
            <div v-for="q in log" :key="q.calls.join()" class="entry">
              <span class="ok">✓</span>
              <span>{{ q.a.avatar }}</span><b>{{ q.calls[0] }}</b><span class="muted">↔</span><span>{{ q.b?.avatar ?? '📻' }}</span><b>{{ q.calls[1] }}</b>
              <span class="pts">+{{ q.pts }}</span>
            </div>
            <span v-if="!log.length" class="muted">{{ t.none }}</span>
          </section>
          <section v-if="clubOn" class="club">
            <span>{{ t.club }}</span>
            <b class="call">{{ round.club.call }}</b>
            <b class="code">🔑 {{ round.club.code }}</b>
            <span class="muted">{{ t.clubTip }}</span>
          </section>
        </div>
        <!-- Only while decoding: the break gives its room to the log. -->
        <GameMorseSheet v-if="active && (style === 'morse' || style === 'mix')" class="sheet" digits />
      </template>
    </main>
    <GameScoreBoard :title="t.scores" :scores="score" />
  </div>
</template>

<style scoped>
.qso { height: 100%; display: grid; grid-template-columns: 1fr 18em; gap: 2vw; padding: 2vw 3vw; }
.qso main { display: flex; flex-direction: column; gap: 1.2vw; min-height: 0; }
/* Fixed thirds, and as tall as the timer: the timer turning into “Round over!” moves nothing. */
.qso .top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 1.8em; font-size: 1.3em; color: var(--muted); }
.qso .style { color: var(--fire); font-weight: 800; }
.qso .timer { justify-self: end; font: 900 1.8em/1 ui-monospace, monospace; color: var(--fire); }
.qso .timer.over { font: 800 1em system-ui, sans-serif; }
.qso .tip { margin: 0; text-align: center; text-wrap: balance; font-size: 1.3em; }
/* Seats, then the log, beside the club station. Only the log gives way: .mid never shrinks below the club
   (no min-height: 0), and contain: size keeps the log's entries from growing it. */
.qso .mid { flex: 1; display: grid; grid-template: auto 1fr / minmax(0, 1fr); gap: 1.2vw; }
.qso .log { contain: size; background: var(--panel); border-radius: 1em; padding: .8em 1em; display: flex; flex-flow: column wrap; align-content: flex-start; gap: .4em 2em; overflow: hidden; } /* no half-cut rows */
.qso .log > * { width: 100%; }
.qso .entry { display: flex; align-items: baseline; gap: .4em; font-size: 1.5em; }
.qso .entry b { font-family: ui-monospace, monospace; }
.qso .ok { color: var(--good); font-weight: 900; }
.qso .pts { margin-left: auto; color: var(--fire); font-weight: 900; }
.qso .club { grid-area: 1 / 2 / 3; width: 13em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .3em; padding: .8em .6em; text-align: center; background: var(--panel); border: .2em solid var(--fire); border-radius: 1em; }
.qso .club b { line-height: 1; }
.qso .club .call { font: 900 2.2em ui-monospace, monospace; }
.qso .club .code { font: 900 3em ui-monospace, monospace; color: var(--fire); }
.qso .club .muted { font-size: .85em; }
.qso .seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(10em, 1fr)); gap: .4em; }
.qso .seats:has(> :nth-child(13)) { font-size: .8em; } /* big groups: 4 columns, shorter rows */
.qso main:has(.sheet) .tip { display: none; } /* Morse/mixed rounds: the sheet needs the room */
.qso .seat { display: flex; align-items: center; gap: .4em; padding: .25em .6em; background: var(--panel); border-left: .45em solid var(--c); border-radius: .5em; transition: background .2s, opacity .2s; }
.qso .seat.half { background: #5a4a1f; }
.qso .seat.done { background: #1d5233; }
.qso .seat.off { opacity: .4; }
.qso .av { font-size: 1.3em; line-height: 1; }
.qso .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qso .st { margin-left: auto; font-weight: 800; color: var(--muted); white-space: nowrap; }
.qso .done .st { color: var(--good); font-family: ui-monospace, monospace; }
.qso .sheet { flex-shrink: 0; }
</style>
