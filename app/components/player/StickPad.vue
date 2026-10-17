<script setup lang="ts">
// Floating joystick: put your thumb down anywhere, drag. With a `meter` it is also the fox-hunt receiver.
import type { PlayerInput } from '#shared/protocol';
import { useFoxRadio } from '~/composables/useFoxRadio';

const props = defineProps<{
  send: (msg: PlayerInput) => boolean;
  hint: string;
  signal: string;
  /** Fox signal 0..1: shows the meter and plays the beacon. */
  meter?: number;
}>();

interface Point { x: number; y: number }

const R = 80; // drag radius, px
let origin: Point | null = null; // where the thumb went down, client coords
let last = 0;
// Pad-relative, only while a thumb is down.
const ring = ref<Point>();
const knob = ref<Point>();
const at = (p: Point) => ({ left: `${p.x}px`, top: `${p.y}px` });

function down(e: PointerEvent) {
  const pad = e.currentTarget as HTMLElement;
  pad.setPointerCapture(e.pointerId);
  origin = { x: e.clientX, y: e.clientY };
  const r = pad.getBoundingClientRect();
  ring.value = knob.value = { x: origin.x - r.left, y: origin.y - r.top };
}

function move(e: PointerEvent) {
  if (!origin) return;
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  let x = e.clientX - origin.x;
  let y = e.clientY - origin.y;
  const d = Math.hypot(x, y);
  if (d > R) {
    x *= R / d;
    y *= R / d;
  }
  knob.value = { x: origin.x - r.left + x, y: origin.y - r.top + y };
  if (performance.now() - last > 33) {
    last = performance.now();
    props.send({ t: 'stick', x: x / R, y: y / R });
  }
}

function up() {
  origin = null;
  ring.value = knob.value = undefined;
  props.send({ t: 'stick', x: 0, y: 0 });
}

// The radio lives as long as this controller: a fresh controller (new layout or round) starts it over.
const radio = useFoxRadio(() => props.meter ?? 0);
watch(() => props.meter, (m) => {
  if (m !== undefined) radio.start();
}, { immediate: true });
</script>

<template>
  <div class="stick">
    <template v-if="meter !== undefined">
      <div>{{ signal }}</div>
      <div class="meter"><div :style="{ width: `${meter * 100}%` }" /></div>
    </template>
    <div class="area">
      <div class="pad" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
        <div class="hint">{{ hint }}</div>
        <div v-if="ring" class="ring" :style="at(ring)" />
        <div v-if="knob" class="knob" :style="at(knob)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stick { position: absolute; inset: 0; display: flex; flex-direction: column; gap: .6em; }
.area { position: relative; flex: 1; }
.pad { position: absolute; inset: 0; border: 2px dashed #ffffff22; border-radius: 1em; }
.hint { position: absolute; inset: 0; display: grid; place-items: center; color: #ffffff44; }
.ring, .knob { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; }
.ring { width: 160px; height: 160px; border: 3px solid #ffffff55; }
.knob { width: 70px; height: 70px; background: var(--me); }
.meter { width: 100%; height: 1.4em; border-radius: .7em; background: var(--panel); overflow: hidden; }
.meter div { height: 100%; width: 0; background: linear-gradient(90deg, #3a7, #fd3, #f42); transition: width .2s; }
</style>
