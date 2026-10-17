<script setup lang="ts">
// Capture the Flag ("Fahnenklau"), the action game: two patrols, two halves, two flags. Tag intruders in your
// half (they go to your jail), grab the enemy flag and carry it home. rules.ts plays the game; this draws it.
import type { ControllerUi, Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import { addPlayerToken, addText, hex, Phaser, usePhaserGame } from '~/games/kit/phaser';
import { between, pick } from '~/games/kit/random';
import { joinTeam, makeTeams } from '~/games/kit/teams';
import type { GameInput, Player } from '~/games/types';
import {
  addRunner, createWorld, dash, DASH_COOLDOWN_S, FIELD_Y, finalScores, FLAG_BASES, FLAG_REACH, GUARD_R, H, JAILS, leader, MID,
  OBSTACLES, other, R, setGhost, situation, step, steer, TOP, W,
  type Event, type Runner, type Side, type Situation,
} from './rules';

const GAME_S = 180, CAPTURES_TO_WIN = 3;
const START_S = 3; // 3·2·1 before the whistle
const CAPTURE_FREEZE_S = 1.5; // everyone slides back to their line, then play on
const END_S = 4;
const FEED_S = 4, FEED_MAX = 5; // kill-feed lines: how long each stays, how many at once
const HINT_S = 12;
const SEND_MS = 200; // phone status at most this often: someone dancing on the centre line must not flood the relay
const BUZZ = { tagged: 300, tagger: 40, freed: [60, 40, 60], grab: 100, stolen: [200], capture: [100, 60, 100, 60, 200] };
const UI = H + 10; // depth above every token (tokens sort by y)

const en = {
  dash: 'DASH 💨',
  defend: '🛡️ Defend — tag intruders!',
  attack: '⚔️ Grab their flag!',
  carry: '🚩 Run home!',
  jail: '⛓️ In jail — wait for a jailbreak!',
  hint: 'Tag intruders in your half · grab the enemy flag · Dash = button',
  goal: `🚩 First to ${CAPTURES_TO_WIN}`,
  go: 'GO!',
  capture: '🚩 CAPTURE!',
  jailbreak: '⛓️ JAILBREAK!',
  draw: '🤝 Draw!',
  wins: (team: string) => `🏆 ${team} win!`,
  tagged: (a: string, b: string) => `${a} tagged ${b}`,
  freed: (a: string) => `⛓️ Jailbreak by ${a}!`,
  grabbed: (a: string) => `🚩 ${a} grabbed the flag!`,
  returned: (a: string) => `↩️ ${a} brought the flag back`,
  scored: (a: string) => `🚩 ${a} captured the flag!`,
};
const de: typeof en = {
  dash: 'SPRINT 💨',
  defend: '🛡️ Verteidigen – fang Eindringlinge!',
  attack: '⚔️ Schnapp dir ihre Fahne!',
  carry: '🚩 Lauf heim!',
  jail: '⛓️ Im Gefängnis – warte auf Befreiung!',
  hint: 'Fang Eindringlinge in deiner Hälfte · klau die gegnerische Fahne · Sprint = Knopf',
  goal: `🚩 Ziel: ${CAPTURES_TO_WIN} Fahnen`,
  go: 'LOS!',
  capture: '🚩 FAHNENKLAU!',
  jailbreak: '⛓️ AUSBRUCH!',
  draw: '🤝 Unentschieden!',
  wins: team => `🏆 ${team} gewinnen!`,
  tagged: (a, b) => `${a} hat ${b} gefangen`,
  freed: a => `⛓️ Befreiung durch ${a}!`,
  grabbed: a => `🚩 ${a} hat die Fahne!`,
  returned: a => `↩️ ${a} holt die Fahne zurück`,
  scored: a => `🚩 ${a} bringt die Fahne heim!`,
};
const TXT: Record<Lang, typeof en> = { en, de };

interface Token {
  r: Runner<Player>;
  box: Phaser.GameObjects.Container;
  /** Status the phone shows, and when it got it. */
  said: string;
  saidAt: number;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
const STATUS: Record<Situation, string> = { jail: t.jail, carry: t.carry, defend: t.defend, attack: t.attack };
const stage = useTemplateRef<HTMLDivElement>('stage');
// Deal the scouts who are here; offline ones (locked phones) go in after, so they can't unbalance the teams.
const teams = makeTeams(ctx.players.filter(p => p.online), ctx.lang, 2);
for (const p of ctx.players) if (!p.online) joinTeam(teams, p);
/** The two teams by Side (same objects as `teams`). */
const patrol = [teams[0]!, teams[1]!] as const;
const tint = [hex(patrol[0].color), hex(patrol[1].color)] as const;
const world = createWorld<Player>([patrol[0].players, patrol[1].players]);
const runners = new Map(world.runners.map(r => [r.p, r]));
for (const r of world.runners) if (!r.p.online) setGhost(world, r, true);
/** Unique per game, so a phone coming from another stick game gets a fresh controller. */
const ROUND = Date.now();

// Phaser objects: plain variables, never ref(). Set in setUp().
const tokens = new Map<Player, Token>();
const events: Event<Player>[] = []; // reused every frame
const feed: Phaser.GameObjects.Text[] = [];
let booted: Phaser.Scene | undefined;
let fx: Phaser.GameObjects.Graphics, score: Phaser.GameObjects.Text, clock: Phaser.GameObjects.Text;
let dust: Phaser.GameObjects.Particles.ParticleEmitter, burst: Phaser.GameObjects.Particles.ParticleEmitter;
let confetti: Phaser.GameObjects.Particles.ParticleEmitter;
let flags: [Phaser.GameObjects.Container, Phaser.GameObjects.Container];
let timeLeft = GAME_S, frozen = START_S, counting = true, shownCount = -1, shownSecond = -1, over = false;
let endTimer: ReturnType<typeof setTimeout> | undefined;

const who = (r: Runner<Player>) => `${r.p.avatar} ${r.p.name}`;
const scoreLine = () => {
  const [a, b] = patrol;
  return `${a.emoji} ${a.name}  ${world.captures[0]} : ${world.captures[1]}  ${b.name} ${b.emoji}`;
};

usePhaserGame(stage, {
  backgroundColor: '#2b5236',
  scene: {
    create(this: Phaser.Scene) { setUp(this); },
    update(this: Phaser.Scene, _time: number, delta: number) { tick(this, Math.min(delta, 50) / 1000); },
  },
});
onUnmounted(() => clearTimeout(endTimer));

function setUp(scene: Phaser.Scene) {
  booted = scene;
  const g = scene.make.graphics({}, false); // particle textures: a dot (dust, bursts) and a confetti bit
  g.fillStyle(0xffffff).fillCircle(6, 6, 6).generateTexture('cf-dot', 12, 12);
  g.clear().fillStyle(0xffffff).fillRect(0, 0, 12, 7).generateTexture('cf-bit', 12, 7);
  g.destroy();
  drawField(scene);
  drawHud(scene);
  fx = scene.add.graphics().setDepth(UI - 1);
  dust = scene.add.particles(0, 0, 'cf-dot', { emitting: false, lifespan: 450, speed: { min: 10, max: 50 }, scale: { start: 1.1, end: 0 }, alpha: { start: 0.55, end: 0 }, tint: 0xe8dcb5 }).setDepth(2);
  burst = scene.add.particles(0, 0, 'cf-dot', { emitting: false, lifespan: 650, speed: { min: 120, max: 380 }, scale: { start: 1.5, end: 0 }, alpha: { start: 1, end: 0 } }).setDepth(UI - 2);
  confetti = scene.add.particles(0, 0, 'cf-bit', { emitting: false, lifespan: 2400, speed: { min: 300, max: 800 }, angle: { min: 200, max: 340 }, gravityY: 700, rotate: { start: 0, end: 720 }, scale: { min: 0.8, max: 1.6 } }).setDepth(UI + 3);
  flags = [addFlag(scene, 0), addFlag(scene, 1)];
  for (const r of world.runners) addToken(scene, r); // includes anyone who joined while Phaser was booting
  const hint = addText(scene, MID, H - 14, t.hint, { fontSize: '26px', color: '#fff', backgroundColor: '#000a', padding: { x: 14, y: 6 } }).setOrigin(0.5, 1).setDepth(UI);
  scene.tweens.add({ targets: hint, alpha: 0, delay: HINT_S * 1000, duration: 800, onComplete: () => hint.destroy() });
}

function drawField(scene: Phaser.Scene) {
  const g = scene.make.graphics({}, false);
  for (let i = 0; i < 90; i++) g.fillStyle(Math.random() < 0.5 ? 0x24472e : 0x335f3f, 0.5).fillCircle(between(0, W), between(TOP, H), between(20, 80));
  for (const s of [0, 1] as const) {
    const team = patrol[s], base = FLAG_BASES[s], j = JAILS[s];
    g.fillStyle(tint[s], 0.1).fillRect(s * MID, TOP, MID, H - TOP); // each half in its patrol's colour
    addText(scene, MID / 2 + s * MID, FIELD_Y, `${team.emoji} ${team.name.toUpperCase()}`, { fontSize: '96px', fontStyle: 'bold', color: team.color }).setOrigin(0.5).setAlpha(0.13);
    // The no-guarding circle, and the flag's touch spot inside it.
    g.fillStyle(tint[s], 0.1).fillCircle(base.x, base.y, GUARD_R).lineStyle(4, tint[s], 0.8).strokeCircle(base.x, base.y, GUARD_R);
    g.fillStyle(tint[s], 0.25).fillCircle(base.x, base.y, FLAG_REACH);
    g.fillStyle(0x111111, 0.45).fillRect(j.x, j.y, j.w, j.h);
    // Bars and fence above the prisoners, so they really look locked up.
    const bars = scene.add.graphics().setDepth(UI - 3).lineStyle(3, 0xcfd8dc, 0.6);
    for (let x = j.x + 10; x < j.x + j.w; x += 20) bars.lineBetween(x, j.y, x, j.y + j.h);
    bars.lineStyle(7, tint[s]).strokeRect(j.x + 3, j.y + 3, j.w - 6, j.h - 6);
    addText(scene, j.x + j.w / 2, j.y - 4, '⛓️', { fontSize: '34px' }).setOrigin(0.5, 1).setDepth(j.y - 40); // sorts with the tokens: runners at the fence draw over it
  }
  for (let i = 0; i < 30; i++) addText(scene, between(20, W - 20), between(TOP + 20, H - 20), pick(['🌼', '🌾', '🍄', '🌿']), { fontSize: '22px' }).setOrigin(0.5).setAlpha(0.55);
  g.lineStyle(6, 0xffffff, 0.75); // chalk: dashed centre line and circle
  for (let y = TOP; y < H; y += 36) g.lineBetween(MID, y, MID, y + 20);
  g.lineStyle(4, 0xffffff, 0.4).strokeCircle(MID, FIELD_Y, 110);
  for (const o of OBSTACLES) {
    g.fillStyle(0x000000, 0.25).fillEllipse(o.x, o.y + o.r * 0.6, o.r * 2.2, o.r * 0.8);
    addText(scene, o.x, o.y, o.emoji, { fontSize: `${Math.round(o.r * 2.6)}px` }).setOrigin(0.5, 0.62).setDepth(o.y);
  }
  g.generateTexture('cf-field', W, H).destroy(); // static: bake it once instead of re-drawing every shape every frame
  scene.add.image(0, 0, 'cf-field').setOrigin(0).setDepth(-1);
}

function drawHud(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(UI).fillStyle(0x000000, 0.55).fillRect(0, 0, W, TOP);
  for (const s of [0, 1] as const) g.fillStyle(tint[s], 0.35).fillRect(s * MID, 0, MID, TOP).fillStyle(tint[s]).fillRect(s * MID, TOP - 5, MID, 5);
  addText(scene, 24, TOP / 2, t.goal, { fontSize: '28px', fontStyle: 'bold', color: '#fff' }).setOrigin(0, 0.5).setDepth(UI + 1);
  score = addText(scene, MID, TOP / 2, scoreLine(), { fontSize: '44px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(UI + 1);
  clock = addText(scene, W - 24, TOP / 2, '', { fontSize: '38px', fontStyle: 'bold', color: '#fff' }).setOrigin(1, 0.5).setDepth(UI + 1);
}

// A flag on a pole, flying away from the back wall, cloth waving.
function addFlag(scene: Phaser.Scene, s: Side) {
  const dir = s ? -1 : 1;
  const cloth = scene.add.graphics().fillStyle(tint[s]).fillTriangle(0, -68, 0, -36, 48 * dir, -52);
  scene.tweens.add({ targets: cloth, scaleX: 0.72, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return scene.add.container(FLAG_BASES[s].x, FLAG_BASES[s].y, [
    scene.add.ellipse(0, 0, 26, 9, 0x000000, 0.35),
    scene.add.rectangle(0, -34, 5, 68, 0xf4efe6),
    cloth,
  ]);
}

function addToken(scene: Phaser.Scene, r: Runner<Player>) {
  // The disc in the team colour, readable from the back row (a player's own colour can be the other team's).
  const box = addPlayerToken(scene, { ...r.p, color: patrol[r.side].color }, r.x, r.y, { r: R });
  tokens.set(r.p, { r, box, said: '', saidAt: 0 });
}

function tick(scene: Phaser.Scene, dt: number) {
  if (over) return;
  if (frozen > 0) {
    frozen -= dt;
    if (counting) countdown(scene);
  } else {
    timeLeft -= dt;
    step(world, dt, events);
    for (const e of events) onEvent(scene, e);
    events.length = 0;
    if (!over && timeLeft <= 0) finish(scene);
    if (over) return;
  }
  drawClock();
  draw(scene.time.now);
  const now = performance.now();
  for (const r of world.runners) {
    const tok = tokens.get(r.p);
    if (tok && STATUS[situation(world, r)] !== tok.said && now - tok.saidAt >= SEND_MS) sendUi(r);
  }
}

function countdown(scene: Phaser.Scene) {
  const n = Math.max(0, Math.ceil(frozen));
  if (n === shownCount) return;
  shownCount = n;
  banner(scene, MID, FIELD_Y, n ? String(n) : t.go, 160, n ? '#fff' : '#ffd23f', 450);
  counting = n > 0;
}

function drawClock() {
  const left = Math.ceil(Math.max(0, timeLeft)); // round once: 179.5 s must read 3:00, not 2:59
  if (left === shownSecond) return;
  shownSecond = left;
  clock.setText(`⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`).setColor(left <= 10 ? '#ff5a5f' : '#fff');
}

// Tokens follow the rules' positions (except while they slide back after a capture), plus the per-frame juice.
function draw(now: number) {
  fx.clear();
  for (const r of world.runners) {
    const b = tokens.get(r.p)?.box;
    if (!b) continue;
    if (frozen <= 0) b.setPosition(r.x, r.y).setDepth(r.y);
    const name = b.list[3] as Phaser.GameObjects.Text; // keep the name on the canvas at the side walls
    name.x = Phaser.Math.Clamp(0, name.width / 2 + 4 - b.x, W - 4 - name.width / 2 - b.x);
    b.setAlpha(r.ghost ? 0.35 : r.safe > 0 && Math.floor(now / 90) % 2 ? 0.3 : 1); // protected runners blink
    if (r.dash > 0) dust.emitParticleAt(b.x, b.y + R * 0.8);
    if (r.cool > 0 && !r.jailed && !r.ghost) {
      const a = -Math.PI / 2;
      fx.lineStyle(5, 0xffffff, 0.85).beginPath().arc(b.x, b.y, R + 11, a, a + 2 * Math.PI * (1 - r.cool / DASH_COOLDOWN_S)).strokePath();
    }
  }
  for (const f of world.flags) {
    const view = flags[f.side], c = f.carrier && tokens.get(f.carrier.p)?.box;
    if (c) {
      view.setPosition(c.x + 14, c.y - 4).setDepth(c.y + 1); // up over the carrier's shoulder
      fx.lineStyle(4, tint[f.side], 0.5 + 0.5 * Math.sin(now / 80)).strokeCircle(c.x, c.y, R + 17);
    } else view.setPosition(f.x, f.y).setDepth(f.y);
  }
}

function onEvent(scene: Phaser.Scene, e: Event<Player>) {
  switch (e.t) {
    case 'tag': {
      const b = tokens.get(e.who.p)?.box; // still at the tag spot: draw() moves it to the jail
      if (b) {
        burst.setParticleTint(tint[e.by.side]).explode(26, b.x, b.y);
        scene.tweens.add({ targets: b.setScale(1.7), scale: 1, duration: 350, ease: 'Back.easeOut' });
      }
      scene.cameras.main.shake(120, 0.004);
      say(scene, t.tagged(who(e.by), who(e.who)));
      sendUi(e.who, BUZZ.tagged);
      sendUi(e.by, BUZZ.tagger);
      break;
    }
    case 'grab': {
      const view = flags[other(e.who.side)];
      scene.tweens.add({ targets: view.setScale(1.6), scale: 1, duration: 300, ease: 'Back.easeOut' });
      say(scene, t.grabbed(who(e.who)));
      sendUi(e.who, BUZZ.grab);
      for (const tok of tokens.values()) if (tok.r.side !== e.who.side) sendUi(tok.r, BUZZ.stolen); // the owners: their flag is gone
      break;
    }
    case 'return':
      say(scene, t.returned(who(e.by)));
      sendUi(e.by);
      break;
    case 'jailbreak': {
      const j = JAILS[other(e.by.side)], x = Math.min(Math.max(j.x + j.w / 2, 260), W - 260);
      burst.setParticleTint(tint[e.by.side]).explode(50, j.x + j.w / 2, j.y + j.h / 2);
      banner(scene, x, j.y - 70, t.jailbreak, 56, patrol[e.by.side].color, 900);
      scene.cameras.main.shake(180, 0.006);
      say(scene, t.freed(who(e.by)));
      sendUi(e.by);
      for (const f of e.freed) sendUi(f, BUZZ.freed);
      break;
    }
    case 'capture':
      captured(scene, e.who);
  }
}

// The rules already put everyone back on their line: slide the tokens there while play is frozen.
function captured(scene: Phaser.Scene, r: Runner<Player>) {
  frozen = CAPTURE_FREEZE_S;
  score.setText(scoreLine()).setScale(1.5);
  scene.tweens.add({ targets: score, scale: 1, duration: 500, ease: 'Back.easeOut' });
  throwConfetti(r.side, 60);
  scene.cameras.main.shake(380, 0.014).flash(250, 255, 240, 200);
  say(scene, t.scored(who(r)));
  for (const tok of tokens.values()) {
    scene.tweens.add({ targets: tok.box.setDepth(tok.r.y), x: tok.r.x, y: tok.r.y, duration: CAPTURE_FREEZE_S * 600, ease: 'Cubic.easeInOut' });
    sendUi(tok.r, tok.r.side === r.side ? BUZZ.capture : undefined);
  }
  if (world.captures[r.side] >= CAPTURES_TO_WIN) return finish(scene);
  banner(scene, MID, FIELD_Y - 40, t.capture, 130, patrol[r.side].color, 1100);
  banner(scene, MID, FIELD_Y + 70, who(r), 48, '#fff', 1100);
}

function finish(scene: Phaser.Scene) {
  over = true;
  drawClock(); // tick() draws nothing more: show the final clock and the flags back home
  draw(scene.time.now);
  const win = leader(world), text = win === null ? t.draw : t.wins(patrol[win].name);
  banner(scene, MID, FIELD_Y - 40, text, 110, win === null ? '#fff' : patrol[win].color);
  banner(scene, MID, FIELD_Y + 70, scoreLine(), 48, '#fff');
  if (win !== null) throwConfetti(win, 80);
  for (const r of world.runners) ctx.send(r.p, { layout: 'wait', text, sub: scoreLine(), color: patrol[r.side].color });
  const champs = world.runners.filter(r => r.side === win).map(r => r.p); // a draw: nobody
  endTimer = setTimeout(() => ctx.end(finalScores(world), champs), END_S * 1000);
}

// One colour per batch: Phaser 4 renders particles black when setParticleTint() gets a list of colours.
function throwConfetti(s: Side, perColour: number) {
  for (const c of [tint[s], 0xffd23f, 0xffffff]) confetti.setParticleTint(c).explode(perColour, MID, FIELD_Y);
}

/** Pops a big line in; with holdMs it floats away again. */
function banner(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string, holdMs?: number) {
  const b = addText(scene, x, y, text, { fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: Math.round(size / 9) })
    .setOrigin(0.5).setDepth(UI + 2).setScale(0);
  scene.tweens.add({ targets: b, scale: 1, duration: 320, ease: 'Back.easeOut' });
  if (holdMs !== undefined) scene.tweens.add({ targets: b, alpha: 0, y: y - 30, delay: holdMs, duration: 400, onComplete: () => b.destroy() });
}

/** Kill feed under the score: newest on top, each line fades after FEED_S. */
function say(scene: Phaser.Scene, line: string) {
  const txt = addText(scene, MID, TOP + 10, line, { fontSize: '24px', fontStyle: 'bold', color: '#fff', backgroundColor: '#000a', padding: { x: 12, y: 4 } })
    .setOrigin(0.5, 0).setDepth(UI);
  feed.unshift(txt);
  for (const old of feed.splice(FEED_MAX)) {
    scene.tweens.killTweensOf(old);
    old.destroy();
  }
  feed.forEach((l, i) => l.setY(TOP + 10 + i * 38)); // set, not tweened: two y-tweens on one line race each other
  scene.tweens.add({ targets: txt, alpha: 0, delay: FEED_S * 1000, duration: 500, onComplete: () => {
    feed.splice(feed.indexOf(txt), 1);
    txt.destroy();
  } });
}

// Every phone, offline ones too: the host replays the last controller when a phone comes back.
function sendUi(r: Runner<Player>, buzz?: ControllerUi['buzz']) {
  const tok = tokens.get(r.p), team = patrol[r.side];
  if (!tok || over) return;
  tok.said = STATUS[situation(world, r)];
  tok.saidAt = performance.now();
  const sub = `${team.emoji} ${team.name} · ${world.captures[0]} : ${world.captures[1]} · ⭐ ${r.points}`;
  ctx.send(r.p, { layout: 'stick', round: ROUND, button: t.dash, text: tok.said, sub, buzz, color: team.color }); // phone in team colour
}

function input(p: Player, msg: GameInput) {
  const r = runners.get(p);
  if (!r || over) return;
  if (msg.t === 'stick') steer(r, msg.x, msg.y); // parseInput() clamped each axis; steer() caps the length
  if (msg.t === 'button' && msg.down && frozen <= 0 && dash(world, r)) dust.explode(12, r.x, r.y + R * 0.8);
  if (msg.t === 'presence') setGhost(world, r, !p.online); // dropped: a ghost; back: stands still until they steer
}

function join(p: Player) {
  if (over) return; // the end banner is up: no controller to give, and no win bonus for just turning up
  const n: [number, number] = [0, 0];
  for (const r of world.runners) if (!r.ghost) n[r.side]++;
  const r = addRunner(world, p, n[1] < n[0] ? 1 : 0); // the side with fewer scouts on the field (offline ones don't count)
  runners.set(p, r);
  if (booted) addToken(booted, r); // still booting: setUp() adds everyone in the world
}
</script>

<template>
  <div ref="stage" class="ctf" />
</template>

<style scoped>
.ctf { height: 100%; }
</style>
