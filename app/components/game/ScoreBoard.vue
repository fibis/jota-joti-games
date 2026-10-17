<script setup lang="ts">
// Side panel with everyone's score, highest first. <GameScoreBoard :title :scores />
import type { Player } from '~/games/types';

const props = defineProps<{ title: string; scores: ReadonlyMap<Player, number> }>();
const ranked = computed(() => [...props.scores].sort((a, b) => b[1] - a[1]));
</script>

<template>
  <aside class="board">
    <b class="muted">{{ title }}</b>
    <div v-for="[p, s] in ranked" :key="p.id">
      <span>{{ p.avatar }}</span><span>{{ p.name }}</span><span class="pts">{{ s }}</span>
    </div>
  </aside>
</template>

<style scoped>
/* Rows that don't fit wrap into a hidden second column instead of being cut in half at the bottom. */
.board { background: var(--panel); border-radius: 1em; padding: 1em; display: flex; flex-flow: column wrap; align-content: flex-start; gap: .4em 2em; overflow: hidden; }
.board > * { width: 100%; }
.board div { display: flex; gap: .5em; }
.pts { margin-left: auto; font-weight: 900; }
</style>
