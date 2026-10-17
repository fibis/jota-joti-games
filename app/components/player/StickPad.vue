<script setup lang="ts">
// Floating joystick: put your thumb down anywhere, drag. With a `meter` it is also the fox-hunt receiver,
// with a `button` label there is an action button for the other thumb.
import type { PlayerInput } from '#shared/protocol';
import { useFoxRadio } from '~/composables/useFoxRadio';

const props = defineProps<{
  send: (msg: PlayerInput) => boolean;
  hint: string;
  signal: string;
  /** Fox signal 0..1: shows the meter and plays the beacon. */
  meter?: number;
  /** Action button label: shows the button. */
  button?: string;
}>();

interface Point { x: number; y: number }

const R = 80; // drag radius, px
let origin: Point | null = null; // where the thumb went down, client coords
let thumb: number | undefined; // the joystick's pointer: another finger on the pad must not move or release it
const SEND_MS = 33; // at most ~30 stick messages a second
let last = 0;
let latest: Point = { x: 0, y: 0 };
let pending: ReturnType<typeof setTimeout> | undefined;
/** Trailing-edge throttle: the last position always goes out (at most SEND_MS late), or rate-controlled
 *  games (ISS antennas, Fox Hunt) would keep going at a stale speed. */
function flush() {
  pending = undefined;
  last = performance.now();
  props.send({ t: 'stick', ...latest });
}
// Pad-relative, only while a thumb is down.
const ring = ref<Point>();
const knob = ref<Point>();
const at = (p: Point) => ({ left: `${p.x}px`, top: `${p.y}px` });

function down(e: PointerEvent) {
  if (origin) return;
  const pad = e.currentTarget as HTMLElement;
  pad.setPointerCapture(e.pointerId);
  thumb = e.pointerId;
  origin = { x: e.clientX, y: e.clientY };
  const r = pad.getBoundingClientRect();
  ring.value = knob.value = { x: origin.x - r.left, y: origin.y - r.top };
}

function move(e: PointerEvent) {
  if (!origin || e.pointerId !== thumb) return;
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  let x = e.clientX - origin.x;
  let y = e.clientY - origin.y;
  const d = Math.hypot(x, y);
  if (d > R) {
    x *= R / d;
    y *= R / d;
  }
  knob.value = { x: origin.x - r.left + x, y: origin.y - r.top + y };
  latest = { x: x / R, y: y / R };
  if (pending) return;
  const wait = SEND_MS - (performance.now() - last);
  if (wait <= 0) flush();
  else pending = setTimeout(flush, wait);
}

function up(e: PointerEvent) {
  if (e.pointerId !== thumb) return;
  origin = null;
  thumb = undefined;
  ring.value = knob.value = undefined;
  clearTimeout(pending);
  pending = undefined;
  props.send({ t: 'stick', x: 0, y: 0 });
}

const held = ref<number>(); // the action button's pointer while pressed

function press(e: PointerEvent) {
  if (held.value !== undefined) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  held.value = e.pointerId;
  navigator.vibrate?.(15);
  props.send({ t: 'button', down: true });
}

function release(e: PointerEvent) {
  if (e.pointerId !== held.value) return;
  held.value = undefined;
  props.send({ t: 'button', down: false });
}

// Controller replaced under a held finger: let go, or the game would think it is still pressed.
onUnmounted(() => {
  clearTimeout(pending);
  if (held.value !== undefined) props.send({ t: 'button', down: false });
});

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
    <button
      v-if="button"
      class="action"
      :class="{ pressed: held !== undefined }"
      @pointerdown="press"
      @pointerup="release"
      @pointercancel="release"
    >
      {{ button }}
    </button>
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
/* Thumb-sized, pushed down like the telegraph key. */
.action { align-self: center; flex: none; width: min(30vw, 18vh); aspect-ratio: 1; margin-bottom: 8px; border: 0; border-radius: 50%; background: var(--me); box-shadow: 0 8px 0 color-mix(in srgb, var(--me) 50%, #000); color: #10231a; font: inherit; font-size: 1.1em; font-weight: 800; padding: .3em; touch-action: none; }
.action.pressed { transform: translateY(6px); box-shadow: 0 2px 0 color-mix(in srgb, var(--me) 50%, #000); }
</style>
