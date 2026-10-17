<script setup lang="ts">
// ISS Pass: the space station flies over the camp at night (scouts really talk to ISS astronauts via ARISS).
// Every scout has a ground station: turn the Yagi with the stick, keep the beam on the satellite and hold it
// long enough to log a QSO. The phone's beacon beeps louder and faster the better the antenna points.
import type { Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import { addPlayerToken, addText, hex, Phaser, usePhaserGame } from '~/games/kit/phaser';
import { between } from '~/games/kit/random';
import type { GameInput, Player, Score } from '~/games/types';
import { playMorse } from '~/utils/morseAudio';
import { BEAM_DEG, CLOUD_DIM, fly, LOCK_DEG, LOCK_S, track } from './sky';
import type { Arc, Link, Station, Target } from './sky';

const W = 1600, H = 900;
/** Seconds the ISS takes to cross the sky, per pass: every pass is faster. */
const PASS_S = [24, 21, 18, 15, 12];
const BREAK_S = 4, END_MS = 4000;
/** From this pass on (0-based) AO-91 flies too, worth AO_WEIGHT × the points / clouds drift by. */
const AO_FROM = 2, AO_WEIGHT = 2, CLOUDS_FROM = 3;
/** Satellites rise and set at SKY_BASE (just above the trees), EDGE px off-screen, peaking this high above it. */
const SKY_BASE = 720, EDGE = 80, PEAK_MIN = 260, PEAK_MAX = 600;
/** Station layout: the player token, and the antenna's pivot (where the beam starts) above it. */
const TOKEN_Y = 846, PIVOT_Y = 726, MAST = PIVOT_Y - TOKEN_Y;
/** Long enough to reach every corner of the sky. */
const BEAM_LEN = 1800;
/** Beam opacity: idle, plus this much at full signal. Offline stations dim to OFFLINE_A and hide their beam. */
const CONE_A = 0.08, CONE_GAIN = 0.3, OFFLINE_A = 0.35;
/** Yagi elements along the boom: [y, half width]. Reflector, driven element, three directors. */
const YAGI = [[10, 24], [-4, 20], [-22, 16], [-38, 14], [-54, 12]] as const;
/** A satellite counts as behind a cloud inside this ellipse (fits the ☁️ at 150px). */
const CLOUDS = 3, CLOUD_RX = 75, CLOUD_RY = 45;
/** Phone updates like Fox Hunt: at most every SEND_MS, and only when something changed. */
const SEND_MS = 200, SEND_DELTA = 0.02, BOARD_MS = 250;
/** Scoreboard rows until the end (a long board covers the sky's right edge), and room for its points column. */
const BOARD_ROWS = 5, PTS_W = 64;
const BAR_W = 48;
/** Dots in the pass prediction: big and bright enough to stand out from the stars on a beamer. */
const TRAIL_DOTS = 40, TRAIL_R = 4, TRAIL_A = 0.7;
/** QSL card size; kept this far inside the screen edge. */
const CARD_W = 190, CARD_H = 50, CARD_MARGIN = 10;

const en = {
  hint: 'Turn your antenna with the joystick ←→ — follow the beeps!',
  track: '🛰️ Track the ISS!',
  trackBoth: '🛰️ Track the ISS — AO-91 scores double!',
  points: 'Points',
  scores: '🏆 Points',
  pass: (n: number, of: number) => `Pass ${n} / ${of}`,
  ready: (n: number, of: number) => `Pass ${n} / ${of} — get ready`,
  first: 'The dotted line shows where the ISS will fly',
  newSat: '🆕 AO-91 is up too — double points!',
  clouds: '☁️ Clouds! Behind them the signal is weak.',
  qsl: (sat: string) => `QSO ✓ ${sat}`,
  wins: (who: string) => `🏆 ${who} wins!`,
  noWinner: '73 — clear skies!',
  over: '73! Thanks for the contacts',
};
const de: typeof en = {
  hint: 'Dreh deine Antenne mit dem Joystick ←→ — folge den Pieptönen!',
  track: '🛰️ Verfolge die ISS!',
  trackBoth: '🛰️ Verfolge die ISS — AO-91 zählt doppelt!',
  points: 'Punkte',
  scores: '🏆 Punkte',
  pass: (n, of) => `Überflug ${n} / ${of}`,
  ready: (n, of) => `Überflug ${n} / ${of} — gleich geht’s los`,
  first: 'Die gepunktete Linie zeigt, wo die ISS entlangfliegt',
  newSat: '🆕 Jetzt auch AO-91 — doppelte Punkte!',
  clouds: '☁️ Wolken! Dahinter ist das Signal schwach.',
  qsl: sat => `QSO ✓ ${sat}`,
  wins: who => `🏆 ${who} gewinnt!`,
  noWinner: '73 — klarer Himmel!',
  over: '73! Danke für die Verbindungen',
};
const TXT: Record<Lang, typeof en> = { en, de };

/** A player's ground station: the tracking state (sky.ts) plus what Phaser draws and what the phone last got. */
interface Ground extends Station {
  p: Player;
  box: Phaser.GameObjects.Container;
  /** Not in `box`: it sits behind the hills and under the satellites. Hidden while offline. */
  cone: Phaser.GameObjects.Graphics;
  yagi: Phaser.GameObjects.Graphics;
  /** QSO progress above the token. */
  bar: Phaser.GameObjects.Rectangle;
  /** The name under the token: shrunk to its slot when many stations share the width. */
  label: Phaser.GameObjects.Text;
  sentSig: number;
  sentPts: number;
  sentAt: number;
}

interface Sat {
  name: string;
  /** Flies this pass. */
  on: boolean;
  arc: Arc;
  tg: Target;
  box: Phaser.GameObjects.Container;
  /** Colour of its dotted path. */
  tint: number;
}

interface Cloud { img: Phaser.GameObjects.Text; v: number }

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
const stage = useTemplateRef<HTMLDivElement>('stage');

// Game state. Plain variables, never ref(): Vue must not wrap Phaser objects in proxies.
/** Everyone, latecomers included: setUp() builds a station for each once Phaser has booted. */
const roster = [...ctx.players];
const grounds = new Map<Player, Ground>();
const clouds: Cloud[] = [];
const dot: Target = { x: 0, y: 0, up: false, weight: 0, dim: 0 }; // scratch for drawing trails
let booted: Phaser.Scene | undefined;
/** sats, targets and every station's links share one index order. */
let iss: Sat, ao: Sat, sats: Sat[] = [], targets: Target[] = [];
let trail: Phaser.GameObjects.Graphics, hud: Phaser.GameObjects.Text, hint: Phaser.GameObjects.Text; // set in setUp()
let names: Phaser.GameObjects.Text, pts: Phaser.GameObjects.Text, camp: Phaser.GameObjects.Container;
let banner: Phaser.GameObjects.Text, news: Phaser.GameObjects.Text;
let pass = -1, phase: 'break' | 'pass' | 'over' = 'break', breakLeft = 0, passTime = 0, shownLeft = -1, boardAt = 0;
let endTimer: ReturnType<typeof setTimeout> | undefined;

const passS = () => PASS_S[pass] ?? 0;
const scores = (): Score[] => roster.map(p => [p, Math.round(grounds.get(p)?.points ?? 0)]);
const ranking = () => scores().sort((a, b) => b[1] - a[1]);
/** Reducer: progress towards the next QSO this pass (module level, so the loop allocates no closure). */
const lockProgress = (m: number, l: Link) => (l.qso ? m : Math.max(m, Math.min(1, l.lock / LOCK_S)));

usePhaserGame(stage, {
  backgroundColor: '#03060c',
  scene: {
    create(this: Phaser.Scene) { booted = this; setUp(this); },
    update(this: Phaser.Scene, _time: number, delta: number) { tick(this, Math.min(delta, 50) / 1000); },
  },
});
onUnmounted(() => clearTimeout(endTimer));

function setUp(scene: Phaser.Scene) {
  drawSky(scene);
  // Over beams and clouds; short enough that the satellites stay below it. Points in their own right-aligned column.
  const row = { fontSize: '24px', color: '#fff', lineSpacing: 6 };
  names = addText(scene, W - 24, 80, '', { ...row, backgroundColor: '#0006', padding: { left: 14, right: 14 + PTS_W, y: 10 } }).setOrigin(1, 0).setDepth(5.5);
  pts = addText(scene, W - 38, 80, '', { ...row, align: 'right', padding: { y: 10 } }).setOrigin(1, 0).setDepth(5.5);
  trail = scene.add.graphics().setDepth(2.5);
  iss = addSat(scene, 'ISS', 1, '#ffffff', drawIss);
  ao = addSat(scene, 'AO-91', AO_WEIGHT, '#ffc94d', drawCubeSat);
  sats = [iss, ao];
  targets = sats.map(s => s.tg);
  for (let i = 0; i < CLOUDS; i++) {
    const img = addText(scene, between(0, W), between(220, 480), '☁️', { fontSize: '150px' }).setOrigin(0.5).setAlpha(0.92).setDepth(5).setVisible(false);
    clouds.push({ img, v: between(25, 60) * (i % 2 ? -1 : 1) });
  }
  drawGround(scene);
  hud = addText(scene, 24, 18, '', { fontSize: '30px', fontStyle: 'bold', color: '#fff', backgroundColor: '#0008', padding: { x: 14, y: 6 } }).setDepth(10);
  hint = addText(scene, W / 2, 18, t.hint, { fontSize: '24px', color: '#fff', backgroundColor: '#0008', padding: { x: 12, y: 6 } }).setOrigin(0.5, 0).setDepth(10);
  const big = { fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 10, align: 'center' };
  banner = addText(scene, W / 2, H / 2 - 80, '', { ...big, fontSize: '72px' }).setOrigin(0.5).setDepth(11);
  news = addText(scene, W / 2, H / 2 + 10, '', { ...big, fontSize: '38px', color: '#fff', strokeThickness: 7 }).setOrigin(0.5).setDepth(11);
  for (const p of roster) addGround(scene, p);
  layout();
  startBreak();
}

// Night sky: black overhead to deep blue at the horizon, twinkling stars, the moon.
function drawSky(scene: Phaser.Scene) {
  const g = scene.add.graphics(), bands = 48, bandH = (SKY_BASE + 80) / bands;
  for (let i = 0; i < bands; i++) {
    const c = Phaser.Display.Color.Interpolate.RGBWithRGB(1, 3, 10, 16, 38, 92, bands - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, i * bandH, W, bandH + 1);
  }
  for (let i = 0; i < 160; i++) {
    const star = scene.add.circle(between(0, W), 660 * Math.random() ** 1.4, between(0.6, 2), 0xffffff, between(0.4, 1)).setDepth(1);
    if (i % 3 === 0) scene.tweens.add({ targets: star, alpha: 0.1, duration: between(500, 1800), delay: between(0, 2000), yoyo: true, repeat: -1 });
  }
  scene.add.circle(230, 210, 110, 0xfff6d5, 0.05).setDepth(2);
  scene.add.circle(230, 210, 70, 0xfff6d5, 0.08).setDepth(2);
  scene.add.circle(230, 210, 44, 0xf2efe0).setDepth(2);
  scene.add.graphics().setDepth(2).fillStyle(0xd6d0bb).fillCircle(218, 202, 8).fillCircle(244, 220, 6).fillCircle(236, 192, 4);
}

// Horizon silhouette: dark hills, moonlit trees, the camp.
function drawGround(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(6).fillStyle(0x050a12).fillRect(0, 785, W, H - 785);
  for (let x = -100; x < W + 100; x += between(160, 300)) g.fillEllipse(x, 795, between(300, 520), between(70, 130));
  for (let i = 0; i < 26; i++) {
    addText(scene, between(0, W), between(765, 790), '🌲', { fontSize: `${Math.round(between(44, 78))}px` }).setOrigin(0.5, 1).setTint(0x5c6f8f).setDepth(6);
  }
  camp = scene.add.container(0, 800, [ // layout() puts it between two masts
    addText(scene, -24, 0, '⛺', { fontSize: '64px' }).setOrigin(0.5, 1).setTint(0x8a96b8),
    addText(scene, 36, 0, '🔥', { fontSize: '30px' }).setOrigin(0.5, 1),
  ]).setDepth(6);
}

function drawIss(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, 0xd7dce4).lineBetween(-50, 0, 50, 0); // truss
  g.fillStyle(0x3a6fd0);
  for (const x of [-52, -40, 31, 43]) g.fillRect(x, -24, 9, 20).fillRect(x, 4, 9, 20); // solar arrays
  g.fillStyle(0xeeeeee).fillRect(-12, -6, 24, 12).fillRect(-4, -17, 8, 34); // modules
  g.fillStyle(0xffffff, 0.7).fillRect(-24, 4, 6, 14).fillRect(18, -18, 6, 14); // radiators
}

function drawCubeSat(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(2, 0xe6e6e6);
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.lineBetween(x * 7, y * 7, x * 18, y * 18); // whip antennas
  g.fillStyle(0x2a2f3a).fillRect(-8, -8, 16, 16).lineStyle(2, 0xffc94d).strokeRect(-8, -8, 16, 16);
}

function addSat(scene: Phaser.Scene, name: string, weight: number, color: string, draw: (g: Phaser.GameObjects.Graphics) => void): Sat {
  const g = scene.add.graphics();
  draw(g);
  const glow = weight > 1 ? 22 : 34, label = weight > 1 ? `${name} ×${weight}` : name;
  const box = scene.add.container(0, 0, [
    scene.add.circle(0, 0, glow, hex(color), 0.14),
    g,
    addText(scene, 0, glow + 6, label, { fontSize: '20px', fontStyle: 'bold', color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0),
  ]).setDepth(4).setVisible(false);
  return { name, on: false, box, tint: hex(color), arc: { from: 0, to: 0, base: SKY_BASE, peak: 0, start: 0, dur: 1 }, tg: { x: 0, y: 0, up: false, weight, dim: 1 } };
}

function addGround(scene: Phaser.Scene, p: Player): Ground {
  const rad = Phaser.Math.DegToRad;
  const cone = scene.add.graphics().setPosition(0, PIVOT_Y).setDepth(3).setAlpha(CONE_A).setVisible(p.online).fillStyle(hex(p.color))
    .slice(0, 0, BEAM_LEN, rad(-90 - BEAM_DEG), rad(-90 + BEAM_DEG)).fillPath()
    .slice(0, 0, BEAM_LEN, rad(-90 - LOCK_DEG), rad(-90 + LOCK_DEG)).fillPath(); // overlaps: the QSO core shows brighter
  const mast = scene.add.graphics().lineStyle(4, 0x8d97a6).lineBetween(0, -42, 0, MAST)
    .lineStyle(3, 0x8d97a6).lineBetween(-16, -42, 0, -78).lineBetween(16, -42, 0, -78);
  const yagi = scene.add.graphics().setPosition(0, MAST).lineStyle(3, 0xdfe6ee).lineBetween(0, 12, 0, -62);
  for (const [y, w] of YAGI) yagi.lineBetween(-w, y, w, y);
  const bar = scene.add.rectangle(-BAR_W / 2, -34, 0, 6, 0xffd23f).setOrigin(0, 0.5);
  const token = addPlayerToken(scene, p, 0, 0);
  const box = scene.add.container(0, TOKEN_Y, [
    mast, yagi,
    scene.add.rectangle(-BAR_W / 2, -34, BAR_W, 6, 0x000000, 0.5).setOrigin(0, 0.5), bar,
    token,
  ]).setDepth(7).setAlpha(p.online ? 1 : OFFLINE_A);
  const g: Ground = {
    p, box, cone, yagi, bar, label: token.list[3] as Phaser.GameObjects.Text, x: 0, y: PIVOT_Y, aim: 0, turn: 0, sig: 0, points: 0,
    links: targets.map(() => ({ lock: 0, qso: false })), sentSig: -1, sentPts: -1, sentAt: 0,
  };
  grounds.set(p, g);
  return g;
}

/** Stations evenly across the width, in join order; the camp in the gap between the first two (left of a lone one). */
function layout() {
  let i = 0;
  const slot = W / grounds.size;
  for (const g of grounds.values()) {
    g.box.x = g.cone.x = g.x = slot * (i++ + 0.5);
    g.label.setScale(Math.min(1, (slot - 8) / g.label.width)); // 12+ stations: names would run into each other
  }
  camp.x = W / (grounds.size > 1 ? grounds.size : 4);
}

function startBreak() {
  pass++;
  phase = 'break';
  breakLeft = BREAK_S;
  passTime = 0;
  shownLeft = -1;
  planPass();
  banner.setText(t.ready(pass + 1, PASS_S.length)).setVisible(true);
  news.setText(pass === 0 ? t.first : pass === AO_FROM ? t.newSat : pass === CLOUDS_FROM ? t.clouds : '').setVisible(true);
  if (pass === CLOUDS_FROM) for (const c of clouds) c.img.setVisible(true);
  for (const g of grounds.values()) idle(g);
  drawClock();
  drawBoard();
}

/** Off a pass (breaks, the end): the phone leaves the stick (don't keep turning on its last input), dim beam, empty QSO bar. */
function idle(g: Ground) {
  g.turn = g.sig = 0;
  g.cone.alpha = CONE_A;
  g.bar.width = 0;
  send(g);
}

/** New arcs for this pass, with the predicted path dotted in the sky (the "pass prediction"). */
function planPass() {
  const dur = passS(), mid = (PEAK_MIN + PEAK_MAX) / 2;
  iss.on = true;
  ao.on = pass >= AO_FROM;
  plan(iss.arc, 0, dur, PEAK_MIN, PEAK_MAX);
  // AO-91 rises later, crosses faster, on a clearly different arc.
  if (ao.on) plan(ao.arc, between(0.1, 0.3) * dur, between(0.55, 0.7) * dur, iss.arc.peak > mid ? PEAK_MIN : mid, iss.arc.peak > mid ? mid : PEAK_MAX);
  trail.clear();
  for (const s of sats) {
    s.tg.up = false;
    s.box.setVisible(false);
    if (!s.on) continue;
    trail.fillStyle(s.tint, TRAIL_A);
    for (let i = 0; i <= TRAIL_DOTS; i++) {
      fly(s.arc, s.arc.start + (s.arc.dur * i) / TRAIL_DOTS, dot);
      trail.fillCircle(dot.x, dot.y, TRAIL_R);
    }
  }
}

function plan(arc: Arc, start: number, dur: number, peakMin: number, peakMax: number) {
  const dir = Math.random() < 0.5 ? 1 : -1; // rises in the west or in the east
  arc.from = W / 2 - dir * (W / 2 + EDGE);
  arc.to = W / 2 + dir * (W / 2 + EDGE);
  arc.peak = between(peakMin, peakMax);
  arc.start = start;
  arc.dur = dur;
}

function startPass() {
  phase = 'pass';
  banner.setVisible(false);
  news.setVisible(false);
  for (const g of grounds.values()) {
    for (const l of g.links) { l.lock = 0; l.qso = false; }
    send(g);
  }
}

function tick(scene: Phaser.Scene, dt: number) {
  for (const c of clouds) if (c.img.visible) drift(c, dt);
  if (phase === 'break' && (breakLeft -= dt) <= 0) startPass();
  if (phase !== 'pass') return;
  passTime += dt;
  for (const s of sats) {
    if (!s.on) continue;
    fly(s.arc, passTime, s.tg);
    s.tg.dim = behindCloud(s.tg.x, s.tg.y) ? CLOUD_DIM : 1;
    s.box.setPosition(s.tg.x, s.tg.y).setVisible(s.tg.up);
  }
  const now = performance.now();
  for (const g of grounds.values()) {
    const qso = track(g, targets, dt);
    g.yagi.rotation = g.cone.rotation = Phaser.Math.DegToRad(g.aim);
    g.cone.alpha = CONE_A + CONE_GAIN * g.sig;
    g.bar.width = BAR_W * g.links.reduce(lockProgress, 0);
    const sat = sats[qso];
    if (sat) logQso(scene, g, sat);
    else if (now - g.sentAt >= SEND_MS && (Math.abs(g.sig - g.sentSig) > SEND_DELTA || Math.round(g.points) !== g.sentPts)) send(g);
  }
  if (passTime >= passS()) return pass + 1 < PASS_S.length ? startBreak() : finish();
  drawClock();
  if (now - boardAt >= BOARD_MS) drawBoard();
}

function drift(c: Cloud, dt: number) {
  c.img.x += c.v * dt;
  if (c.img.x > W + 150) c.img.x = -150;
  else if (c.img.x < -150) c.img.x = W + 150;
}

function behindCloud(x: number, y: number) {
  for (const c of clouds) {
    if (c.img.visible && ((x - c.img.x) / CLOUD_RX) ** 2 + ((y - c.img.y) / CLOUD_RY) ** 2 < 1) return true;
  }
  return false;
}

// Contact! A QSL card pops above the antenna, the big screen sends "R" (received), the phone buzzes.
function logQso(scene: Phaser.Scene, g: Ground, s: Sat) {
  const edge = CARD_W / 2 + CARD_MARGIN; // outermost stations of a big group sit closer to the edge than half a card
  const card = scene.add.container(Phaser.Math.Clamp(g.x, edge, W - edge), PIVOT_Y - 120, [
    scene.add.rectangle(0, 0, CARD_W, CARD_H, 0xfffaf0).setStrokeStyle(4, hex(g.p.color)),
    addText(scene, 0, 0, t.qsl(s.name), { fontSize: '24px', fontStyle: 'bold', color: '#1b2a4a' }).setOrigin(0.5),
  ]).setDepth(9).setScale(0).setAngle(between(-6, 6));
  scene.tweens.add({ targets: card, scale: 1, duration: 250, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: card, y: card.y - 70, alpha: 0, delay: 1800, duration: 700, onComplete: () => card.destroy() });
  playMorse('R', { unit: 0.05, freq: 880, vol: 0.12 });
  send(g, [80, 60, 80]);
}

/** The phone's controller for the current phase: the tracking stick during a pass, else a wait screen. */
function send(g: Ground, buzz?: number[]) {
  const pts = Math.round(g.points);
  g.sentSig = g.sig;
  g.sentPts = pts;
  g.sentAt = performance.now();
  const sub = `${t.points}: ${pts}`;
  if (phase !== 'pass') {
    ctx.send(g.p, { layout: 'wait', text: phase === 'over' ? t.over : t.ready(pass + 1, PASS_S.length), sub });
    return;
  }
  const logged = sats.map((s, i) => (g.links[i]?.qso ? `  ✓ ${s.name}` : '')).join('');
  ctx.send(g.p, { layout: 'stick', round: pass + 1, meter: +g.sig.toFixed(2), text: pass >= AO_FROM ? t.trackBoth : t.track, sub: sub + logged, buzz });
}

/** Pass and countdown; only rebuilt when the second changes. */
function drawClock() {
  const left = Math.ceil(Math.max(0, passS() - passTime));
  if (left === shownLeft) return;
  shownLeft = left;
  hud.setText(`🛰️ ${t.pass(pass + 1, PASS_S.length)}   ⏱ ${left} s`);
}

/** Top BOARD_ROWS while satellites fly, `all` at the end. */
function drawBoard(all = false) {
  boardAt = performance.now();
  const rows = ranking(), shown = all ? rows : rows.slice(0, BOARD_ROWS);
  const more = shown.length < rows.length ? '\n…' : '';
  names.setText([t.scores, ...shown.map(([p]) => `${p.avatar} ${p.name}`)].join('\n') + more);
  pts.setText(['', ...shown.map(([, n]) => n)].join('\n'));
}

function finish() {
  phase = 'over';
  trail.clear();
  for (const s of sats) s.box.setVisible(false);
  hud.setVisible(false); // the clock would still read the last second of pass 5
  hint.setVisible(false);
  drawBoard(true);
  const [best, n] = ranking()[0] ?? [];
  banner.setText(best && n ? t.wins(`${best.avatar} ${best.name}`) : t.noWinner).setVisible(true);
  news.setText(t.over).setVisible(true);
  const free = names.getBounds().left - 20; // a long winner name must not cover the final scoreboard
  if (banner.getBounds().right > free) for (const txt of [banner, news]) txt.setX(free / 2).setScale(Math.min(1, (free - 40) / txt.width));
  for (const g of grounds.values()) idle(g);
  endTimer = setTimeout(() => ctx.end(scores()), END_MS);
}

function input(p: Player, msg: GameInput) {
  const g = grounds.get(p);
  if (!g) return;
  if (msg.t === 'stick' && phase === 'pass') g.turn = msg.x; // rate control; y is unused
  if (msg.t === 'presence') { // dropped or back: stop turning until they touch the stick again
    g.turn = 0;
    g.box.setAlpha(p.online ? 1 : OFFLINE_A);
    g.cone.setVisible(p.online);
  }
}

function join(p: Player) {
  roster.push(p);
  if (!booted) return; // still booting: setUp() builds every station in the roster
  const g = addGround(booted, p);
  layout();
  send(g);
}
</script>

<template>
  <div ref="stage" class="iss" />
</template>

<style scoped>
.iss { height: 100%; }
</style>
