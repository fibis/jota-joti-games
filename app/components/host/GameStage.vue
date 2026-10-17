<script setup lang="ts">
// The running game, full screen, under a slim bar. The page keys this by run id, so every run mounts
// fresh, and ending the run unmounts the game (which cleans up its timers/Phaser in onUnmounted).
import { provideGameRun } from '~/composables/useGame';
import type { HostText } from '~/composables/useHostSession';
import type { GameRun } from '~/games/types';

const props = defineProps<{ run: GameRun; joinUrl: string; t: HostText }>();
const emit = defineEmits<{ exit: [] }>();
provideGameRun(props.run);

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
      <span>{{ run.game.emoji }} {{ run.game.info[run.ctx.lang].title }}</span>
      <span class="join-at muted">{{ t.joinAt }} {{ joinUrl }}</span>
      <button class="exit" :class="{ sure: armed }" title="Esc" @click="exitClick">{{ armed ? t.sure : t.end }}</button>
    </div>
    <!-- Games fill this with height: 100%; position: relative + min-height: 0 let Phaser's FIT scaling measure it. -->
    <div class="inner">
      <component :is="run.component" />
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
