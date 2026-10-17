<script setup lang="ts">
// A scout in the lobby. Two clicks remove them (one stray click must not kick a scout out).
import type { Player } from '~/games/types';

defineProps<{ player: Player; hint: string }>();
const emit = defineEmits<{ remove: [] }>();

const armed = ref(false);
let disarm: ReturnType<typeof setTimeout> | undefined;
function click() {
  if (armed.value) return emit('remove');
  armed.value = true;
  clearTimeout(disarm);
  disarm = setTimeout(() => (armed.value = false), 3000);
}
onUnmounted(() => clearTimeout(disarm));
</script>

<template>
  <!-- mousedown.prevent: never takes focus, so Space/Enter stay the keyboard players' keys -->
  <button class="chip" :class="{ off: !player.online, armed }" :style="{ '--c': player.color }" :title="hint" tabindex="-1" @mousedown.prevent @click="click">
    <span class="av">{{ player.avatar }}</span>{{ player.name }}<span v-if="armed" class="x">✕</span>
  </button>
</template>

<style scoped>
.chip { font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: .35em; padding: .3em .8em .3em .4em; border-radius: 2em; background: var(--panel); border: 3px solid var(--c); animation: pop .35s ease-out; }
.chip.off { opacity: .35; }
.chip.armed { border-color: var(--bad); background: #5a1f22; opacity: 1; }
.chip .av { font-size: 1.4em; line-height: 1; }
.chip .x { color: var(--bad); font-weight: 900; margin-left: .2em; }
@keyframes pop { from { transform: scale(.4); opacity: 0; } }
</style>
