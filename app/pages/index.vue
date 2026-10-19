<script setup lang="ts">
// The site's entry. A laptop or beamer becomes the big screen; a phone gets the way into a game instead,
// so it doesn't open a lobby (and a room nobody can join) by accident.

/** Touch screen with a short side like a phone. A tablet can still choose to be the big screen. */
const looksLikePhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
/** This tab has been a big screen before (it holds a room): stay one after a reload. */
function wasBigScreen() {
  try {
    return !!sessionStorage.getItem('jjRoom');
  } catch {
    return false;
  }
}

const bigScreen = ref(!looksLikePhone() || wasBigScreen());
</script>

<template>
  <HostBigScreen v-if="bigScreen" />
  <PlayerJoinRoom v-else @host="bigScreen = true" />
</template>
