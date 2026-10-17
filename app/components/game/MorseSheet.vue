<script setup lang="ts">
// The Morse code sheet for the big screen: A-Z (and 0-9 with `digits`), one cell per character that never wraps.
// `highlight`: characters to light up (e.g. those in the current answers); the others fade back.
// <GameMorseSheet /> · <GameMorseSheet digits /> · <GameMorseSheet :highlight="options.join('')" />
import { CODE, prettyMorse } from '#shared/morse';

const props = withDefaults(defineProps<{ digits?: boolean; highlight?: string }>(), { digits: false, highlight: '' });

const LETTERS = Object.keys(CODE).filter(c => c > '9');
const DIGITS = Object.keys(CODE).filter(c => c <= '9');
const cells = computed(() => (props.digits ? [...LETTERS, ...DIGITS] : LETTERS).map(c => [c, [...prettyMorse(CODE[c] ?? '')]] as const));
const lit = computed(() => new Set(props.highlight.toUpperCase()));
</script>

<template>
  <div class="morse-sheet" :class="{ picking: lit.size, digits }">
    <span v-for="[c, symbols] in cells" :key="c" :class="{ hi: lit.has(c) }">
      <b>{{ c }}</b><span><i v-for="(s, i) in symbols" :key="i" :class="{ dit: s === '·' }">{{ s }}</i></span>
    </span>
  </div>
</template>

<style scoped>
.morse-sheet { display: grid; grid-template-columns: repeat(13, minmax(0, 1fr)); gap: .3em; font: 700 1em ui-monospace, monospace; }
/* A digit's five symbols need ~5em: as many columns as fit instead of 13. */
.morse-sheet.digits { grid-template-columns: repeat(auto-fill, minmax(5em, 1fr)); }
.morse-sheet > span { display: flex; justify-content: space-between; gap: .3em; white-space: nowrap; background: var(--panel); border: 2px solid transparent; border-radius: .3em; padding: .15em .4em; transition: opacity .3s; }
.morse-sheet b { color: var(--fire); }
.morse-sheet i { font-style: normal; }
.morse-sheet i.dit { display: inline-block; transform: scale(1.6); } /* '·' is a speck next to '−' */
.morse-sheet.picking > span:not(.hi) { opacity: .4; }
.morse-sheet > span.hi { border-color: var(--fire); }
</style>
