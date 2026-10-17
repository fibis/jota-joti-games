<script setup lang="ts">
// Morse Master: everyone keys the same word in Morse on their phone. First correct = most points.
import { CODE, prettyMorse } from '#shared/morse';
import type { ControllerUi, Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import type { GameInput, Player } from '~/games/types';
import { playMorse } from '~/utils/morseAudio';
import { allOnlineDone } from '~/games/kit/rounds';
import { PLAN, WORDS } from './words';

const en = {
  round: 'Round',
  title: '📡 Morse Master — short tap = · long press = −',
  noHint: 'No hints now — use the code sheet! 👇',
  over: '⏱ Round over!',
  nextWord: ' Next word coming…',
  timeUp: '⏱ Time’s up',
  score: 'Score',
  done: '✓ Done!',
  next: 'next',
};
const de: typeof en = {
  round: 'Runde',
  title: '📡 Morse-Meister — kurz tippen = · lang drücken = −',
  noHint: 'Keine Hilfe mehr – nutz die Tabelle! 👇',
  over: '⏱ Runde vorbei!',
  nextWord: ' Gleich kommt das nächste Wort…',
  timeUp: '⏱ Zeit um',
  score: 'Punkte',
  done: '✓ Geschafft!',
  next: 'nächster',
};
const TXT: Record<Lang, typeof en> = { en, de };

const ROUND_S = 60, HINT_ROUNDS = 3, POINTS = [5, 4, 3], LATE = 2;
const morse = (c: string) => prettyMorse(CODE[c] ?? '');

/** One player's progress on the current word. */
interface KeyState {
  typed: string;
  sym: string;
  done: boolean;
  pts: number;
  bad: string | null;
}
const fresh = () => reactive<KeyState>({ typed: '', sym: '', done: false, pts: 0, bad: null });

const ctx = useGame({ input, join });
const t = TXT[ctx.lang], TIERS = WORDS[ctx.lang];
// Shallow: the keys are the host's plain Player objects (each KeyState is reactive by itself).
const score = shallowReactive(new Map(ctx.players.map((p): [Player, number] => [p, 0])));
const st = shallowReactive(new Map<Player, KeyState>());
const used = new Set<string>();
const round = ref(-1), word = ref(''), left = ref(0), active = ref(false);
let finished = 0;
let tick: ReturnType<typeof setInterval> | undefined;
let next = setTimeout(nextRound, 500);

const hint = computed(() => {
  if (round.value < 0) return '';
  if (!active.value) return t.over + (round.value + 1 < PLAN.length ? t.nextWord : '');
  return round.value < HINT_ROUNDS ? [...word.value].map(morse).join('   ') : t.noHint;
});
const status = (s: KeyState) => (s.done ? `✓ +${s.pts}` : s.bad ? `✗ ${s.bad}` : prettyMorse(s.sym));

function nextRound() {
  if (round.value + 1 >= PLAN.length) return ctx.end([...score]);
  round.value++;
  const pool = (TIERS[PLAN[round.value] ?? 0] ?? []).filter(w => !used.has(w));
  word.value = pool[(Math.random() * pool.length) | 0] ?? '';
  used.add(word.value);
  left.value = ROUND_S;
  finished = 0;
  active.value = true;
  for (const p of score.keys()) st.set(p, fresh());
  playMorse(word.value);
  for (const p of score.keys()) sendKey(p);
  tick = setInterval(() => {
    if (--left.value <= 0) endRound();
  }, 1000);
}

function endRound() {
  active.value = false;
  clearInterval(tick);
  for (const [p, n] of score) {
    const s = st.get(p);
    ctx.send(p, { layout: 'wait', text: s?.done ? `✓ +${s.pts}` : t.timeUp, sub: `${t.score}: ${n}` });
  }
  next = setTimeout(nextRound, 4000);
}

function sendKey(p: Player, extra: Pick<ControllerUi, 'buzz'> = {}) {
  const s = st.get(p);
  if (!s) return;
  const c = word.value[s.typed.length] ?? '';
  const sub = s.done
    ? `${t.done} +${s.pts}`
    : `${s.typed}${'_'.repeat(word.value.length - s.typed.length)}${round.value < HINT_ROUNDS ? `\n${t.next}: ${c}  ${morse(c)}` : ''}`;
  ctx.send(p, { layout: 'key', round: round.value, text: word.value, sub, ...extra });
}

function input(p: Player, d: GameInput) {
  const s = st.get(p);
  if (!s || !active.value || s.done) return;
  if (d.t === 'sym') s.sym = d.s; // already cleaned up by parseInput()
  if (d.t === 'letter') {
    s.sym = '';
    s.bad = d.c === word.value[s.typed.length] ? null : d.c;
    if (!s.bad) s.typed += d.c;
    if (s.typed === word.value) {
      s.done = true;
      s.pts = POINTS[finished++] ?? LATE;
      score.set(p, (score.get(p) ?? 0) + s.pts);
    }
    sendKey(p, s.bad ? { buzz: 150 } : s.done ? { buzz: [80, 60, 80] } : {});
  }
  if (allOnlineDone(st.keys(), pl => !!st.get(pl)?.done)) endRound();
}

function join(p: Player) {
  score.set(p, 0);
  st.set(p, fresh());
  if (active.value) sendKey(p);
}

onUnmounted(() => {
  clearInterval(tick);
  clearTimeout(next);
  active.value = false; // a late input can't end a round (and schedule the next one) any more
});
</script>

<template>
  <div class="mm">
    <div class="top">
      <span class="round">{{ round < 0 ? '' : `${t.round} ${round + 1} / ${PLAN.length}` }}</span>
      <span>{{ t.title }}</span>
      <span class="timer">{{ round < 0 ? '' : left }}</span>
    </div>
    <div class="word">{{ word }}</div>
    <div class="hint">{{ hint }}</div>
    <div class="rows">
      <div
        v-for="[p, s] in st"
        :key="p.id"
        class="row"
        :class="s.done ? 'done' : s.bad ? 'bad' : ''"
        :style="{ '--c': p.color }"
      >
        <span class="av">{{ p.avatar }}</span><span>{{ p.name }}</span>
        <span class="prog"><i v-for="(c, i) in word" :key="i" :class="{ on: i < s.typed.length }">{{ i < s.typed.length ? c : '' }}</i></span>
        <span class="sym">{{ status(s) }}</span>
        <span class="sc">{{ score.get(p) }}</span>
      </div>
    </div>
    <GameMorseSheet />
  </div>
</template>

<style scoped>
.mm { height: 100%; display: flex; flex-direction: column; padding: 2vw 3vw; gap: 1.2vw; }
.mm .top { display: flex; justify-content: space-between; align-items: baseline; font-size: 1.3em; color: var(--muted); }
.mm .timer { font: 900 1.8em ui-monospace, monospace; color: var(--fire); }
.mm .word { text-align: center; font: 900 6em/1 ui-monospace, monospace; letter-spacing: .25em; }
.mm .hint { text-align: center; font: 800 2.2em ui-monospace, monospace; color: var(--fire); white-space: pre; min-height: 1.3em; }
.mm .rows { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(24em, 1fr)); gap: .5em; align-content: start; overflow: hidden; }
.mm .row { display: flex; align-items: center; gap: .6em; background: var(--panel); border-left: .45em solid var(--c); border-radius: .5em; padding: .4em .8em; transition: background .2s; }
.mm .row.done { background: #1d5233; }
.mm .row.bad { background: #5a1f22; }
.mm .av { font-size: 1.4em; }
.mm .prog i { display: inline-block; width: 1.2em; margin-right: .15em; border-bottom: 3px solid #ffffff44; text-align: center; font: normal 900 1em ui-monospace, monospace; }
.mm .prog i.on { color: var(--good); border-color: var(--good); }
.mm .sym { font: 800 1.2em ui-monospace, monospace; color: var(--fire); }
.mm .sc { margin-left: auto; font-weight: 900; font-size: 1.2em; }
</style>
