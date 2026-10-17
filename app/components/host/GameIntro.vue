<script setup lang="ts">
// Before every game: what to do, in three lines, while the scouts get their phones ready.
import type { HostText } from '~/composables/useHostSession';
import type { GameInfo } from '~/games/types';

const INTRO_S = 20; // long enough to read it out loud; "Start now" skips it

defineProps<{ emoji: string; info: GameInfo; kb: boolean; t: HostText }>();
const emit = defineEmits<{ start: [] }>();

const left = ref(INTRO_S);
const tick = setInterval(() => {
  if (--left.value <= 0) emit('start');
}, 1000);
onUnmounted(() => clearInterval(tick));
</script>

<template>
  <div class="intro">
    <header>
      <span class="em">{{ emoji }}</span>
      <div>
        <h2>{{ info.title }}</h2>
        <small>🎮 {{ info.controller }}</small>
      </div>
    </header>
    <h3>{{ t.howTo }}</h3>
    <ol>
      <li v-for="(s, i) in info.howTo" :key="i">{{ s }}</li>
    </ol>
    <p v-if="kb" class="muted">{{ t.kbHelp }}</p>
    <footer>
      <span class="muted">{{ t.startsIn(Math.max(left, 0)) }}</span>
      <!-- not focusable by Space/Enter: those keys belong to the keyboard players -->
      <button tabindex="-1" @click="emit('start')">{{ t.start }}</button>
    </footer>
    <div class="clock" :style="{ animationDuration: `${INTRO_S}s` }" />
  </div>
</template>

<style scoped>
.intro { height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 1.1em; padding: 2vw 12vw; position: relative; }
.intro header { display: flex; align-items: center; gap: .6em; }
.intro .em { font-size: 4.5em; line-height: 1; }
.intro h2 { font-size: 2.8em; font-weight: 900; letter-spacing: -.01em; }
.intro small { color: var(--fire); font-size: 1.1em; }
.intro h3 { margin: .3em 0 0; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; font-size: 1.1em; }
.intro ol { margin: 0; padding: 0; list-style: none; counter-reset: step; display: flex; flex-direction: column; gap: .6em; }
.intro li { counter-increment: step; display: flex; gap: .7em; align-items: baseline; font-size: 1.55em; line-height: 1.3; }
.intro li::before { content: counter(step); flex: none; width: 1.6em; height: 1.6em; display: grid; place-items: center; border-radius: 50%; background: var(--fire); color: var(--bg); font-weight: 900; font-size: .8em; }
.intro p { margin: .4em 0 0; font-size: .95em; }
.intro footer { display: flex; align-items: center; gap: 1.2em; margin-top: .6em; }
.intro button { font: inherit; font-weight: 900; font-size: 1.2em; border: 0; border-radius: .6em; padding: .5em 1.4em; background: var(--fire); color: var(--bg); cursor: pointer; }
.intro button:hover { filter: brightness(1.1); }
.clock { position: absolute; left: 0; bottom: 0; height: .4em; background: var(--fire); animation: drain linear forwards; }
@keyframes drain { from { width: 100%; } to { width: 0; } }
</style>
