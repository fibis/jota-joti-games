<script setup lang="ts">
// Four big answer buttons; shapes so colour-blind scouts can play too.
import { CHOICES } from '#shared/choices';
import type { PlayerInput } from '#shared/protocol';

const props = defineProps<{ options: readonly string[]; send: (msg: PlayerInput) => boolean }>();
const picked = ref<number>();

function pick(i: number) {
  if (!props.send({ t: 'pick', i })) return; // reconnecting: don't lock the buttons on an answer that never left
  navigator.vibrate?.(30);
  picked.value = i;
}
</script>

<template>
  <div class="choices">
    <button
      v-for="(text, i) in options"
      :key="i"
      :style="{ background: CHOICES[i]?.color }"
      :class="{ picked: picked === i }"
      :disabled="picked !== undefined"
      @click="pick(i)"
    >
      <b>{{ CHOICES[i]?.shape }}</b><span>{{ text }}</span>
    </button>
  </div>
</template>

<style scoped>
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: .6em; width: 100%; flex: 1; }
button { font: inherit; font-weight: 800; font-size: 1.05em; border: 0; border-radius: .6em; padding: .9em; color: #fff; touch-action: manipulation; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .3em; }
b { font-size: 2em; line-height: 1; }
button:disabled { opacity: .25; }
button.picked { opacity: 1; outline: 5px solid #fff; }
</style>
