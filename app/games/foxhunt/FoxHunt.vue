<script setup lang="ts">
// Fox Hunt (ARDF): a hidden transmitter is somewhere in the forest. Every scout's phone
// plays its "MO" beacon, louder and faster the closer they get. Touch the fox to catch it.
import * as Phaser from 'phaser';
import type { Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import type { GameInput, Player } from '~/games/types';

const W = 1600, H = 900, SPEED = 320, CATCH = 36, HEAR = 1100, GAME_S = 180, WIN = 5;
const SCOUT_R = 22, TREE_R = 26;

const en = {
  hint: 'Follow your radio! 📡 The beeps get louder and faster near the fox 🦊',
  goal: `🏆 First to ${WIN}`,
  wins: 'wins!',
  away: 'The fox got away!',
  find: '🦊 Find the fox!',
  caught: 'Foxes caught',
  got: '🦊 Caught it!',
};
const de: typeof en = {
  hint: 'Folge deinem Funkgerät! 📡 Nah am Fuchs piept es lauter und schneller 🦊',
  goal: `🏆 Ziel: ${WIN} Füchse`,
  wins: 'gewinnt!',
  away: 'Der Fuchs ist entkommen!',
  find: '🦊 Finde den Fuchs!',
  caught: 'Gefangene Füchse',
  got: '🦊 Erwischt!',
};
const TXT: Record<Lang, typeof en> = { en, de };

interface Point { x: number; y: number }

interface Scout {
  box: Phaser.GameObjects.Container;
  /** Signal meter above the scout's head. */
  bar: Phaser.GameObjects.Rectangle;
  /** Stick direction, -1..1. */
  vx: number;
  vy: number;
  /** Fox signal, 0..1. */
  sig: number;
  /** Signal the phone last got. Starts at -1, so the first update() also sends the stick controller. */
  sentSig: number;
  sentAt: number;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
const stage = useTemplateRef<HTMLDivElement>('stage');

// Game state. Plain variables, never ref(): Vue must not wrap Phaser objects in proxies.
const scouts = new Map<Player, Scout>();
const score = new Map<Player, number>(ctx.players.map(p => [p, 0]));
const trees: Point[] = [];
let game: Phaser.Game | undefined;
/** The scene, once Phaser has booted and run create(). */
let booted: Phaser.Scene | undefined;
let fox: Point, clock: Phaser.GameObjects.Text, board: Phaser.GameObjects.Text; // set in setUp()
let timeLeft = GAME_S, over = false, endTimer: ReturnType<typeof setTimeout> | undefined;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const free = (x: number, y: number, r: number) => trees.every(tree => Math.hypot(tree.x - x, tree.y - y) > r);
const text = (scene: Phaser.Scene, x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
  scene.add.text(x, y, s, { fontFamily: 'system-ui, sans-serif', ...style });
const ranking = () => [...score].sort((a, b) => b[1] - a[1]);

onMounted(() => {
  game = new Phaser.Game({
    type: Phaser.AUTO, parent: stage.value, width: W, height: H, backgroundColor: '#2b5236',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false }, // the host page handles the keyboard
    scene: {
      create(this: Phaser.Scene) { booted = this; setUp(this); },
      update(this: Phaser.Scene, _time: number, delta: number) { tick(this, Math.min(delta, 50) / 1000); },
    },
  });
});

onUnmounted(() => {
  clearTimeout(endTimer);
  game?.destroy(true);
});

function setUp(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  for (let i = 0; i < 120; i++) g.fillStyle(Math.random() < .5 ? 0x24472e : 0x335f3f, .6).fillCircle(rnd(0, W), rnd(0, H), rnd(20, 90));
  for (let i = 0; i < 40; i++) text(scene, rnd(0, W), rnd(0, H), Phaser.Utils.Array.GetRandom(['🌿', '🍄', '🪨', '🌾']), { fontSize: '22px' }).setOrigin(.5).setAlpha(.7);
  text(scene, W / 2, H / 2, '⛺', { fontSize: '64px' }).setOrigin(.5);
  for (let tries = 0; trees.length < 50 && tries < 2000; tries++) {
    const x = rnd(40, W - 40), y = rnd(40, H - 40);
    if (Math.hypot(x - W / 2, y - H / 2) > 170 && free(x, y, 85)) {
      trees.push({ x, y });
      text(scene, x, y, Math.random() < .6 ? '🌲' : '🌳', { fontSize: '58px' }).setOrigin(.5, .7).setDepth(y);
    }
  }
  clock = text(scene, 24, 18, '', { fontSize: '40px', fontStyle: 'bold', color: '#fff', backgroundColor: '#0008', padding: { x: 14, y: 6 } }).setDepth(H + 10);
  board = text(scene, W - 24, 18, '', { fontSize: '28px', color: '#fff', backgroundColor: '#0008', padding: { x: 14, y: 10 }, lineSpacing: 6, align: 'left' }).setOrigin(1, 0).setDepth(H + 10);
  text(scene, W / 2, H - 30, t.hint, { fontSize: '24px', color: '#fff', backgroundColor: '#0008', padding: { x: 12, y: 6 } }).setOrigin(.5).setDepth(H + 10);
  for (const p of score.keys()) addScout(scene, p); // includes anyone who joined while Phaser was booting
  fox = hidingSpot();
  drawBoard();
}

function addScout(scene: Phaser.Scene, p: Player) {
  const a = scouts.size * 2.4, x = W / 2 + Math.cos(a) * 110, y = H / 2 + Math.sin(a) * 90;
  const name = text(scene, 0, 34, p.name, { fontSize: '20px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(.5);
  const bar = scene.add.rectangle(-24, -36, 48, 7, 0xffd23f).setOrigin(0, .5);
  const box = scene.add.container(x, y, [
    scene.add.ellipse(0, 20, 40, 12, 0x000000, .3),
    scene.add.circle(0, 0, SCOUT_R, Phaser.Display.Color.HexStringToColor(p.color).color).setStrokeStyle(3, 0xffffff),
    text(scene, 0, 0, p.avatar, { fontSize: '28px' }).setOrigin(.5),
    name, scene.add.rectangle(-24, -36, 48, 7, 0x000000, .5).setOrigin(0, .5), bar,
  ]);
  scouts.set(p, { box, bar, vx: 0, vy: 0, sig: 0, sentSig: -1, sentAt: 0 });
}

// New fox spot: clear of trees and far from every scout.
function hidingSpot(): Point {
  for (let tries = 0; tries < 500; tries++) {
    const x = rnd(60, W - 60), y = rnd(80, H - 80);
    if (free(x, y, 60) && [...scouts.values()].every(s => Math.hypot(s.box.x - x, s.box.y - y) > 450)) return { x, y };
  }
  return { x: rnd(60, W - 60), y: rnd(80, H - 80) };
}

function tick(scene: Phaser.Scene, dt: number) {
  if (over) return;
  timeLeft -= dt;
  const left = Math.ceil(Math.max(0, timeLeft)); // round once: 179.5 s must read 3:00, not 2:00
  clock.setText(`⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
  if (timeLeft <= 0) return finish(scene);
  const now = scene.time.now;
  for (const [p, s] of scouts) {
    const b = s.box;
    b.x = Phaser.Math.Clamp(b.x + s.vx * SPEED * dt, SCOUT_R, W - SCOUT_R);
    b.y = Phaser.Math.Clamp(b.y + s.vy * SPEED * dt, SCOUT_R, H - SCOUT_R);
    for (const tree of trees) { // push out of tree trunks
      const dx = b.x - tree.x, dy = b.y - tree.y, d = Math.hypot(dx, dy), min = SCOUT_R + TREE_R;
      if (d < min && d > 0) { b.x = tree.x + dx / d * min; b.y = tree.y + dy / d * min; }
    }
    b.setDepth(b.y);
    const d = Math.hypot(b.x - fox.x, b.y - fox.y);
    s.sig = Math.max(0, 1 - d / HEAR) ** 2;
    s.bar.width = 48 * s.sig;
    if (d < CATCH) return caught(scene, p);
    if (now - s.sentAt > 200 && Math.abs(s.sig - s.sentSig) > .02) {
      s.sentAt = now;
      s.sentSig = s.sig;
      ctx.send(p, { layout: 'stick', meter: +s.sig.toFixed(2), text: t.find, sub: `${t.caught}: ${score.get(p) ?? 0}` });
    }
  }
}

function caught(scene: Phaser.Scene, p: Player) {
  const n = (score.get(p) ?? 0) + 1;
  score.set(p, n);
  const f = text(scene, fox.x, fox.y, '🦊', { fontSize: '80px' }).setOrigin(.5).setDepth(H + 5).setScale(0);
  scene.tweens.add({ targets: f, scale: 1.3, duration: 250, yoyo: true, hold: 600, onComplete: () => f.destroy() });
  const msg = text(scene, fox.x, fox.y - 60, `${p.avatar} ${p.name} +1`, { fontSize: '34px', fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 6 }).setOrigin(.5).setDepth(H + 6);
  scene.tweens.add({ targets: msg, y: fox.y - 140, alpha: 0, duration: 1600, onComplete: () => msg.destroy() });
  scene.cameras.main.flash(200, 255, 220, 120);
  ctx.send(p, { layout: 'stick', meter: 0, text: t.got, sub: `${t.caught}: ${n}`, buzz: 300 });
  for (const s of scouts.values()) s.sentSig = -1; // force a fresh signal to everyone
  drawBoard();
  if (n >= WIN) return finish(scene);
  fox = hidingSpot();
}

function drawBoard() {
  board.setText([t.goal, ...ranking().map(([p, n]) => `${p.avatar} ${p.name.padEnd(10)} ${'🦊'.repeat(n) || '–'}`)].join('\n'));
}

function finish(scene: Phaser.Scene) {
  over = true;
  const [best, n] = ranking()[0] ?? [];
  text(scene, fox.x, fox.y, '🦊', { fontSize: '80px' }).setOrigin(.5).setDepth(H + 5); // reveal the last hiding spot
  text(scene, W / 2, H / 2, best && n ? `${best.avatar} ${best.name} ${t.wins}` : t.away, { fontSize: '90px', fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 10 }).setOrigin(.5).setDepth(H + 20);
  endTimer = setTimeout(() => ctx.end([...score]), 4000);
}

function input(p: Player, msg: GameInput) {
  const s = scouts.get(p);
  if (!s) return;
  if (msg.t === 'stick') { s.vx = msg.x; s.vy = msg.y; } // parseInput() already clamped them to -1..1
  if (msg.t === 'presence') s.vx = s.vy = 0; // dropped or reconnected: stop until they touch the stick again
}

function join(p: Player) {
  score.set(p, 0);
  if (booted) { addScout(booted, p); drawBoard(); } // still booting: setUp() adds them, it iterates the score keys
}
</script>

<template>
  <div ref="stage" class="forest" />
</template>

<style scoped>
.forest { height: 100%; }
</style>
