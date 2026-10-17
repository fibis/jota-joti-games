// Static files + a dumb WebSocket relay. The big screen (host) runs all game logic;
// phones only send input and render whatever controller layout the host tells them to.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dns from 'node:dns/promises';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/$/, ''); // e.g. a named Cloudflare tunnel
const ROOT = path.join(import.meta.dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const PHASER = path.join(import.meta.dirname, 'node_modules/phaser/dist/phaser.min.js');

// First real LAN address; skips docker/VM bridges. Override with HOST_IP=... if it picks wrong.
function lanIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  for (const [name, addrs] of Object.entries(os.networkInterfaces()))
    if (!/^(docker|br-|veth|virbr|vmnet|vboxnet|tailscale|lo)/.test(name))
      for (const a of addrs) if (a.family === 'IPv4' && !a.internal) return a.address;
  return 'localhost';
}

const server = http.createServer((req, res) => {
  const p = URL.parse(req.url, 'http://x')?.pathname; // URL.parse, not new URL: "GET //" must not crash us
  if (!p) return res.writeHead(400).end();
  const file = p === '/lib/phaser.js' ? PHASER
    : /^\/[A-Za-z]{4}$/.test(p) ? path.join(ROOT, 'play.html') // short join link: /ABCD
    : path.join(ROOT, path.normalize(p === '/' ? '/index.html' : p));
  if (file !== PHASER && !file.startsWith(ROOT)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(data);
  });
});

const rooms = new Map(); // code -> { host: ws|null, key, players: Map<id, ws> }; dropped when empty
const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('');
const room = code => rooms.get(code) ?? rooms.set(code, { host: null, players: new Map() }).get(code);
const prune = code => { const r = rooms.get(code); if (r && !r.host && !r.players.size) rooms.delete(code); };
const parse = m => { try { return JSON.parse(m); } catch { return null; } };
// Never throws (stringify can blow the stack on hostile nesting) and drops messages
// for peers that stopped reading instead of buffering them until we run out of memory.
const send = (ws, msg) => { try { if (ws?.readyState === 1 && ws.bufferedAmount < 1e6) ws.send(JSON.stringify(msg)); } catch {} };

// Where phones join: a tunnel/public URL if we have one, else this machine on the LAN.
let publicUrl = PUBLIC_URL;
async function sendRoom(ws, code) {
  const url = `${publicUrl || `http://${lanIp()}:${PORT}`}/${code}`;
  send(ws, { t: 'room', code, key: rooms.get(code)?.key, url, qr: await QRCode.toString(url, { type: 'svg', margin: 1 }) });
}
function setPublicUrl(url) {
  publicUrl = url;
  for (const [code, r] of rooms) if (r.host) sendRoom(r.host, code); // refresh QR codes already on screen
}

const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });
wss.on('connection', (ws, req) => {
  ws.on('error', () => {}); // bad frame / too big: ws closes that socket; without a listener it would crash the server
  ws.on('pong', () => ws.alive = true);
  ws.alive = true;
  const q = URL.parse(req.url, 'http://x')?.searchParams ?? new URLSearchParams();
  let code = (q.get('room') || '').toUpperCase();

  if (q.get('role') === 'host') {
    // A reloading big screen reclaims its old code (proving it with the room key) so phones reconnect on their own.
    const old = rooms.get(code);
    if (!/^[A-Z]{4}$/.test(code) || old?.host || (old?.key && old.key !== q.get('key'))) do code = newCode(); while (rooms.has(code));
    const r = room(code);
    r.host = ws;
    r.key ??= crypto.randomUUID();
    sendRoom(ws, code);
    for (const [id, p] of r.players) send(ws, { t: 'join', id, name: p.name });
    ws.on('message', m => {
      const { to, d } = parse(m) ?? {};
      for (const [id, p] of r.players) if (to == null || to === id) send(p, d);
    });
    ws.on('close', () => { if (r.host === ws) r.host = null; prune(code); });
    return;
  }

  const id = q.get('id') || '';
  if (!/^[A-Z]{4}$/.test(code) || !/^\d{1,40}$/.test(id)) return ws.close(); // phones use numeric ids; kb-* belong to the big screen
  const r = room(code);
  ws.name = String(q.get('name') || 'Scout').slice(0, 14);
  r.players.get(id)?.close(4000); // same id again: a reload (old socket is dead) or a duplicated tab (told to stop)
  r.players.set(id, ws);
  if (r.host) send(r.host, { t: 'join', id, name: ws.name });
  else send(ws, { nohost: true });
  ws.on('message', m => { const d = parse(m); if (d) send(r.host, { t: 'msg', id, d }); });
  ws.on('close', () => {
    if (r.players.get(id) !== ws) return;
    r.players.delete(id);
    send(r.host, { t: 'leave', id });
    prune(code);
  });
});

// Heartbeat: keeps idle sockets open through proxies (measured: Cloudflare drops idle ones after ~2 min)
// and closes phones that vanished without saying goodbye.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30_000);

server.listen(PORT, () => console.log(`\n  📻 JOTA-JOTI Games\n  Big screen: http://localhost:${PORT}\n  Phones join via QR code on the big screen (${publicUrl || lanIp()})\n`));

// A fresh quick-tunnel hostname needs a few seconds to exist in DNS. Phones that look it up too early
// get "not found", and some resolvers cache that for minutes. So only show it once trycloudflare.com's
// own nameservers answer (they never cache). Gives up after ~30 s (e.g. outside DNS blocked) and shows it anyway.
async function dnsReady(host) {
  const end = Date.now() + 30_000;
  try {
    const auth = new dns.Resolver({ timeout: 1000, tries: 1 });
    auth.setServers(await Promise.all((await dns.resolveNs('trycloudflare.com')).map(async ns => (await dns.lookup(ns, { family: 4 })).address)));
    while (Date.now() < end) {
      try { return await auth.resolve4(host); } catch { await new Promise(r => setTimeout(r, 1000)); }
    }
  } catch {} // no DNS at all: don't block
}

// `npm run tunnel`: TryCloudflare quick tunnel, so phones can join over https from any network.
if (process.argv.includes('--tunnel')) {
  console.log('  🌍 Starting Cloudflare quick tunnel…');
  const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let seen;
  const watch = async chunk => {
    const url = String(chunk).match(/https:\/\/(?!api\.)[-a-z0-9]+\.trycloudflare\.com/)?.[0];
    if (!url || url === seen) return;
    seen = url;
    await dnsReady(new URL(url).hostname);
    if (seen !== url) return;
    setPublicUrl(url);
    console.log(`  🌍 Phones join via ${url} (any network)\n`);
  };
  cf.stdout.on('data', watch);
  cf.stderr.on('data', watch);
  cf.on('error', () => console.log('  ❌ cloudflared not found. Install it (Arch: sudo pacman -S cloudflared), see https://try.cloudflare.com'));
  cf.on('exit', code => { seen = null; if (code !== null) console.log(`  ⚠️  cloudflared stopped (${code}); phones need the local Wi-Fi again`); setPublicUrl(PUBLIC_URL); });
  process.on('exit', () => cf.kill());
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit());
}
