<script setup lang="ts">
import type { GameInfo } from '~/games/types';

defineProps<{ emoji: string; info: GameInfo }>();
</script>

<template>
  <button class="game" :title="info.description">
    <header><span class="em">{{ emoji }}</span><b>{{ info.title }}</b></header>
    <p>{{ info.description }}</p>
    <small>🎮 {{ info.controller }}</small>
  </button>
</template>

<style scoped>
.game { font: inherit; color: inherit; text-align: left; cursor: pointer; background: var(--panel); border: 3px solid var(--line); border-radius: 1em; padding: .7em .9em; display: flex; flex-direction: column; gap: .3em; transition: transform .15s, border-color .15s; }
.game:hover, .game:focus-visible { transform: translateY(-4px); border-color: var(--fire); outline: none; }
.game header { display: flex; align-items: center; gap: .4em; }
.game .em { font-size: 1.6em; line-height: 1; }
.game b { font-size: 1.1em; line-height: 1.15; }
/* Two lines keep all nine cards on a 16:9 beamer screen; the full text is in the tooltip. No flex-grow: a taller
   card (two-line title next door) would show a clipped third line under the ellipsis. */
.game p { margin: 0; color: var(--muted); font-weight: 500; font-size: .8em; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
.game small { color: var(--fire); font-size: .8em; margin-top: auto; }
</style>
