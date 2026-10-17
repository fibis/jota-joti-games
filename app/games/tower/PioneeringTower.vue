<script setup lang="ts">
// Pioneering Tower: two patrols lash a tower side by side, both at once. Each team's builder steers the piece
// on their crane (stick ↔ moves, ↕ turns) and drops it (button); Matter physics decides what stands.
// Builders rotate after every drop. When time is up the towers settle, get measured, and the tallest wins.
import type { ControllerUi, Lang } from '#shared/protocol';
import { useGame } from '~/composables/useGame';
import { addPlayerToken, addText, hex, Phaser, usePhaserGame } from '~/games/kit/phaser';
import { between } from '~/games/kit/random';
import { joinTeam, makeTeams, type Team } from '~/games/kit/teams';
import type { GameInput, Player, Score } from '~/games/types';
import { audioContext } from '~/utils/morseAudio';
import { type Bar, CRASH_S, crashed, nextBuilder, PIECES, type PieceKind, pieceSequence, points, PX_PER_M, type Rest, settle, towerHeight, winners } from './pieces';

const W = 1600, H = 900;
const GAME_S = 150, SETTLE_S = 4, RESULT_S = 6;
const TURN_S = 10, WARN_S = 3, DROP_COOLDOWN_MS = 1200;
const MOVE_PX_S = 420, ROT_DEG_S = 120;
/** Stick axes below this read as zero, so dragging sideways does not also turn the piece. */
const DEAD = 0.3;
// Layout, canvas px (y down). A tall tower lifts the hook from HOOK_Y up to HOOK_TOP (see liftHook); above ~14 m
// new pieces get shoved onto the top.
const GROUND_Y = 846, BASE_Y = 716, BASE_W = 380, GANTRY_Y = 70, HOOK_Y = 220, HOOK_TOP = 130, RULER_M = 14;
/** Air between a new piece's bottom and the top of its team's tower. */
const HOOK_GAP = 30;
/** Cranes stop this far from the screen edge and from the middle. */
const RAIL_GAP = 70;
/** Rough lashed wood that barely bounces. Calibrated in a headless Matter sim: ~1–4 real crashes per game. */
const WOOD = { friction: 0.85, frictionStatic: 1, restitution: 0.02, density: 0.002, slop: 0.03 };
const C = { wood: 0x9c6b3c, grain: 0xc4935a, edge: 0x5b3a1e, rope: 0x3e2a1a, ropeLight: 0x8a6a48 };

const en = {
  drop: 'DROP 🪵',
  turn: '🪵 Your turn!',
  next: (name: string) => `Next: ${name}`,
  nextYou: 'Next: you! 🔜',
  measuring: '⏳ Measuring…',
  joinHere: 'Join to build here! 📱',
  hint: '↔ move  ·  ↕ turn  ·  🪵 drop',
  crash: '💥 CRASH!',
  wins: (team: string) => `${team} win! 🏆`,
  tie: 'A tie! 🤝',
  none: 'Nothing left standing… 🪵',
};
const de: typeof en = {
  drop: 'LOS 🪵',
  turn: '🪵 Du bist dran!',
  next: name => `Als Nächstes: ${name}`,
  nextYou: 'Als Nächstes: du! 🔜',
  measuring: '⏳ Es wird gemessen…',
  joinHere: 'Hier mitbauen! 📱', // short: the ground sign must stay clear of the hint in the middle
  hint: '↔ schieben  ·  ↕ drehen  ·  🪵 loslassen',
  crash: '💥 EINSTURZ!',
  wins: team => `${team} gewinnen! 🏆`,
  tie: 'Unentschieden! 🤝',
  none: 'Nichts steht mehr… 🪵',
};
const TXT: Record<Lang, typeof en> = { en, de };

/** A piece on the hook: its body exists, but joins the world only when dropped. */
interface Held { kind: PieceKind; body: MatterJS.BodyType; g: Phaser.GameObjects.Graphics }

interface Piece extends Held {
  crew: Crew;
  /** Who dropped it (nobody: auto-dropped while the whole team was offline). */
  by?: Player;
  rest: Rest;
}

/** One team's building site: its half of the screen, crane, turn and tower. */
interface Crew {
  team: Team;
  x0: number;
  x1: number;
  baseX: number;
  rulerX: number;
  /** +1 for the left team, -1 for the right: towards the middle. */
  inward: 1 | -1;
  builder?: Player;
  /** Who dropped the last piece; the next turn goes to whoever follows them. */
  last?: Player;
  held?: Held;
  /** Where the held piece hangs this turn (its centre of mass). */
  hookY: number;
  x: number;
  angle: number;
  stick: { x: number; y: number };
  turnLeft: number;
  warned: boolean;
  /** Controller round of the current turn: a new turn is always a fresh stick. */
  round: number;
  cooldown: number;
  /** How many pieces of the shared sequence this team has used. */
  taken: number;
  height: number;
  best: number;
  shown: string;
  history: [number, number][];
  /** No second CRASH! for the same collapse before this time (s). */
  calm: number;
  crane: Phaser.GameObjects.Container;
  rope: Phaser.GameObjects.Rectangle;
  hook: Phaser.GameObjects.Arc;
  token?: Phaser.GameObjects.Container;
  turnText: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Graphics;
  markerText: Phaser.GameObjects.Text;
}

const ctx = useGame({ input, join });
const t = TXT[ctx.lang];
const fmt = new Intl.NumberFormat(ctx.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format;
const stage = useTemplateRef<HTMLDivElement>('stage');

// Game state. Plain variables, never ref(): Vue must not wrap Phaser or Matter objects in proxies.
// One player only: the second half waits for a latecomer (joinTeam fills the empty team first).
const teams = makeTeams(ctx.players, ctx.lang, 2);
const sequence = pieceSequence(30); // both teams build from the same list
const pieces = new Set<Piece>();
let crews: Crew[] = []; // built once Phaser has booted
let scene: Phaser.Scene | undefined;
let clock: Phaser.GameObjects.Text;
const clouds: Phaser.GameObjects.Graphics[] = [];
let phase: 'play' | 'settle' | 'over' = 'play';
let timeLeft = GAME_S, settleLeft = SETTLE_S, elapsed = 0;
/** Starts at the clock: phones key their controller by layout:round, so no round may repeat one of an earlier game. */
let rounds = Date.now();
/** The result, once phase is 'over'. */
let banner = '';
let endTimer: ReturnType<typeof setTimeout> | undefined;

usePhaserGame(stage, {
  backgroundColor: '#8ec9ee',
  physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 }, positionIterations: 10, velocityIterations: 8 } },
  scene: {
    create(this: Phaser.Scene) { setUp(this); },
    update(this: Phaser.Scene, _time: number, delta: number) { tick(this, Math.min(delta, 50) / 1000); },
  },
});
onUnmounted(() => clearTimeout(endTimer));

// ---------- drawing ----------

/** A wooden bar: dark edge, brown body, lighter grain, rope whipping near both ends. */
function woodBar(g: Phaser.GameObjects.Graphics, b: Bar, dx = 0, dy = 0) {
  const { w, h } = b, x = -w / 2, y = -h / 2;
  g.save().translateCanvas(b.x + dx, b.y + dy).rotateCanvas(b.angle);
  g.fillStyle(C.edge).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 5);
  g.fillStyle(C.wood).fillRoundedRect(x, y, w, h, 3);
  g.lineStyle(2, C.grain, 0.9).lineBetween(x + 8, y + h * 0.35, x + w * 0.62, y + h * 0.35).lineBetween(x + w * 0.35, y + h * 0.7, x + w - 8, y + h * 0.7);
  g.fillStyle(C.rope);
  for (const end of [-1, 1]) for (const off of [10, 17]) g.fillRect(end * (w / 2 - off) - 2, y - 1, 4, h + 2);
  g.restore();
}

/** A square lashing where bars cross. */
function knot(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(C.rope).fillRoundedRect(x - 10, y - 10, 20, 20, 4);
  g.lineStyle(2, C.ropeLight).lineBetween(x - 7, y - 7, x + 7, y + 7).lineBetween(x - 7, y + 7, x + 7, y - 7);
}

/** On the hook it hangs under the crane (depth 4), so a lifted piece never hides the builder's token; drop() raises it. */
function drawPiece(s: Phaser.Scene, kind: PieceKind, com: { x: number; y: number }) {
  const def = PIECES[kind], g = s.add.graphics().setDepth(3);
  for (const b of def.bars) woodBar(g, b, -com.x, -com.y);
  for (const [x, y] of def.knots) knot(g, x - com.x, y - com.y);
  return g;
}

function drawScenery(s: Phaser.Scene) {
  const g = s.add.graphics();
  g.fillGradientStyle(0x3d86d6, 0x3d86d6, 0xc8e8f8, 0xc8e8f8).fillRect(0, 0, W, GROUND_Y);
  g.fillStyle(0xfff6c0, 0.35).fillCircle(W / 2, 200, 100).fillStyle(0xffe066).fillCircle(W / 2, 200, 58);
  for (let i = 0; i < 4; i++) {
    const c = s.add.graphics({ x: between(0, W), y: between(130, 340) }).fillStyle(0xffffff, 0.85);
    c.fillEllipse(0, 0, 170, 52).fillEllipse(-55, 12, 110, 40).fillEllipse(58, 10, 120, 44).fillEllipse(8, -20, 100, 48);
    clouds.push(c);
  }
  g.fillStyle(0x9cc77f).fillEllipse(300, GROUND_Y + 40, 1100, 300).fillEllipse(1350, GROUND_Y + 50, 1200, 280);
  g.fillStyle(0x7fb069).fillEllipse(800, GROUND_Y + 60, 1000, 220);
  for (const x of [70, 140, 640, 700, 900, 960, 1460, 1530]) {
    addText(s, x + between(-15, 15), GROUND_Y + 6, '🌲', { fontSize: `${Math.round(between(48, 72))}px` }).setOrigin(0.5, 1);
  }
  addText(s, 760, GROUND_Y + 6, '⛺', { fontSize: '64px' }).setOrigin(0.5, 1);
  addText(s, 845, GROUND_Y + 4, '🔥', { fontSize: '40px' }).setOrigin(0.5, 1);
  g.fillStyle(0x5f9e3c).fillRect(0, GROUND_Y, W, 14).fillStyle(0x6e4a2a).fillRect(0, GROUND_Y + 14, W, H - GROUND_Y - 14);
  addText(s, W / 2, GROUND_Y + 30, t.hint, { fontSize: '20px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
}

/** Trestle legs under the deck, the gantry overhead and a surveyor's staff at the outer edge. */
function drawSite(s: Phaser.Scene, c: Crew) {
  const g = s.add.graphics().setDepth(1), col = hex(c.team.color);
  const top = BASE_Y + 24, legH = GROUND_Y - top, cross = top + legH / 2;
  for (const side of [-1, 1]) {
    const lx = c.baseX + side * (BASE_W / 2 - 55);
    for (const lean of [-1, 1]) woodBar(g, { x: lx, y: cross, w: Math.hypot(56, legH) + 8, h: 14, angle: Math.atan2(legH, lean * 56) });
    knot(g, lx, cross);
  }
  woodBar(g, { x: c.baseX, y: top + legH * 0.72, w: BASE_W - 70, h: 12, angle: 0 });
  woodBar(g, { x: c.baseX, y: BASE_Y + 12, w: BASE_W, h: 24, angle: 0 });
  for (const side of [-1, 1]) knot(g, c.baseX + side * (BASE_W / 2 - 55), BASE_Y + 12);
  s.matter.add.rectangle(c.baseX, BASE_Y + 12, BASE_W, 24, { isStatic: true, friction: 0.9 });

  const railL = c.x0 + RAIL_GAP - 30, railR = c.x1 - RAIL_GAP + 30;
  g.lineStyle(4, C.rope).lineBetween(railL + 24, 0, railL + 24, GANTRY_Y).lineBetween(railR - 24, 0, railR - 24, GANTRY_Y);
  woodBar(g, { x: (railL + railR) / 2, y: GANTRY_Y, w: railR - railL, h: 18, angle: 0 });
  for (const x of [railL + 24, railR - 24]) g.fillStyle(col).fillTriangle(x - 16, GANTRY_Y + 9, x + 16, GANTRY_Y + 9, x, GANTRY_Y + 44);

  const sx = c.rulerX;
  for (let m = 0; m < RULER_M; m++) {
    g.fillStyle(m % 2 ? 0xf4f1e8 : 0xd64545).fillRect(sx - 9, BASE_Y - (m + 1) * PX_PER_M, 18, PX_PER_M);
    if (m % 2 === 0 && m) addText(s, sx + c.inward * 24, BASE_Y - m * PX_PER_M, String(m), { fontSize: '18px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(2);
  }
  g.lineStyle(2, 0x222222).strokeRect(sx - 9, BASE_Y - RULER_M * PX_PER_M, 18, RULER_M * PX_PER_M);
}

// ---------- setup ----------

function setUp(s: Phaser.Scene) {
  scene = s;
  drawScenery(s);
  crews = teams.map((team, i) => makeCrew(s, team, i));
  clock = addText(s, W / 2, 4, '', { fontSize: '40px', fontStyle: 'bold', color: '#fff', backgroundColor: '#0009', padding: { x: 16, y: 4 } }).setOrigin(0.5, 0).setDepth(10);
}

function makeCrew(s: Phaser.Scene, team: Team, i: number): Crew {
  const x0 = i * W / 2, x1 = x0 + W / 2, inward = i ? -1 : 1, baseX = (x0 + x1) / 2;
  const crane = s.add.container(baseX, 0).setDepth(4);
  const turnText = addText(s, 34, GANTRY_Y, '', { fontSize: '24px', fontStyle: 'bold', color: '#fff', backgroundColor: '#000a', padding: { x: 8, y: 2 } }).setOrigin(0, 0.5);
  const rope = s.add.rectangle(0, GANTRY_Y, 3, HOOK_Y - GANTRY_Y, C.rope).setOrigin(0.5, 0), hook = s.add.circle(0, HOOK_Y, 6, 0x555555);
  crane.add([rope, hook, s.add.rectangle(0, GANTRY_Y, 48, 22, 0x3a3a3a).setStrokeStyle(3, hex(team.color)), turnText]);
  const c: Crew = {
    team, x0, x1, baseX, inward, rulerX: i ? W - 30 : 30,
    hookY: HOOK_Y, x: baseX, angle: 0, stick: { x: 0, y: 0 }, turnLeft: 0, warned: false, round: 0, cooldown: 0, taken: 0,
    height: 0, best: 0, shown: '', history: [], calm: 0,
    crane, rope, hook, turnText,
    label: addText(s, baseX, GROUND_Y + 30, '', { fontSize: '30px', fontStyle: 'bold', color: team.color, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(10),
    marker: s.add.graphics().setDepth(3),
    markerText: addText(s, 0, 0, '', { fontSize: '22px', fontStyle: 'bold', color: '#fff', backgroundColor: team.color, padding: { x: 6, y: 2 } }).setOrigin(i ? 1 : 0, 0.5).setDepth(10),
  };
  drawSite(s, c);
  showTeam(c);
  return c;
}

/** Name and height on the ground sign; an empty team shows an invitation instead of a crane. */
function showTeam(c: Crew) {
  const { emoji, name, players } = c.team;
  c.label.setText(players.length ? `${emoji} ${name}  ${fmt(c.height)} m` : `${emoji} ${t.joinHere}`);
  c.crane.setVisible(players.length > 0);
}

/** Team-coloured line and arrow at the current height, gold tick and star at the best. */
function drawMarker(c: Crew) {
  const g = c.marker.clear(), col = hex(c.team.color), y = BASE_Y - c.height * PX_PER_M, edge = c.rulerX + c.inward * 9;
  if (c.best > 0) {
    const by = BASE_Y - Math.min(c.best, RULER_M) * PX_PER_M; // a shoved-on piece can top the staff
    g.lineStyle(4, 0xffd23f).lineBetween(c.rulerX - 12, by, c.rulerX + 12, by);
    g.fillStyle(0xffd23f).fillCircle(c.rulerX - c.inward * 20, by, 5);
  }
  c.markerText.setVisible(c.height > 0);
  if (c.height <= 0) return;
  g.lineStyle(3, col, 0.75);
  const far = c.baseX + c.inward * (BASE_W / 2 + 20);
  for (let x = edge + c.inward * 20; (far - x) * c.inward > 0; x += c.inward * 24) g.lineBetween(x, y, x + c.inward * 12, y);
  g.fillStyle(col).fillTriangle(edge, y, edge + c.inward * 16, y - 10, edge + c.inward * 16, y + 10);
  c.markerText.setText(`${fmt(c.height)} m`).setPosition(edge + c.inward * 40, y - 16); // clear of the staff's numbers
}

// ---------- turns ----------

function startTurn(c: Crew): Held {
  const s = scene!, kind = sequence[c.taken++ % sequence.length]!;
  const parts = PIECES[kind].bars.map(b => s.matter.bodies.rectangle(b.x, b.y, b.w, b.h, { ...WOOD, angle: b.angle }));
  const body = parts.length > 1 ? s.matter.body.create({ ...WOOD, parts }) : parts[0]!;
  // Matter centres a compound body on its centre of mass: draw the wood around that point.
  const held: Held = { kind, body, g: drawPiece(s, kind, { ...body.position }) };
  c.held = held;
  c.x = c.baseX;
  c.angle = 0;
  liftHook(c, body);
  setBuilder(c, nextBuilder(c.team.players, c.last));
  return held;
}

/** A tall tower lifts the hook, so the new piece hangs above the tower instead of inside it. */
function liftHook(c: Crew, body: MatterJS.BodyType) {
  let top = BASE_Y;
  for (const p of pieces) if (p.crew === c) top = Math.min(top, p.body.bounds.min.y);
  c.hookY = Phaser.Math.Clamp(top - HOOK_GAP - (body.bounds.max.y - body.position.y), HOOK_TOP, HOOK_Y);
  c.rope.scaleY = (c.hookY - GANTRY_Y) / (HOOK_Y - GANTRY_Y);
  c.hook.y = c.hookY;
}

/** Hands the piece on the hook to `p` with a fresh turn (nobody: it hangs until the turn runs out). */
function setBuilder(c: Crew, p: Player | undefined) {
  c.builder = p;
  c.round = ++rounds;
  c.stick = { x: 0, y: 0 };
  c.turnLeft = TURN_S;
  c.warned = false;
  c.token?.destroy();
  c.token = p && addPlayerToken(scene!, p, 0, GANTRY_Y, { r: 24, ring: hex(c.team.color) });
  if (c.token) c.crane.addAt(c.token, 3); // under the turn countdown
  sendCrew(c, true);
}

function drop(c: Crew) {
  const s = scene!, held = c.held!;
  s.matter.body.setPosition(held.body, { x: c.x, y: c.hookY });
  s.matter.body.setAngle(held.body, c.angle);
  s.matter.world.add(held.body);
  held.g.setDepth(5); // part of the tower now: over the crane's rope
  pieces.add({ ...held, crew: c, by: c.builder, rest: { still: 0, counted: false } });
  c.held = undefined;
  c.last = c.builder ?? c.last;
  c.cooldown = DROP_COOLDOWN_MS / 1000;
  c.turnText.setVisible(false);
  sendCrew(c);
}

// ---------- phones ----------

function builderUi(c: Crew): ControllerUi {
  const piece = c.held ? PIECES[c.held.kind].name[ctx.lang] : '';
  return { layout: 'stick', round: c.round, button: t.drop, text: t.turn, sub: `${piece} · ${c.team.emoji} ${c.team.name}\n${t.hint}`, color: c.team.color };
}

function waitUi(c: Crew, p: Player): ControllerUi {
  const team = `${c.team.emoji} ${c.team.name}`, height = `📏 ${fmt(c.height)} m`;
  const color = c.team.color; // phones in team colour
  if (phase === 'over') return { layout: 'wait', text: banner, sub: `${team}\n${height}`, color };
  if (phase === 'settle') return { layout: 'wait', text: team, sub: `${t.measuring}\n${height}`, color };
  const up = nextBuilder(c.team.players, c.held ? c.builder : c.last);
  const next = up === p ? t.nextYou : up ? t.next(up.name) : '';
  return { layout: 'wait', text: team, sub: [next, height].filter(Boolean).join('\n'), color };
}

/** Everyone in the team gets their controller; the builder's phone buzzes when a turn starts. */
function sendCrew(c: Crew, turnStart = false) {
  for (const p of c.team.players) {
    if (p !== c.builder || !c.held || phase !== 'play') ctx.send(p, waitUi(c, p));
    else ctx.send(p, turnStart ? { ...builderUi(c), buzz: [60, 40, 60] } : builderUi(c));
  }
}

// ---------- loop ----------

function tick(s: Phaser.Scene, dt: number) {
  elapsed += dt;
  for (const cloud of clouds) cloud.x = cloud.x > W + 150 ? -150 : cloud.x + 12 * dt;
  if (phase === 'play' && (timeLeft -= dt) <= 0) startSettle();
  else if (phase === 'settle' && (settleLeft -= dt) <= 0) finish(s);
  for (const c of crews) runCrane(c, dt);
  for (const p of pieces) track(s, p, dt);
  if (phase !== 'over') {
    const tower = [...pieces].map(p => ({ x: p.body.position.x, top: p.body.bounds.min.y, counted: p.rest.counted }));
    for (const c of crews) measure(s, c, towerHeight(tower, c.x0, c.x1, BASE_Y));
  }
  const left = Math.ceil(Math.max(0, timeLeft)); // round once: 149.5 s must read 2:30
  clock.setText(phase === 'play' ? `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : phase === 'settle' ? `📏 ${Math.ceil(settleLeft)}` : '');
  clock.setVisible(phase !== 'over');
}

/** One crane, one frame: the next turn once the drop cooldown is over, steering, the turn countdown and the auto-drop. */
function runCrane(c: Crew, dt: number) {
  if (phase !== 'play' || !c.team.players.length) return;
  if (!c.held && (c.cooldown -= dt) > 0) return;
  const held = c.held ?? startTurn(c); // a new piece is placed below in this frame: never drawn at (0, 0)
  c.x = Phaser.Math.Clamp(c.x + c.stick.x * MOVE_PX_S * dt, c.x0 + RAIL_GAP, c.x1 - RAIL_GAP);
  c.angle += Phaser.Math.DegToRad(c.stick.y * ROT_DEG_S * dt); // stick up (y < 0) turns counter-clockwise
  held.g.setPosition(c.x, c.hookY).setRotation(c.angle);
  c.crane.x = c.x;
  c.turnLeft -= dt;
  c.turnText.setVisible(true).setText(String(Math.max(1, Math.ceil(c.turnLeft)))).setColor(c.turnLeft <= WARN_S ? '#ff5a5f' : '#fff');
  if (c.turnLeft <= WARN_S && !c.warned) {
    c.warned = true;
    if (c.builder) ctx.send(c.builder, { ...builderUi(c), buzz: 200 });
  }
  if (c.turnLeft <= 0) drop(c);
}

/** Moves the wood with its body; a piece that hits the ground or leaves its team's half is lost. */
function track(s: Phaser.Scene, p: Piece, dt: number) {
  const b = p.body;
  p.g.setPosition(b.position.x, b.position.y).setRotation(b.angle);
  settle(p.rest, b.speed, b.angularSpeed, dt);
  // Spilled into the other half: it must not prop up, knock over or count for the other tower.
  if (b.bounds.max.y < GROUND_Y && b.position.x >= p.crew.x0 && b.position.x < p.crew.x1) return;
  pieces.delete(p);
  s.matter.world.remove(b);
  s.tweens.add({ targets: p.g, alpha: 0, y: p.g.y + 14, duration: 350, onComplete: () => p.g.destroy() });
  float(s, Phaser.Math.Clamp(b.position.x, 40, W - 40), Math.min(b.position.y, GROUND_Y - 30), '-1', '#ff5a5f', 34);
  blip(620, 160, 0.14, 'sine', 0.2); // plop
}

function measure(s: Phaser.Scene, c: Crew, height: number) {
  c.height = height;
  c.best = Math.max(c.best, height);
  if (crashed(c.history, elapsed, height) && elapsed >= c.calm) {
    c.calm = elapsed + CRASH_S;
    float(s, c.baseX, BASE_Y - 260, t.crash, '#ff5a5f', 84);
    s.cameras.main.shake(450, 0.012);
    blip(150, 40, 0.5, 'triangle', 0.45);
  }
  const shown = fmt(height);
  if (shown === c.shown) return;
  c.shown = shown;
  drawMarker(c);
  showTeam(c);
}

/** Text that rises and fades. */
function float(s: Phaser.Scene, x: number, y: number, text: string, color: string, size: number) {
  const f = addText(s, x, y, text, { fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(12);
  s.tweens.add({ targets: f, y: y - 70, alpha: 0, scale: 1.2, duration: 1200, onComplete: () => f.destroy() });
}

/** A short pitch sweep on the big screen's speakers (the host unlocked audio when the game started). */
function blip(from: number, to: number, seconds: number, type: OscillatorType, vol: number) {
  const a = audioContext(), t0 = a.currentTime;
  const o = new OscillatorNode(a, { type, frequency: from });
  const g = new GainNode(a, { gain: vol });
  o.frequency.exponentialRampToValueAtTime(to, t0 + seconds);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + seconds);
}

// ---------- the end ----------

/** Time is up: the cranes take back their pieces and the towers settle before the measuring. */
function startSettle() {
  phase = 'settle';
  for (const c of crews) {
    c.held?.g.destroy();
    c.held = undefined;
    c.builder = undefined;
    c.token?.destroy();
    c.token = undefined;
    c.turnText.setVisible(false);
    sendCrew(c);
  }
}

function finish(s: Phaser.Scene) {
  phase = 'over';
  const won = winners(teams, crews.map(c => c.height));
  for (const i of won) {
    const c = crews[i]!, crown = addText(s, c.baseX, BASE_Y - c.height * PX_PER_M - 60, '👑', { fontSize: '96px' }).setOrigin(0.5).setDepth(12);
    s.tweens.add({ targets: crown, y: crown.y - 24, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const champ = won.length === 1 ? crews[won[0]!]!.team : undefined;
  banner = champ ? t.wins(`${champ.emoji} ${champ.name}`) : won.length ? t.tie : t.none;
  const b = addText(s, W / 2, 330, banner, { fontSize: '76px', fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setDepth(20);
  b.setScale(Math.min(1, 640 / b.width)); // stays between the two crowns (German texts are long)
  s.cameras.main.flash(300, 255, 230, 140);
  for (const c of crews) sendCrew(c); // the banner and the measured height
  // Points: the tower's height for the whole team, the win bonus, and a bonus per own piece still standing
  // (track() already took away every piece that left its team's half).
  const standing = new Map<Player, number>();
  for (const p of pieces) if (p.by) standing.set(p.by, (standing.get(p.by) ?? 0) + 1);
  const scores = crews.flatMap((c, i) => c.team.players.map((p): Score => [p, points(c.height, won.includes(i), standing.get(p) ?? 0)]));
  const champs = won.flatMap(i => crews[i]!.team.players);
  endTimer = setTimeout(() => ctx.end(scores, champs), RESULT_S * 1000);
}

// ---------- input ----------

const axis = (v: number) => (Math.abs(v) < DEAD ? 0 : v);

function input(p: Player, msg: GameInput) {
  const c = crews.find(c => c.team.players.includes(p));
  if (!c) return; // still booting
  if (msg.t === 'presence') return presence(c, p);
  if (phase !== 'play' || p !== c.builder || !c.held) return;
  if (msg.t === 'stick') c.stick = { x: axis(msg.x), y: axis(msg.y) };
  if (msg.t === 'button' && msg.down) drop(c);
}

// The builder dropped out: the next online teammate takes the piece. Nobody online: it auto-drops when the turn ends.
// Someone came back to (or joined) a team without a builder: they take it. Anything else moves the crew's "Next:" line.
function presence(c: Crew, p: Player) {
  if (p === c.builder) c.stick = { x: 0, y: 0 };
  const next = phase === 'play' && c.held && !c.builder?.online ? nextBuilder(c.team.players, c.builder) : undefined;
  if (next) setBuilder(c, next); // sends the crew too
  else sendCrew(c); // same round for the builder: their stick is not remounted
}

function join(p: Player) {
  const c = crews[joinTeam(teams, p).index];
  if (!c) return; // still booting: setUp() builds the crews from the teams
  showTeam(c); // an empty half gets its crane; runCrane() starts the first turn
  presence(c, p);
}
</script>

<template>
  <div ref="stage" class="tower" />
</template>

<style scoped>
.tower { height: 100%; }
</style>
