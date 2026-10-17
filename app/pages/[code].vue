<script setup lang="ts">
// The phone: join with a name, then show whatever controller the big screen asks for.
import { ROOM_CODE } from '#shared/protocol';
import { usePlayerConnection } from '~/composables/usePlayerConnection';
import { unlockAudio } from '~/utils/morseAudio';

definePageMeta({ validate: route => ROOM_CODE.test(String(route.params.code).toUpperCase()) }); // short join link: /ABCD

const room = String(useRoute().params.code).toUpperCase();
const { ui, status, lang, t, join, send } = usePlayerConnection(room);

useHead({
  title: 'JOTA-JOTI Controller',
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' }],
  htmlAttrs: { lang, style: 'overscroll-behavior: none' },
  bodyAttrs: { style: 'overscroll-behavior: none' },
});

const name = ref<string>();
// The host bumps `round` to force a fresh controller even when the layout stays the same.
const controller = computed(() => `${ui.value.layout}:${ui.value.round}`);

function onJoin(playerName: string) {
  unlockAudio(); // unlock sound while we still have the user's tap
  name.value = playerName;
  join(playerName);
}
</script>

<template>
  <div class="phone" :data-layout="ui.layout" :style="{ '--me': ui.color }">
    <header>
      <span class="av">{{ ui.avatar ?? '⚜️' }}</span>
      <span>{{ name ?? 'JOTA-JOTI' }}</span>
      <span class="status">{{ status }}</span>
    </header>
    <main>
      <div class="text">{{ ui.text }}</div>
      <div class="sub">{{ ui.sub }}</div>
      <div class="ctl">
        <PlayerJoinForm v-if="!name" :placeholder="t.name" :button="t.join" @join="onJoin" />
        <PlayerStickPad v-else-if="ui.layout === 'stick'" :key="controller" :send :hint="t.drag" :signal="t.signal" :meter="ui.meter" />
        <PlayerTelegraphKey v-else-if="ui.layout === 'key'" :key="controller" :send :label="t.key" />
        <PlayerChoiceButtons v-else-if="ui.layout === 'choices'" :key="controller" :send :options="ui.options ?? []" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.phone { --me: var(--fire); height: 100%; display: flex; flex-direction: column; font: 600 18px/1.3 system-ui, sans-serif; touch-action: none; }
.phone, .phone :deep(*) { -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.phone :deep(input) { user-select: text; -webkit-user-select: text; }
header { display: flex; align-items: center; gap: .5em; padding: .6em 1em; background: var(--panel); border-bottom: 5px solid var(--me); }
.av { font-size: 1.7em; line-height: 1; }
.status { margin-left: auto; color: var(--muted); font-size: .8em; }
main { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .8em; padding: 1em; text-align: center; }
.text { font-size: 1.7em; font-weight: 800; letter-spacing: .02em; }
.sub { color: var(--muted); min-height: 1.3em; white-space: pre-line; }
.ctl { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .8em; position: relative; min-height: 0; }
.ctl:empty { display: none; }
.phone[data-layout=choices] .text { font-size: 1.25em; } /* the quiz question itself */
.phone[data-layout=choices] main { justify-content: flex-start; }
</style>
