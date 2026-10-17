<script setup lang="ts">
// The big screen: lobby with QR code, scouts and game cards. A running game takes over the whole screen.
import { medal, useHostSession } from '~/composables/useHostSession';
import { useKeyboardPlayers } from '~/composables/useKeyboardPlayers';
import { GAMES } from '~/games';
import type { GameDefinition } from '~/games/types';

const session = useHostSession();
const { players, run, room, lang, t, lastRanked, startGame, endGame } = session;
useKeyboardPlayers(session);
useHead({ title: 'JOTA-JOTI Games', htmlAttrs: { lang } });

const list = computed(() => [...players.values()]);
const online = computed(() => list.value.filter(p => p.online).length);

const toast = ref({ text: '', shown: false });
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(text: string) {
  toast.value = { text, shown: true };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value.shown = false), 2500);
}
onUnmounted(() => clearTimeout(toastTimer));

function pick(game: GameDefinition) {
  if (!players.size) return showToast(t.value.first);
  void startGame(game);
}
</script>

<template>
  <div class="host">
    <div v-show="!run" class="lobby">
      <header>
        <h1>📻 JOTA-JOTI <span>{{ t.games }}</span></h1>
        <div class="room">{{ t.room }} <b>{{ room.code || '····' }}</b></div>
        <HostLangSwitch v-model="lang" />
      </header>
      <div class="grid">
        <HostJoinPanel :qr="room.qr" :url="room.url" :tunnel="room.tunnel" :t="t" />
        <section class="right">
          <h2>{{ t.scouts }} {{ list.length ? `(${online})` : '' }}</h2>
          <div class="players">
            <HostPlayerChip v-for="p in list" :key="p.id" :player="p" />
            <span v-if="!list.length" class="muted">{{ t.waiting }}</span>
          </div>
          <div class="muted">{{ t.keys.before }} <kbd>{{ t.keys.space }}</kbd> {{ t.keys.wasd }} <kbd>{{ t.keys.enter }}</kbd> {{ t.keys.arrows }}</div>
          <div v-if="lastRanked" class="results">
            <b>{{ t.last }}</b>
            <span v-for="([p, s], i) in lastRanked" :key="p.id">{{ medal(i) }} {{ p.avatar }} {{ p.name }} <b>{{ s }}</b></span>
          </div>
          <h2>{{ t.pick }}</h2>
          <div class="games">
            <HostGameCard v-for="g in GAMES" :key="g.id" :emoji="g.emoji" :info="g.info[lang]" @click="pick(g)" />
          </div>
        </section>
      </div>
    </div>
    <HostGameStage v-if="run" :key="run.id" :run="run" :join-url="room.url" :t="t" @exit="endGame()" />
    <div class="toast" :style="{ opacity: toast.shown ? 1 : 0 }">{{ toast.text }}</div>
  </div>
</template>

<style scoped>
/* Big-screen type and backdrop live here, not on html/body: the phone page has its own. */
.host { height: 100%; font: 600 clamp(13px, min(1.45vw, 2.5vh), 40px)/1.35 system-ui, sans-serif; background: radial-gradient(ellipse at 50% -20%, #24503a, var(--bg) 60%, #08130e); background-color: var(--bg); }

.lobby { height: 100%; overflow-y: auto; display: flex; flex-direction: column; padding: 1.4em 3vw; gap: 1.2em; } /* scrolls instead of clipping if a crowd still doesn't fit */
.lobby > header { display: flex; align-items: baseline; gap: 1em; }
h1 { font-size: 2.6em; font-weight: 900; letter-spacing: -.02em; }
h1 span { color: var(--fire); }
.room { margin-left: auto; color: var(--muted); }
.room b { color: var(--text); font: 900 1.6em ui-monospace, monospace; letter-spacing: .15em; }
.grid { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2.1fr); gap: 3vw; }
.right { display: flex; flex-direction: column; gap: 1em; min-height: 0; }
h2 { font-size: 1.2em; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }
.players { display: flex; flex-wrap: wrap; gap: .5em; min-height: 2.6em; }
.games { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.2vw; }
.results { background: linear-gradient(90deg, #3b2a0a, var(--panel)); border: 2px solid var(--fire); border-radius: 1em; padding: .7em 1em; display: flex; flex-wrap: wrap; gap: .4em 1.4em; align-items: center; }
.toast { position: fixed; bottom: 2vw; left: 50%; transform: translateX(-50%); background: var(--fire); color: var(--bg); padding: .6em 1.2em; border-radius: .6em; font-weight: 800; transition: opacity .3s; }
</style>
