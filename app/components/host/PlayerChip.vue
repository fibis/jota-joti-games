<script setup lang="ts">
import type { Player } from '~/games/types';

defineProps<{ player: Player }>();
</script>

<template>
  <span class="chip" :class="{ off: !player.online }" :style="{ '--c': player.color }"><span class="av">{{ player.avatar }}</span>{{ player.name }}</span>
</template>

<style scoped>
.chip { display: inline-flex; align-items: center; gap: .35em; padding: .3em .8em .3em .4em; border-radius: 2em; background: var(--panel); border: 3px solid var(--c); animation: pop .35s ease-out; }
.chip.off { opacity: .35; }
.chip .av { font-size: 1.4em; line-height: 1; }
@keyframes pop { from { transform: scale(.4); opacity: 0; } }
</style>
