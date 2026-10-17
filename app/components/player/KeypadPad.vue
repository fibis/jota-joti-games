<script setup lang="ts">
// Number keypad: the code goes out by itself once all digits are typed (or early with ✓).
import type { PlayerInput } from '#shared/protocol';

const { send, digits = 2 } = defineProps<{
  send: (msg: PlayerInput) => boolean;
  /** Digits in the code. */
  digits?: number;
}>();

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'] as const;
const LABEL: Partial<Record<(typeof KEYS)[number], string>> = { back: '⌫', ok: '✓' };

const typed = ref('');
const failed = ref(''); // the last code that didn't leave
// Reconnecting: the digits stay, dimmed, and ✓ pulses until it sends them again. Otherwise a code looks logged when it isn't.
const unsent = computed(() => typed.value !== '' && typed.value === failed.value);

function submit() {
  if (!typed.value) return;
  if (send({ t: 'code', code: typed.value })) typed.value = failed.value = '';
  else failed.value = typed.value;
}

function tap(key: (typeof KEYS)[number]) {
  navigator.vibrate?.(10);
  if (key === 'back') typed.value = typed.value.slice(0, -1);
  else if (key === 'ok') submit();
  else if (typed.value.length < digits) {
    typed.value += key;
    if (typed.value.length === digits) submit();
  }
}
</script>

<template>
  <div class="keypad" :class="{ unsent }">
    <div class="display">
      <span v-for="i in digits" :key="i">{{ typed[i - 1] ?? '·' }}</span>
    </div>
    <div class="keys">
      <button v-for="key in KEYS" :key="key" :data-key="key" :class="key" @click="tap(key)">{{ LABEL[key] ?? key }}</button>
    </div>
  </div>
</template>

<style scoped>
.keypad { flex: 1; width: 100%; max-width: 24em; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: .6em; }
.display { display: flex; justify-content: center; gap: .3em; font: 800 2.6em/1.1 ui-monospace, monospace; }
.display span { min-width: 1ch; border-bottom: 4px solid var(--me); }
.keys { flex: 1; max-height: 26em; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(4, 1fr); gap: .5em; }
button { font: inherit; font-size: 1.7em; font-weight: 800; border: 0; border-radius: .5em; background: var(--panel); color: var(--text); box-shadow: 0 4px 0 var(--line); touch-action: manipulation; }
button:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--line); }
.back { background: var(--line); }
.ok { background: var(--good); color: #10231a; }
.unsent .display span { opacity: .35; }
.unsent .ok { animation: nudge 1s ease-in-out infinite; }
@keyframes nudge { 50% { transform: scale(1.1); box-shadow: 0 0 0 .25em color-mix(in srgb, var(--good) 40%, transparent); } }
</style>
