<script setup lang="ts">
import { LANGS } from '#shared/protocol';
import type { Lang } from '#shared/protocol';

const lang = defineModel<Lang>({ required: true });
</script>

<template>
  <div class="langs">
    <button v-for="l in LANGS" :key="l" :class="{ on: l === lang }" @click="lang = l">{{ l.toUpperCase() }}</button>
  </div>
</template>

<style scoped>
.langs { display: inline-flex; align-self: center; border: 2px solid var(--line); border-radius: .5em; overflow: hidden; }
button { font: 800 .8em system-ui, sans-serif; background: none; color: var(--muted); border: 0; padding: .3em .7em; cursor: pointer; }
button.on { background: var(--fire); color: var(--bg); }
</style>
