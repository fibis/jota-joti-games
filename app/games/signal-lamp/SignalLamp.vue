<script setup lang="ts">
// Signal Lamp: Morse Master the other way round. The big screen flashes a word, the phones pick which one it was.
import { CHOICES } from '#shared/choices';
import { morseTimeline } from '#shared/morse';
import type { Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import { WORDS } from '~/games/morse-master/words';
import type { GameInput, Player } from '~/games/types';
import { MORSE_LEAD_S, playMorse } from '~/utils/morseAudio';
import { allOnlineDone } from '~/games/kit/rounds';
import { FASTEST_BONUS, PLAN_LAMP, ROUND_S, UNIT_S, lampAt, makeRound, morseSoFar, points } from './rounds';

const en = {
  round: 'Round',
  title: '🔦 Signal Lamp',
  read: '🔦 Read the lamp!',
  sound: '🔊 Watch and listen',
  light: '🔇 Light only!',
  answered: 'answered',
  nobody: 'Nobody read it…',
  scores: 'SCORES',
  soon: 'Next word coming…',
  slow: '⏱ Too slow',
  fastest: `⚡ Fastest! +${FASTEST_BONUS}`,
  right: (pts: number) => `✓ Correct! +${pts}`,
  wrong: (word: string) => `✗ It was ${word}`,
  speed: (wpm: number) => `Speed: ${wpm} WPM`,
};
const de: typeof en = {
  round: 'Runde',
  title: '🔦 Lichtmorsen',
  read: '🔦 Lies die Lampe!',
  sound: '🔊 Schau und hör hin',
  light: '🔇 Nur Licht!',
  answered: 'haben geantwortet',
  nobody: 'Keiner hat es gelesen…',
  scores: 'PUNKTE',
  soon: 'Gleich kommt das nächste Wort…',
  slow: '⏱ Zu langsam',
  fastest: `⚡ Am schnellsten! +${FASTEST_BONUS}`,
  right: pts => `✓ Richtig! +${pts}`,
  wrong: word => `✗ Es war ${word}`,
  speed: wpm => `Tempo: ${wpm} WpM`,
};
const TXT: Record<Lang, typeof en> = { en, de };

const FIRST_S = 0.8, REVEAL_S = 4.5;
/** Pause before the lamp repeats the word. */
const REPEAT_GAP_S = 1.6;
/** Rounds with the lamp's beeps on the speaker too; then it's light only. */
const SOUND_ROUNDS = 4;
/** Rounds where the dits/dahs appear under the lamp as they flash. */
const HINT_ROUNDS = 2;

interface Round {
  n: number;
  /** Date.now() at the start: unique across rounds and games, so phones always get fresh buttons. */
  id: number;
  word: string;
  options: string[];
  correct: number;
  unit: number;
  tones: [start: number, length: number][];
  /** One repetition: the word plus the pause, in seconds. */
  cycleS: number;
  sound: boolean;
  hint: boolean;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
const score = shallowReactive(new Map<Player, number>(ctx.players.map(p => [p, 0])));
const picks = shallowReactive(new Map<Player, { i: number; at: number }>());
const used = new Set<string>();
const round = shallowRef<Round>();
const open = ref(false), lit = ref(false), code = ref('');
const fastest = shallowRef<Player>();
let firstFlash = 0, cycleAt = 0, raf = 0; // performance.now() ms
let hush: AbortController | undefined; // silences the word still on the speaker
let tick: ReturnType<typeof setTimeout> | undefined;
let next = setTimeout(startRound, FIRST_S * 1000);

const label = computed(() => (round.value ? `${t.round} ${round.value.n + 1} / ${PLAN_LAMP.length}` : ''));
/** Morse speed by the PARIS standard (50 units a word), so the ramp is visible. */
const speed = computed(() => (round.value ? t.speed(Math.round(1.2 / round.value.unit)) : ''));
/** While open: who has answered. After the reveal: who read it right. */
const who = computed(() =>
  open.value ? [...picks.keys()] : [...picks].filter(([, pk]) => pk.i === round.value?.correct).map(([p]) => p),
);

function startRound() {
  const n = (round.value?.n ?? -1) + 1;
  const tier = PLAN_LAMP[n], unit = UNIT_S[n];
  if (tier === undefined || unit === undefined) return ctx.end([...score]);
  const { word, options, correct } = makeRound(WORDS[ctx.lang][tier] ?? [], used);
  used.add(word);
  const { tones, length } = morseTimeline(word);
  const r: Round = { n, id: Date.now(), word, options, correct, unit, tones, cycleS: length * unit + REPEAT_GAP_S, sound: n < SOUND_ROUNDS, hint: n < HINT_ROUNDS };
  picks.clear();
  fastest.value = undefined;
  round.value = r;
  open.value = true;
  code.value = '';
  firstFlash = cycleAt = flash(r);
  raf = requestAnimationFrame(frame);
  for (const p of score.keys()) sendChoices(p, r);
  tick = setTimeout(reveal, ROUND_S * 1000);
}

/** Starts one repetition of the word; returns when its first tone lights up. */
function flash(r: Round) {
  const now = performance.now();
  hush?.abort();
  hush = new AbortController();
  if (r.sound) playMorse(r.word, { unit: r.unit, signal: hush.signal });
  return now + MORSE_LEAD_S * 1000; // the speaker's first tone comes this much later too
}

// One clock for the whole repetition, so the lamp can't drift off the beeps (no timer per tone).
function frame(now: number) {
  const r = round.value;
  if (!r || !open.value) return;
  if (now - cycleAt >= r.cycleS * 1000) cycleAt = flash(r);
  const { on, shown } = lampAt(r.tones, (now - cycleAt) / 1000 / r.unit);
  lit.value = on;
  if (r.hint) code.value = morseSoFar(r.word, shown); // empty again once the next repetition starts
  raf = requestAnimationFrame(frame);
}

function sendChoices(p: Player, r: Round) {
  ctx.send(p, { layout: 'choices', round: r.id, options: r.options, text: t.read, sub: label.value });
}

function reveal() {
  const r = round.value;
  if (!r || !open.value) return;
  open.value = false;
  clearTimeout(tick);
  cancelAnimationFrame(raf);
  hush?.abort();
  lit.value = false;
  code.value = morseSoFar(r.word);
  for (const [p, total] of score) {
    const pk = picks.get(p), ok = pk?.i === r.correct, first = ok && p === fastest.value;
    const pts = ok ? points((pk.at - firstFlash) / 1000) + (first ? FASTEST_BONUS : 0) : 0;
    score.set(p, total + pts);
    ctx.send(p, {
      layout: 'wait',
      text: ok ? t.right(pts) : pk ? t.wrong(r.word) : t.slow,
      // Own line, letters an em space apart: the phone's pre-line squeezes plain spaces to one.
      sub: `${first ? `${t.fastest}\n` : ''}${r.word}\n${code.value.replaceAll('·', '•').replaceAll(' ', '\u2003')}`, // • reads better than · on a phone
      buzz: ok ? 80 : 300,
    });
  }
  next = setTimeout(startRound, REVEAL_S * 1000);
}

function input(p: Player, d: GameInput) {
  const r = round.value;
  if (!open.value || !r || !score.has(p)) return;
  if (d.t === 'pick' && !picks.has(p)) {
    picks.set(p, { i: d.i, at: performance.now() });
    if (d.i === r.correct) fastest.value ??= p;
  }
  if (allOnlineDone(score.keys(), pl => picks.has(pl))) reveal();
}

function join(p: Player) {
  score.set(p, 0);
  if (open.value && round.value) sendChoices(p, round.value);
  else ctx.send(p, { layout: 'wait', text: t.title, sub: t.soon });
}

onUnmounted(() => {
  clearTimeout(tick);
  clearTimeout(next);
  cancelAnimationFrame(raf);
  hush?.abort();
  open.value = false; // a late input can't reveal (and schedule the next round) any more
});
</script>

<template>
  <div class="lamp">
    <main>
      <div class="top"><span>{{ label }}</span><span>{{ speed }}</span></div>
      <!-- keyed per round: a fresh element restarts the countdown; it stops at the reveal -->
      <div class="bar">
        <div v-if="round" :key="round.id" :style="{ animationDuration: `${ROUND_S}s`, animationPlayState: open ? 'running' : 'paused' }" />
      </div>
      <div class="show">
        <div class="bulb" :class="{ on: lit }" />
        <div v-if="round" class="word" :class="{ mode: open }">{{ open ? (round.sound ? t.sound : t.light) : round.word }}</div>
        <div class="code"><i v-for="(s, i) in code" :key="i" :class="{ dit: s === '·' }">{{ s }}</i></div>
      </div>
      <div v-if="round" :key="round.id" class="opts">
        <div
          v-for="(c, i) in CHOICES"
          :key="i"
          class="opt"
          :class="open ? '' : i === round.correct ? 'win' : 'dim'"
          :style="{ background: c.color }"
        >
          <b>{{ c.shape }}</b><span>{{ round.options[i] }}</span>
        </div>
      </div>
      <div class="who">
        <span v-for="p in who" :key="p.id" :title="p.name">{{ p.avatar }}<i v-if="!open && p === fastest">⚡</i></span>
        <span v-if="open && who.length" class="muted">{{ t.answered }}</span>
        <span v-if="round && !open && !who.length" class="muted">{{ t.nobody }}</span>
      </div>
      <!-- the whole alphabet, the letters of the four answers lit: enough to read the lamp without knowing Morse by heart -->
      <GameMorseSheet v-if="round" :highlight="round.options.join('')" />
    </main>
    <GameScoreBoard :title="t.scores" :scores="score" />
  </div>
</template>

<style scoped>
.lamp { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 18em; gap: 2vw; padding: 2vw 3vw; }
.lamp main { display: flex; flex-direction: column; gap: 1.2vw; min-height: 0; }
.lamp .top { display: flex; justify-content: space-between; color: var(--muted); font-size: 1.2em; }
.lamp .bar { height: .6em; border-radius: .3em; background: var(--panel); overflow: hidden; }
.lamp .bar div { height: 100%; background: var(--fire); animation: countdown linear forwards; }
@keyframes countdown { from { width: 100%; } to { width: 0; } }
.lamp .show { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr auto 1fr; align-content: center; align-items: center; justify-items: center; gap: .5em 1.5em; }
.lamp .show > * { grid-column: 1 / -1; } /* word and code: full width under the lamp */
/* Off: dark glass in a metal rim. On: warm light (no fade: a 110 ms dit must still read). The glow stays
   tight on the bulb: a big area flashing several times a second is hard on the eyes in a dark room. */
.lamp .bulb { grid-area: 1 / 2; width: min(13em, 20vh); height: min(13em, 20vh); border-radius: 50%; border: .7em solid #2b2f33; background: radial-gradient(circle at 35% 30%, #4a5157, #1a1d20 55%, #0b0c0e); box-shadow: inset 0 .4em 1.2em #000c, 0 .6em 1.6em #0008; }
.lamp .bulb.on { border-color: #6b5a2e; background: radial-gradient(circle at 40% 35%, #fff3c4, #ffe27a 15%, #ffb627 65%, #ff9f1c); box-shadow: inset 0 0 1.5em #fff6, 0 0 2em .5em #ffb62788; }
.lamp .code i { font-style: normal; }
.lamp .morse-sheet { grid-template-columns: repeat(auto-fill, minmax(4.4em, 1fr)); } /* the lamp's column is too narrow for 13: 3 rows instead */
.lamp i.dit { display: inline-block; transform: scale(1.8); } /* '·' is a speck next to '−' */
.lamp .word { font: 900 4em/1.1 ui-monospace, monospace; letter-spacing: .2em; }
.lamp .word.mode { font: 800 1.8em/2.45 system-ui, sans-serif; letter-spacing: 0; color: var(--muted); } /* as tall as the word: no jump at the reveal */
.lamp .code { font: 800 2em ui-monospace, monospace; color: var(--fire); white-space: pre; word-spacing: .6em; min-height: 1.3em; }
.lamp .opts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1vw; }
.lamp .opt { display: flex; align-items: center; justify-content: center; gap: .5em; padding: .6em .8em; border-radius: .6em; font-size: 1.5em; font-weight: 800; color: #fff; transition: opacity .3s, transform .3s; }
.lamp .opt.dim { opacity: .2; }
.lamp .opt.win { transform: scale(1.04); outline: .2em solid #fff; }
.lamp .who { min-height: 2.2em; font-size: 1.4em; display: flex; flex-wrap: wrap; gap: .3em; justify-content: center; }
.lamp .who i { font-style: normal; font-size: .7em; }
</style>
