<script setup lang="ts">
import type { GameInfo } from '~/games/types';

defineProps<{ emoji: string; info: GameInfo }>();
</script>

<template>
  <button class="game">
    <header><span class="em">{{ emoji }}</span><b>{{ info.title }}</b></header>
    <p>{{ info.description }}</p>
    <small>🎮 {{ info.controller }}</small>
  </button>
</template>

<style scoped>
.game { font: inherit; color: inherit; text-align: left; cursor: pointer; background: var(--panel); border: 3px solid var(--line); border-radius: 1em; padding: 1.1em; display: flex; flex-direction: column; gap: .4em; transition: transform .15s, border-color .15s; }
.game:hover, .game:focus-visible { transform: translateY(-4px); border-color: var(--fire); outline: none; }
.game header { display: flex; align-items: center; gap: .4em; }
.game .em { font-size: 2em; line-height: 1; }
.game b { font-size: 1.3em; }
.game p { margin: 0; color: var(--muted); font-weight: 500; font-size: .9em; flex: 1; }
.game small { color: var(--fire); }
</style>
