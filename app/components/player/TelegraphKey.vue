<script setup lang="ts">
// Telegraph key: short press = dit, long press = dah.
import { MorseKey, prettyMorse } from '#shared/morse';
import type { PlayerInput } from '#shared/protocol';
import { sidetone } from '~/utils/morseAudio';

const props = defineProps<{ send: (msg: PlayerInput) => boolean; label: string }>();

const pressed = ref(false);
const sym = ref('');
const log = ref('');
const key = new MorseKey(
  (c) => {
    log.value = (log.value + c).slice(-12);
    props.send({ t: 'letter', c });
  },
  (s) => {
    sym.value = prettyMorse(s);
    props.send({ t: 'sym', s });
  },
);

function press(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  pressed.value = true;
  key.down();
  sidetone(true);
}

function release() {
  pressed.value = false;
  key.up();
  sidetone(false);
}

onUnmounted(() => {
  if (pressed.value) sidetone(false); // controller replaced under a held finger: no endless tone
  key.flush(); // a letter still waiting for its gap goes out now
});
</script>

<template>
  <div class="sym">{{ sym }}</div>
  <div class="key" :class="{ pressed }" @pointerdown="press" @pointerup="release" @pointercancel="release">{{ label }}</div>
  <div class="log">{{ log }}</div>
</template>

<style scoped>
.key { width: min(70vw, 45vh); aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffc56b, var(--fire) 60%, #b86200); box-shadow: 0 10px 0 #7a4100; display: grid; place-items: center; font-size: 1.5em; color: #10231a; }
.key.pressed { transform: translateY(8px); box-shadow: 0 2px 0 #7a4100; }
.sym { font: 800 2.4em/1 ui-monospace, monospace; min-height: 1em; letter-spacing: .1em; }
.log { font: 700 1.2em ui-monospace, monospace; color: var(--muted); min-height: 1.3em; }
</style>
