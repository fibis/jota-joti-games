// Fox Hunt (ARDF): a hidden transmitter is somewhere in the forest. Every scout's phone
// plays its "MO" beacon, louder and faster the closer they get. Touch the fox to catch it.
const W = 1600, H = 900, SPEED = 320, CATCH = 36, HEAR = 1100, GAME_S = 180, WIN = 5;
const SCOUT_R = 22, TREE_R = 26;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp1 = v => Math.max(-1, Math.min(1, Number(v) || 0));
const TXT = {
  en: { hint: 'Follow your radio! 📡 The beeps get louder and faster near the fox 🦊', goal: `🏆 First to ${WIN}`, wins: 'wins!', away: 'The fox got away!', find: '🦊 Find the fox!', caught: 'Foxes caught', got: '🦊 Caught it!' },
  de: { hint: 'Folge deinem Funkgerät! 📡 Nah am Fuchs piept es lauter und schneller 🦊', goal: `🏆 Ziel: ${WIN} Füchse`, wins: 'gewinnt!', away: 'Der Fuchs ist entkommen!', find: '🦊 Finde den Fuchs!', caught: 'Gefangene Füchse', got: '🦊 Erwischt!' },
};

export function start(api) {
  const t = TXT[api.lang] ?? TXT.en;
  const scouts = new Map(); // player -> { box, bar, vx, vy, sig, sentSig, sentAt }
  const score = new Map(api.players.map(p => [p, 0]));
  const trees = [];
  let scene, fox, clock, board, timeLeft = GAME_S, over = false, endTimer;

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: api.stage, width: W, height: H, backgroundColor: '#2b5236',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false },
    scene: { create() { scene = this; create(); }, update(_, dt) { update(Math.min(dt, 50) / 1000); } },
  });

  const text = (x, y, s, style) => scene.add.text(x, y, s, { fontFamily: 'system-ui, sans-serif', ...style });
  const free = (x, y, r) => trees.every(t => Math.hypot(t.x - x, t.y - y) > r);

  function create() {
    const g = scene.add.graphics();
    for (let i = 0; i < 120; i++) g.fillStyle(Math.random() < .5 ? 0x24472e : 0x335f3f, .6).fillCircle(rnd(0, W), rnd(0, H), rnd(20, 90));
    for (let i = 0; i < 40; i++) text(rnd(0, W), rnd(0, H), Phaser.Utils.Array.GetRandom(['🌿', '🍄', '🪨', '🌾']), { fontSize: '22px' }).setOrigin(.5).setAlpha(.7);
    text(W / 2, H / 2, '⛺', { fontSize: '64px' }).setOrigin(.5);
    for (let tries = 0; trees.length < 50 && tries < 2000; tries++) {
      const x = rnd(40, W - 40), y = rnd(40, H - 40);
      if (Math.hypot(x - W / 2, y - H / 2) > 170 && free(x, y, 85)) {
        trees.push({ x, y });
        text(x, y, Math.random() < .6 ? '🌲' : '🌳', { fontSize: '58px' }).setOrigin(.5, .7).setDepth(y);
      }
    }
    clock = text(24, 18, '', { fontSize: '40px', fontStyle: 'bold', color: '#fff', backgroundColor: '#0008', padding: { x: 14, y: 6 } }).setDepth(H + 10);
    board = text(W - 24, 18, '', { fontSize: '28px', color: '#fff', backgroundColor: '#0008', padding: { x: 14, y: 10 }, lineSpacing: 6, align: 'left' }).setOrigin(1, 0).setDepth(H + 10);
    text(W / 2, H - 30, t.hint, { fontSize: '24px', color: '#fff', backgroundColor: '#0008', padding: { x: 12, y: 6 } }).setOrigin(.5).setDepth(H + 10);
    [...score.keys()].forEach(addScout); // includes anyone who joined while Phaser was booting
    hideFox();
    drawBoard();
  }

  function addScout(p, i = scouts.size) {
    const a = i * 2.4, x = W / 2 + Math.cos(a) * 110, y = H / 2 + Math.sin(a) * 90;
    const name = text(0, 34, p.name, { fontSize: '20px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 4 }).setOrigin(.5);
    const bar = scene.add.rectangle(-24, -36, 48, 7, 0xffd23f).setOrigin(0, .5);
    const box = scene.add.container(x, y, [
      scene.add.ellipse(0, 20, 40, 12, 0x000000, .3),
      scene.add.circle(0, 0, SCOUT_R, Phaser.Display.Color.HexStringToColor(p.color).color).setStrokeStyle(3, 0xffffff),
      text(0, 0, p.avatar, { fontSize: '28px' }).setOrigin(.5),
      name, scene.add.rectangle(-24, -36, 48, 7, 0x000000, .5).setOrigin(0, .5), bar,
    ]);
    scouts.set(p, { box, bar, vx: 0, vy: 0, sig: 0, sentSig: -1, sentAt: 0 });
  }

  // New fox spot: clear of trees and far from every scout.
  function hideFox() {
    for (let tries = 0; tries < 500; tries++) {
      const x = rnd(60, W - 60), y = rnd(80, H - 80);
      if (free(x, y, 60) && [...scouts.values()].every(s => Math.hypot(s.box.x - x, s.box.y - y) > 450)) return fox = { x, y };
    }
    fox = { x: rnd(60, W - 60), y: rnd(80, H - 80) };
  }

  function update(dt) {
    if (!scene || over) return;
    timeLeft -= dt;
    clock.setText(`⏱ ${Math.floor(Math.max(0, timeLeft) / 60)}:${String(Math.ceil(Math.max(0, timeLeft)) % 60).padStart(2, '0')}`);
    if (timeLeft <= 0) return finish();
    const now = scene.time.now;
    for (const [p, s] of scouts) {
      const b = s.box;
      b.x = Phaser.Math.Clamp(b.x + s.vx * SPEED * dt, SCOUT_R, W - SCOUT_R);
      b.y = Phaser.Math.Clamp(b.y + s.vy * SPEED * dt, SCOUT_R, H - SCOUT_R);
      for (const t of trees) { // push out of tree trunks
        const dx = b.x - t.x, dy = b.y - t.y, d = Math.hypot(dx, dy), min = SCOUT_R + TREE_R;
        if (d < min && d > 0) { b.x = t.x + dx / d * min; b.y = t.y + dy / d * min; }
      }
      b.setDepth(b.y);
      const d = Math.hypot(b.x - fox.x, b.y - fox.y);
      s.sig = Math.max(0, 1 - d / HEAR) ** 2;
      s.bar.width = 48 * s.sig;
      if (d < CATCH) return caught(p);
      if (now - s.sentAt > 200 && Math.abs(s.sig - s.sentSig) > .02) {
        s.sentAt = now;
        s.sentSig = s.sig;
        api.send(p, { layout: 'stick', meter: +s.sig.toFixed(2), text: t.find, sub: `${t.caught}: ${score.get(p)}` });
      }
    }
  }

  function caught(p) {
    score.set(p, score.get(p) + 1);
    const f = text(fox.x, fox.y, '🦊', { fontSize: '80px' }).setOrigin(.5).setDepth(H + 5).setScale(0);
    scene.tweens.add({ targets: f, scale: 1.3, duration: 250, yoyo: true, hold: 600, onComplete: () => f.destroy() });
    const msg = text(fox.x, fox.y - 60, `${p.avatar} ${p.name} +1`, { fontSize: '34px', fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 6 }).setOrigin(.5).setDepth(H + 6);
    scene.tweens.add({ targets: msg, y: fox.y - 140, alpha: 0, duration: 1600, onComplete: () => msg.destroy() });
    scene.cameras.main.flash(200, 255, 220, 120);
    api.send(p, { layout: 'stick', meter: 0, text: t.got, sub: `${t.caught}: ${score.get(p)}`, buzz: 300 });
    for (const s of scouts.values()) s.sentSig = -1; // force a fresh signal to everyone
    drawBoard();
    if (score.get(p) >= WIN) return finish();
    hideFox();
  }

  function drawBoard() {
    board.setText([t.goal, ...[...score].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p.avatar} ${p.name.padEnd(10)} ${'🦊'.repeat(n) || '–'}`)].join('\n'));
  }

  function finish() {
    over = true;
    const [[best, n]] = [...score].sort((a, b) => b[1] - a[1]);
    text(fox.x, fox.y, '🦊', { fontSize: '80px' }).setOrigin(.5).setDepth(H + 5); // reveal the last hiding spot
    text(W / 2, H / 2, n ? `${best.avatar} ${best.name} ${t.wins}` : t.away, { fontSize: '90px', fontStyle: 'bold', color: '#ffd23f', stroke: '#000', strokeThickness: 10 }).setOrigin(.5).setDepth(H + 20);
    endTimer = setTimeout(() => api.end([...score]), 4000);
  }

  return {
    input(p, d) {
      const s = scouts.get(p);
      if (s && d.t === 'stick') { s.vx = clamp1(d.x); s.vy = clamp1(d.y); }
      if (s && d.t === 'presence') s.vx = s.vy = 0; // dropped or reconnected: stop until they touch the stick again
    },
    join(p) { score.set(p, 0); if (scene) { addScout(p); drawBoard(); } },
    stop() { clearTimeout(endTimer); game.destroy(true); },
  };
}
