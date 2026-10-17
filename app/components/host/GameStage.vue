<script setup lang="ts">
// The game on stage, full screen under a slim bar: first its intro, then the running game.
// Every run mounts fresh (keyed by run id), and ending the run unmounts the game, which cleans up
// its timers/Phaser in onUnmounted.
import type { Lang } from '#shared/protocol';
import type { HostText } from '~/composables/useHostSession';
import type { GameDefinition, GameRun } from '~/games/types';

defineProps<{ game: GameDefinition; run: GameRun | null; lang: Lang; joinUrl: string; t: HostText }>();
const emit = defineEmits<{ start: []; exit: [] }>();

// End game: two clicks so a stray click doesn't wipe a round. Esc ends right away.
const armed = ref(false);
let disarm: ReturnType<typeof setTimeout> | undefined;
function exitClick() {
  if (armed.value) return emit('exit');
  armed.value = true;
  disarm = setTimeout(() => (armed.value = false), 3000);
}
const onKey = (e: KeyboardEvent) => {
  if (e.code === 'Escape') emit('exit');
};
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => {
  window.removeEventListener('keydown', onKey);
  clearTimeout(disarm);
});
</script>

<template>
  <div class="stage">
    <div class="bar">
      <span>{{ game.emoji }} {{ game.info[run?.ctx.lang ?? lang].title }}</span>
      <span class="join-at muted">{{ t.joinAt }} {{ joinUrl }}</span>
      <button class="exit" :class="{ sure: armed }" title="Esc" @click="exitClick">{{ armed ? t.sure : t.end }}</button>
    </div>
    <!-- Games fill this with height: 100%; position: relative + min-height: 0 let Phaser's FIT scaling measure it. -->
    <div class="inner">
      <HostGameRun v-if="run" :key="run.id" :run="run" />
      <HostGameIntro v-else :emoji="game.emoji" :info="game.info[lang]" :kb="!game.phonesOnly" :t="t" @start="emit('start')" />
    </div>
  </div>
</template>

<style scoped>
.stage { position: fixed; inset: 0; display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; gap: 1.2em; padding: .3em 1em; background: #0007; font-size: .8em; }
.join-at { margin-right: auto; font-family: ui-monospace, monospace; }
.inner { position: relative; flex: 1; min-height: 0; }
.exit { font: inherit; font-weight: 800; border: 0; border-radius: .4em; padding: .3em .9em; background: #ffffff1f; color: var(--text); cursor: pointer; }
.exit:hover, .exit.sure { background: var(--bad); color: #fff; }
</style>
