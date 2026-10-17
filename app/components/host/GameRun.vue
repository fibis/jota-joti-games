<script setup lang="ts">
// Hands the running game its context (useGame) and renders it.
import { provideGameRun } from '~/composables/useGame';
import type { GameRun } from '~/games/types';

const props = defineProps<{ run: GameRun }>();
provideGameRun(props.run);
</script>

<template>
  <component :is="run.component" />
</template>
