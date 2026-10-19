<script setup lang="ts">
// A phone that opened the site without a room code: how to get into a game, and why it needs a big screen.
import { detectLang, ROOM_CODE, type Lang } from '#shared/protocol';

const emit = defineEmits<{ host: [] }>();

const en = {
  title: 'Join a game',
  how: 'Scan the QR code on the big screen, or type its room code:',
  code: 'ABCD',
  join: 'Join 📻',
  why: 'The games run on a big screen: open this website on a laptop or beamer, and your phone becomes the controller.',
  host: 'Use this device as the big screen',
};
const de: typeof en = {
  title: 'Spiel beitreten',
  how: 'Scanne den QR-Code auf dem großen Bildschirm oder tipp seinen Raum-Code ein:',
  code: 'ABCD',
  join: 'Mitmachen 📻',
  why: 'Die Spiele laufen auf einem großen Bildschirm: Öffne diese Website auf einem Laptop oder Beamer, dein Handy wird dann zum Controller.',
  host: 'Dieses Gerät als großen Bildschirm nutzen',
};
const TXT: Record<Lang, typeof en> = { en, de };
const t = TXT[detectLang()];
useHead({ title: 'JOTA-JOTI Games' });

const code = ref('');
const go = () => ROOM_CODE.test(code.value) && navigateTo(`/${code.value}`);
// Letters only, upper case; four of them go straight to the room.
watch(code, c => {
  const clean = c.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (clean !== c) code.value = clean;
  else void go();
});
</script>

<template>
  <div class="landing">
    <h1>📻 JOTA-JOTI</h1>
    <h2>{{ t.title }}</h2>
    <p>{{ t.how }}</p>
    <form @submit.prevent="go">
      <input v-model="code" :placeholder="t.code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go">
      <button :disabled="code.length < 4">{{ t.join }}</button>
    </form>
    <p class="why">🖥️ {{ t.why }}</p>
    <button class="host" @click="emit('host')">{{ t.host }}</button>
  </div>
</template>

<style scoped>
.landing { height: 100%; overflow-y: auto; display: flex; flex-direction: column; justify-content: center; gap: .9em; padding: 1.5em; font: 600 18px/1.35 system-ui, sans-serif; text-align: center; }
h1 { font-size: 1.6em; font-weight: 900; color: var(--fire); }
h2 { font-size: 1.5em; }
p { margin: 0; }
form { display: flex; flex-direction: column; gap: .7em; width: min(100%, 18em); align-self: center; }
input { font: 900 2em ui-monospace, monospace; letter-spacing: .3em; text-align: center; text-transform: uppercase; padding: .35em; border-radius: .4em; border: 2px solid var(--muted); background: var(--panel); color: var(--text); }
input::placeholder { color: #ffffff33; }
button { font: inherit; font-weight: 800; border: 0; border-radius: .6em; padding: .9em; color: var(--bg); background: var(--fire); }
button:disabled { opacity: .4; }
.why { color: var(--muted); font-weight: 500; margin-top: .6em; }
.host { background: none; color: var(--muted); text-decoration: underline; padding: .4em; font-weight: 600; }
</style>
