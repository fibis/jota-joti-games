<script setup lang="ts">
// Call Sign Speller: a station calls in, everyone spells its call sign in the radio alphabet,
// one character at a time on 4 buttons. A wrong word locks you out for a moment; first done scores most.
import { CHOICES } from '#shared/choices';
import type { Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import { randomCallSign, spell } from '~/games/kit/callsigns';
import type { CallSign } from '~/games/kit/callsigns';
import type { GameInput, Player } from '~/games/types';
import { allOnlineDone } from '~/games/kit/rounds';
import { PICK_KEYS } from '~/composables/useKeyboardPlayers';
import { marked, options } from './spelling';

const en = {
  round: 'Round',
  hint: 'Spell it in the radio alphabet – one word per character!',
  reveal: 'That’s how it’s spelled:',
  letter: 'Character', // digits too
  miss: '✗ Not quite…',
  spelled: (pts: number) => `✓ Spelled! +${pts}`,
  timeUp: '⏱ Time’s up',
  score: 'Score',
  ready: 'The next station is calling in…',
};
const de: typeof en = {
  round: 'Runde',
  hint: 'Buchstabier es im Funkalphabet – ein Wort pro Zeichen!',
  reveal: 'So wird’s buchstabiert:',
  letter: 'Zeichen',
  miss: '✗ Nicht ganz…',
  spelled: pts => `✓ Buchstabiert! +${pts}`,
  timeUp: '⏱ Zeit um',
  score: 'Punkte',
  ready: 'Gleich meldet sich die nächste Station…',
};
const TXT: Record<Lang, typeof en> = { en, de };

const LENGTHS = [4, 4, 5, 5, 6, 6]; // call sign length per round (a short prefix like F can make it one less)
const ROUND_S = 45;
const POINTS = [5, 4, 3], LATE = 2; // by finishing order; everyone later who finishes gets LATE
const LOCKOUT_MS = 1200; // after a wrong word: long enough that guessing all four doesn't pay
const REVEAL_MS = 4500;
const FIRST_MS = 600;
const WIDE_MAX = 14; // up to this many players fit in 2 wide columns (whole names show); more need 3 narrow ones

/** One player's progress on the current call sign. */
interface Speller {
  /** Characters spelled so far. */
  at: number;
  /** The four words on their buttons right now. */
  options: string[];
  done: boolean;
  pts: number;
  /** Locked out after a wrong word: the ✗ flash on the big screen. */
  miss: boolean;
  /** Phone dropped: the row fades. (The template can't read p.online: p is the raw, unreactive Player.) */
  off: boolean;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
// Shallow: the keys are the host's plain Player objects (each Speller is reactive by itself).
const score = shallowReactive(new Map(ctx.players.map((p): [Player, number] => [p, 0])));
const st = shallowReactive(new Map<Player, Speller>());
const station = shallowRef<CallSign>();
const call = computed(() => station.value?.call ?? '');
const words = computed(() => spell(call.value, ctx.lang));
const round = ref(-1), left = ref(0), active = ref(false);
const locks = new Map<Player, ReturnType<typeof setTimeout>>();
let finished = 0;
let step = Date.now(); // unique per controller, across games too: a reconnecting phone never keeps old buttons
let tick: ReturnType<typeof setInterval> | undefined;
let next = setTimeout(nextRound, FIRST_MS);

function nextRound() {
  if (round.value + 1 >= LENGTHS.length) return ctx.end([...score]);
  round.value++;
  let s: CallSign;
  do s = randomCallSign(LENGTHS[round.value]);
  while (s.origin.flag === station.value?.origin.flag); // a new country every round (DL/DK and K/W share a flag)
  station.value = s;
  left.value = ROUND_S;
  finished = 0;
  active.value = true;
  for (const p of score.keys()) start(p);
  tick = setInterval(() => {
    if (--left.value <= 0) endRound();
  }, 1000);
}

function start(p: Player) {
  st.set(p, reactive({ at: 0, options: [], done: false, pts: 0, miss: false, off: !p.online }));
  ask(p);
}

/** Fresh, reshuffled buttons for the player's current character. */
function ask(p: Player) {
  const s = st.get(p);
  if (!s) return;
  s.options = options(call.value[s.at] ?? '', ctx.lang);
  const sub = `${t.letter} ${s.at + 1} / ${call.value.length}`;
  ctx.send(p, { layout: 'choices', round: ++step, options: s.options, text: marked(call.value, s.at), sub });
}

function pick(p: Player, s: Speller, i: number) {
  if (s.options[i] !== words.value[s.at]) return miss(p, s, i);
  if (++s.at < call.value.length) return ask(p);
  s.done = true;
  s.pts = POINTS[finished++] ?? LATE;
  const total = (score.get(p) ?? 0) + s.pts;
  score.set(p, total);
  ctx.send(p, { layout: 'wait', text: t.spelled(s.pts), sub: `${t.score}: ${total}`, buzz: [80, 60, 80] });
}

function miss(p: Player, s: Speller, i: number) {
  s.miss = true;
  // Name the wrong word, so the trap (Gustav, George…) sticks.
  ctx.send(p, { layout: 'wait', text: t.miss, sub: `✗ ${s.options[i]}\n${marked(call.value, s.at)}`, buzz: 150 });
  locks.set(p, setTimeout(() => {
    s.miss = false;
    ask(p);
  }, LOCKOUT_MS));
}

function endRound() {
  active.value = false;
  clearInterval(tick);
  for (const id of locks.values()) clearTimeout(id);
  locks.clear();
  const spelling = words.value.join(' · ');
  for (const [p, total] of score) {
    const s = st.get(p);
    if (s) s.miss = false;
    ctx.send(p, { layout: 'wait', text: s?.done ? t.spelled(s.pts) : t.timeUp, sub: `${spelling}\n${t.score}: ${total}` });
  }
  next = setTimeout(nextRound, REVEAL_MS);
}

function input(p: Player, d: GameInput) {
  const s = st.get(p);
  if (d.t === 'presence' && s) {
    s.off = !p.online;
    // Back after a blip: fresh buttons. The phone keeps its buttons locked if its last pick got lost on the way.
    if (p.online && active.value && !s.done && !s.miss) ask(p);
  }
  if (d.t === 'pick' && active.value && s && !s.done && !s.miss) pick(p, s, d.i);
  if (active.value && allOnlineDone(st.keys(), pl => !!st.get(pl)?.done)) endRound();
}

// Latecomers start the current call sign from its first character.
function join(p: Player) {
  score.set(p, 0);
  if (active.value) start(p);
  else ctx.send(p, { layout: 'wait', text: t.ready });
}

onUnmounted(() => {
  clearInterval(tick);
  clearTimeout(next);
  for (const id of locks.values()) clearTimeout(id);
  active.value = false; // a late input can't end a round (and schedule the next one) any more
});
</script>

<template>
  <div class="cs">
    <div class="top">
      <span>{{ round < 0 ? '' : `${t.round} ${round + 1} / ${LENGTHS.length}` }}</span>
      <!-- the game's title is already in the stage bar: the header names the station instead -->
      <span class="from">{{ station ? `${station.origin.flag} ${station.origin.country[ctx.lang]}` : '' }}</span>
      <span class="timer">{{ active ? left : '' }}</span>
    </div>
    <div class="hint">{{ station ? (active ? t.hint : t.reveal) : '' }}</div>
    <div class="call">
      <span v-for="(c, i) in call" :key="i"><b>{{ c }}</b><small>{{ active ? '' : words[i] }}</small></span>
    </div>
    <div class="rows" :class="{ narrow: st.size > WIDE_MAX }" :style="{ '--min': st.size > WIDE_MAX ? '21em' : '30em' }">
      <div
        v-for="[p, s] in st"
        :key="p.id"
        class="row"
        :class="{ done: s.done, bad: s.miss, off: s.off, kb: p.keyboard }"
        :style="{ '--c': p.color }"
      >
        <span class="av">{{ p.avatar }}</span><span class="name">{{ p.name }}</span>
        <!-- keyboard players have no phone: their four words show here, in button order (keys 1-4 / 7-0) -->
        <span v-if="p.keyboard && active && !s.done && !s.miss" class="opts">
          <i v-for="(w, i) in s.options" :key="i" :style="{ background: CHOICES[i]?.color }"><kbd>{{ PICK_KEYS[p.id]?.[i] }}</kbd> {{ CHOICES[i]?.shape }} {{ w }}</i>
        </span>
        <span class="prog"><i v-for="(c, i) in call" :key="i" :class="{ on: i < s.at, cur: active && !s.miss && i === s.at }">{{ c }}</i></span>
        <span class="st">{{ s.done ? `✓ +${s.pts}` : s.miss ? '✗' : '' }}</span>
        <span class="sc">{{ score.get(p) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cs { height: 100%; display: flex; flex-direction: column; padding: 1.6vw 3vw; gap: .8vw; }
.cs .top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; font-size: 1.3em; color: var(--muted); }
.cs .timer { justify-self: end; font: 900 1.8em/1 ui-monospace, monospace; color: var(--fire); }
.cs .from { font-size: 1.4em; font-weight: 800; color: var(--text); }
.cs .call { display: flex; justify-content: center; }
/* Fixed columns, so the call sign doesn't shift when the words appear under it. */
.cs .call span { width: 6.6em; display: flex; flex-direction: column; align-items: center; }
.cs .call b { font: 900 5.2em/1 ui-monospace, monospace; }
.cs .call small { font-size: 1.3em; font-weight: 800; color: var(--fire); min-height: 1.4em; }
.cs .hint { text-align: center; font-size: 1.2em; color: var(--muted); }
.cs .rows { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--min), 1fr)); grid-auto-flow: dense; gap: .35em; align-content: start; overflow: hidden; }
.cs .row { display: flex; align-items: center; gap: .6em; background: var(--panel); border-left: .45em solid var(--c); border-radius: .5em; padding: .2em .7em; transition: background .2s; }
.cs .row.kb { grid-column: 1 / -1; }
.cs .row.done { background: #1d5233; }
.cs .row.bad { background: #5a1f22; }
.cs .row.off { opacity: .35; }
.cs .av { font-size: 1.4em; line-height: 1; }
.cs .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs .opts { display: flex; gap: .4em; }
.cs .opts i { font-style: normal; font-weight: 800; color: #fff; border-radius: .4em; padding: .15em .6em; }
.cs .prog { display: flex; gap: .15em; }
.cs .prog i { width: 1.2em; text-align: center; font: normal 900 1em ui-monospace, monospace; color: #ffffff55; border-bottom: 3px solid #ffffff33; }
.cs .prog i.on { color: var(--good); border-color: var(--good); }
.cs .prog i.cur { color: var(--text); border-color: var(--fire); }
.cs .st { width: 3.2em; font-weight: 900; color: var(--fire); }
.cs .rows.narrow .prog i { width: .7em; } /* 3 columns: slimmer letter boxes leave room for the names */
.cs .rows.narrow .st { width: 2.4em; }
.cs .row.bad .st { color: var(--bad); }
.cs .sc { width: 1.6em; text-align: right; font-weight: 900; font-size: 1.2em; }
</style>
