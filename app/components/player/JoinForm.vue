<script setup lang="ts">
import { NAME_MAX } from '#shared/protocol';

defineProps<{ placeholder: string; button: string }>();
const emit = defineEmits<{ join: [name: string] }>();

// Storage can throw when the browser blocks it: then we just don't remember the name.
function savedName() {
  try {
    return localStorage.getItem('jjName') ?? '';
  } catch {
    return '';
  }
}

const name = ref(savedName());

function submit() {
  const n = name.value.trim().slice(0, NAME_MAX) || 'Scout';
  try {
    localStorage.setItem('jjName', n);
  } catch {
    // not remembered, still joins
  }
  emit('join', n);
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="name" :placeholder :maxlength="NAME_MAX" autocomplete="off" required>
    <button>{{ button }}</button>
  </form>
</template>

<style scoped>
form { display: flex; flex-direction: column; gap: .8em; width: min(100%, 22em); }
input { font: inherit; padding: .8em; border-radius: .6em; border: 2px solid var(--muted); background: var(--panel); color: var(--text); }
button { font: inherit; font-weight: 800; border: 0; border-radius: .6em; padding: .9em; color: #10231a; background: var(--fire); touch-action: manipulation; }
</style>
