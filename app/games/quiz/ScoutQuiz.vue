<script setup lang="ts">
// Scout Quiz: Kahoot-style. Big screen shows the question, phones show it too, with 4 coloured buttons.
import { CHOICES } from '#shared/choices';
import { useGame } from '~/composables/useGame';
import type { GameInput, Player } from '~/games/types';
import { allOnlineDone, speedPoints } from '~/games/kit/rounds';
import { COUNT, QUESTIONS } from './questions';
import { shuffle } from '~/games/kit/random';

const en = { q: 'Question', scores: 'SCORES', answered: 'answered', nobody: 'Nobody got it…', right: 'Correct!', wrong: '✗ Wrong', slow: '⏱ Too slow', answer: 'Answer:' };
const de: typeof en = { q: 'Frage', scores: 'PUNKTE', answered: 'haben geantwortet', nobody: 'Keiner wusste es…', right: 'Richtig!', wrong: '✗ Falsch', slow: '⏱ Zu langsam', answer: 'Antwort:' };
const TXT = { en, de };

const Q_S = 20;

interface Round {
  /** "Question 3 / 10" */
  label: string;
  cat: string;
  text: string;
  options: string[];
  correct: number;
  t0: number;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
const qs = shuffle(QUESTIONS[ctx.lang]).slice(0, COUNT);
const score = shallowReactive(new Map<Player, number>(ctx.players.map(p => [p, 0])));
const picks = shallowReactive(new Map<Player, { i: number; at: number }>());
const round = shallowRef<Round>();
const open = ref(false);
let n = -1;
let tick: ReturnType<typeof setTimeout> | undefined;
let next = setTimeout(ask, 300);

const ranking = computed(() => [...score].sort((a, b) => b[1] - a[1]));
/** While open: who has answered. After the reveal: who got it right. */
const who = computed(() =>
  open.value ? [...picks.keys()] : [...picks].filter(([, pk]) => pk.i === round.value?.correct).map(([p]) => p),
);

function ask() {
  const q = qs[++n];
  if (!q) return ctx.end([...score]);
  const [cat, text, ...answers] = q;
  const options = shuffle(answers);
  const r: Round = { label: `${t.q} ${n + 1} / ${qs.length}`, cat, text, options, correct: options.indexOf(answers[0]), t0: Date.now() };
  picks.clear();
  round.value = r;
  open.value = true;
  for (const p of score.keys()) sendQ(p, r);
  tick = setTimeout(reveal, Q_S * 1000);
}

// round: t0 is unique across games, so a reconnecting phone never keeps an old game's buttons.
function sendQ(p: Player, r: Round) {
  ctx.send(p, { layout: 'choices', round: r.t0, options: r.options, text: r.text, sub: r.label });
}

function reveal() {
  const r = round.value;
  if (!r) return;
  open.value = false;
  clearTimeout(tick);
  const answer = `${t.answer} ${CHOICES[r.correct]?.shape} ${r.options[r.correct]}`;
  for (const [p, total] of score) {
    const pk = picks.get(p), ok = pk?.i === r.correct;
    const pts = ok ? speedPoints((pk.at - r.t0) / 1000, Q_S) : 0;
    score.set(p, total + pts);
    ctx.send(p, { layout: 'wait', text: ok ? `✓ ${t.right} +${pts}` : pk ? t.wrong : t.slow, sub: `${r.text}\n${answer}`, buzz: ok ? 80 : 300 });
  }
  next = setTimeout(ask, 5000);
}

function input(p: Player, d: GameInput) {
  if (!open.value || !score.has(p)) return;
  if (d.t === 'pick' && !picks.has(p)) picks.set(p, { i: d.i, at: Date.now() });
  if (allOnlineDone(score.keys(), pl => picks.has(pl))) reveal();
}

function join(p: Player) {
  score.set(p, 0);
  if (open.value && round.value) sendQ(p, round.value);
}

onUnmounted(() => {
  clearTimeout(tick);
  clearTimeout(next);
  open.value = false; // in case input still arrives: no reveal, no new timers
});
</script>

<template>
  <div class="qz">
    <main>
      <template v-if="round">
        <div class="top"><span>{{ round.label }}</span><span>{{ round.cat }}</span></div>
        <!-- keyed per question: a fresh element restarts the countdown -->
        <div class="bar"><div :key="round.t0" :style="{ animationDuration: `${Q_S}s` }" /></div>
        <h2>{{ round.text }}</h2>
        <div :key="round.t0" class="opts">
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
          <span v-for="p in who" :key="p.id" :title="p.name">{{ p.avatar }}</span>
          <span v-if="open && who.length" class="muted">{{ t.answered }}</span>
          <span v-if="!open && !who.length" class="muted">{{ t.nobody }}</span>
        </div>
      </template>
    </main>
    <aside>
      <template v-if="round">
        <b class="muted">{{ t.scores }}</b>
        <div v-for="[p, s] in ranking" :key="p.id"><span>{{ p.avatar }}</span><span>{{ p.name }}</span><span>{{ s }}</span></div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.qz { height: 100%; display: grid; grid-template-columns: 1fr 18em; gap: 2vw; padding: 2vw 3vw; }
.qz main { display: flex; flex-direction: column; gap: 1.5vw; min-height: 0; }
.qz .top { display: flex; justify-content: space-between; color: var(--muted); font-size: 1.2em; }
.qz .bar { height: .6em; border-radius: .3em; background: var(--panel); overflow: hidden; }
.qz .bar div { height: 100%; background: var(--fire); animation: countdown linear forwards; }
@keyframes countdown { from { width: 100%; } to { width: 0; } }
.qz h2 { font-size: 2.6em; text-transform: none; letter-spacing: 0; color: var(--text); text-align: center; flex: 1; display: grid; place-items: center; }
.qz .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 1vw; }
.qz .opt { display: flex; align-items: center; gap: .6em; padding: .8em 1em; border-radius: .6em; font-size: 1.6em; font-weight: 800; color: #fff; transition: opacity .3s, transform .3s; }
.qz .opt b { font-size: 1.2em; }
.qz .opt.dim { opacity: .2; }
.qz .opt.win { transform: scale(1.03); outline: .2em solid #fff; }
.qz .who { min-height: 2.2em; font-size: 1.4em; display: flex; flex-wrap: wrap; gap: .3em; }
.qz aside { background: var(--panel); border-radius: 1em; padding: 1em; display: flex; flex-direction: column; gap: .4em; overflow: hidden; }
.qz aside div { display: flex; gap: .5em; }
.qz aside span:last-child { margin-left: auto; font-weight: 900; }
</style>
