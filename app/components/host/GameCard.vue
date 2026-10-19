<script setup lang="ts">
// A game in the lobby list: click to start it, ⓘ for what it is about.
import type { GameInfo } from '~/games/types';

defineProps<{ emoji: string; info: GameInfo }>();
const emit = defineEmits<{ pick: [] }>();

const open = ref(false);
const root = useTemplateRef<HTMLElement>('root');
// Anywhere else on the screen closes the description (so does opening another card's).
const close = (e: PointerEvent) => {
  if (!root.value?.contains(e.target as Node)) open.value = false;
};
watch(open, o => (o ? window.addEventListener('pointerdown', close) : window.removeEventListener('pointerdown', close)));
onUnmounted(() => window.removeEventListener('pointerdown', close));
</script>

<template>
  <div ref="root" class="game" :class="{ open }">
    <button class="pick" @click="emit('pick')">
      <span class="em">{{ emoji }}</span>
      <b>{{ info.title }}</b>
      <small>🎮 {{ info.controller }}</small>
    </button>
    <!-- mousedown.prevent: never takes focus, so Space/Enter stay the keyboard players' keys -->
    <button class="info" :aria-label="info.title" :aria-expanded="open" tabindex="-1" @mousedown.prevent @click="open = !open">{{ open ? '✕' : 'i' }}</button>
    <p v-if="open" class="about">{{ info.description }}</p>
  </div>
</template>

<style scoped>
.game { position: relative; }
.pick { width: 100%; height: 100%; font: inherit; color: inherit; text-align: left; cursor: pointer; background: var(--panel); border: 3px solid var(--line); border-radius: 1em; padding: .6em 2.4em .6em .8em; display: grid; grid-template: auto auto / auto 1fr; column-gap: .5em; align-items: center; transition: transform .15s, border-color .15s; }
.pick:hover, .pick:focus-visible, .open .pick { transform: translateY(-3px); border-color: var(--fire); outline: none; }
.em { grid-row: 1 / 3; font-size: 1.8em; line-height: 1; }
.pick b { font-size: 1.1em; line-height: 1.15; }
.pick small { color: var(--fire); font-size: .8em; }
.info { position: absolute; top: .55em; right: .55em; width: 1.6em; height: 1.6em; border-radius: 50%; border: 2px solid var(--muted); background: none; color: var(--muted); font: italic 900 .9em Georgia, serif; cursor: pointer; display: grid; place-items: center; padding: 0; }
.info:hover, .open .info { border-color: var(--fire); color: var(--fire); }
.open .info { font: 900 .8em system-ui, sans-serif; }
/* Above the card: below it, the last row would be cut off by the scrolling column. */
.about { position: absolute; z-index: 10; left: 0; right: 0; bottom: calc(100% + .5em); margin: 0; padding: .7em .9em; border-radius: .8em; background: #0d1f16; border: 2px solid var(--fire); box-shadow: 0 .5em 1.5em #000a; font-weight: 500; font-size: .9em; line-height: 1.35; }
.about::after { content: ''; position: absolute; right: 1em; top: 100%; border: .5em solid transparent; border-top-color: var(--fire); }
</style>
