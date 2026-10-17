// Morse Master: everyone keys the same word in Morse on their phone. First correct = most points.
import { CODE, playWord } from '../morse.js';

// Word tiers per language; A-Z only (no umlauts: not in the Morse table).
export const WORDS = {
  en: [
    ['SOS'],
    ['JOTA', 'JOTI', 'CAMP', 'TENT', 'FIRE', 'HIKE', 'KNOT', 'MAP', 'OWL', 'SUN'],
    ['SCOUT', 'RADIO', 'BADGE', 'CANOE', 'TORCH', 'PEACE', 'WORLD'],
    ['PATROL', 'COMPASS', 'LANTERN', 'FRIEND', 'WOGGLE'],
  ],
  de: [
    ['SOS'],
    ['JOTA', 'JOTI', 'ZELT', 'WALD', 'FUNK', 'EULE', 'MOND', 'BOOT'],
    ['LAGER', 'FEUER', 'KARTE', 'FUCHS', 'FAHRT', 'SIPPE', 'STERN'],
    ['KNOTEN', 'KOMPASS', 'LATERNE', 'FREUND', 'FRIEDEN'],
  ],
};
const TXT = {
  en: { round: 'Round', title: '📡 Morse Master — short tap = · long press = −', noHint: 'No hints now — use the code sheet! 👇', over: '⏱ Round over!', nextWord: ' Next word coming…', timeUp: '⏱ Time’s up', score: 'Score', done: '✓ Done!', next: 'next' },
  de: { round: 'Runde', title: '📡 Morse-Meister — kurz tippen = · lang drücken = −', noHint: 'Keine Hilfe mehr – nutz die Tabelle! 👇', over: '⏱ Runde vorbei!', nextWord: ' Gleich kommt das nächste Wort…', timeUp: '⏱ Zeit um', score: 'Punkte', done: '✓ Geschafft!', next: 'nächster' },
};
const PLAN = [0, 1, 1, 2, 2, 3]; // tier per round
const ROUND_S = 60, HINT_ROUNDS = 3, POINTS = [5, 4, 3], LATE = 2;
const pretty = s => s.replace(/\./g, '·').replace(/-/g, '−');

export function start(api) {
  const t = TXT[api.lang] ?? TXT.en, TIERS = WORDS[api.lang] ?? WORDS.en;
  const score = new Map(api.players.map(p => [p, 0]));
  const st = new Map(); // player -> { typed, sym, done, pts, bad }
  const used = new Set();
  let round = -1, word = '', left = 0, finished = 0, active = false, tick, next;

  api.stage.innerHTML = `<style>
    .mm { height: 100%; display: flex; flex-direction: column; padding: 2vw 3vw; gap: 1.2vw; }
    .mm .top { display: flex; justify-content: space-between; align-items: baseline; font-size: 1.3em; color: var(--muted); }
    .mm .timer { font: 900 1.8em ui-monospace, monospace; color: var(--fire); }
    .mm .word { text-align: center; font: 900 6em/1 ui-monospace, monospace; letter-spacing: .25em; }
    .mm .hint { text-align: center; font: 800 2.2em ui-monospace, monospace; color: var(--fire); white-space: pre; min-height: 1.3em; }
    .mm .rows { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(24em, 1fr)); gap: .5em; align-content: start; overflow: hidden; }
    .mm .row { display: flex; align-items: center; gap: .6em; background: var(--panel); border-left: .45em solid var(--c); border-radius: .5em; padding: .4em .8em; transition: background .2s; }
    .mm .row.done { background: #1d5233; } .mm .row.bad { background: #5a1f22; }
    .mm .av { font-size: 1.4em; }
    .mm .prog i { display: inline-block; width: 1.2em; margin-right: .15em; border-bottom: 3px solid #ffffff44; text-align: center; font: normal 900 1em ui-monospace, monospace; }
    .mm .prog i.on { color: var(--good); border-color: var(--good); }
    .mm .sym { font: 800 1.2em ui-monospace, monospace; color: var(--fire); }
    .mm .sc { margin-left: auto; font-weight: 900; font-size: 1.2em; }
    .mm .sheet { display: grid; grid-template-columns: repeat(13, 1fr); gap: .3em; font: 600 .95em ui-monospace, monospace; }
    .mm .sheet span { background: var(--panel); border-radius: .3em; padding: .15em .4em; display: flex; justify-content: space-between; }
    .mm .sheet b { color: var(--fire); }
  </style>
  <div class="mm">
    <div class="top"><span class="round"></span><span>${t.title}</span><span class="timer"></span></div>
    <div class="word"></div>
    <div class="hint"></div>
    <div class="rows"></div>
    <div class="sheet">${Object.entries(CODE).filter(([c]) => c > '9').map(([c, m]) => `<span><b>${c}</b>${pretty(m)}</span>`).join('')}</div>
  </div>`;
  const $ = s => api.stage.querySelector(s);

  function nextRound() {
    if (++round >= PLAN.length) return api.end([...score]);
    const pool = TIERS[PLAN[round]].filter(w => !used.has(w));
    used.add(word = pool[Math.random() * pool.length | 0]);
    left = ROUND_S; finished = 0; active = true;
    for (const p of score.keys()) st.set(p, { typed: '', sym: '', done: false });
    $('.round').textContent = `${t.round} ${round + 1} / ${PLAN.length}`;
    $('.timer').textContent = left;
    $('.word').textContent = word;
    $('.hint').textContent = round < HINT_ROUNDS ? [...word].map(c => pretty(CODE[c])).join('   ') : t.noHint;
    playWord(word);
    for (const p of score.keys()) sendKey(p);
    render();
    tick = setInterval(() => { $('.timer').textContent = --left; if (left <= 0) endRound(); }, 1000);
  }

  function endRound() {
    active = false;
    clearInterval(tick);
    $('.hint').textContent = t.over + (round + 1 < PLAN.length ? t.nextWord : '');
    for (const p of score.keys()) api.send(p, { layout: 'wait', text: st.get(p).done ? `✓ +${st.get(p).pts}` : t.timeUp, sub: `${t.score}: ${score.get(p)}` });
    next = setTimeout(nextRound, 4000);
  }

  function sendKey(p, extra) {
    const s = st.get(p), c = word[s.typed.length];
    const sub = s.done ? `${t.done} +${s.pts}` : `${s.typed}${'_'.repeat(word.length - s.typed.length)}${round < HINT_ROUNDS ? `\n${t.next}: ${c}  ${pretty(CODE[c])}` : ''}`;
    api.send(p, { layout: 'key', round, text: word, sub, ...extra });
  }

  function render() {
    $('.rows').innerHTML = [...st].map(([p, s]) => `
      <div class="row ${s.done ? 'done' : s.bad ? 'bad' : ''}" style="--c:${p.color}">
        <span class="av">${p.avatar}</span><span>${api.esc(p.name)}</span>
        <span class="prog">${[...word].map((c, i) => i < s.typed.length ? `<i class="on">${c}</i>` : '<i></i>').join('')}</span>
        <span class="sym">${s.done ? `✓ +${s.pts}` : s.bad ? `✗ ${api.esc(s.bad)}` : pretty(s.sym)}</span>
        <span class="sc">${score.get(p)}</span>
      </div>`).join('');
  }

  next = setTimeout(nextRound, 500);

  return {
    input(p, d) {
      const s = st.get(p);
      if (!s || !active || s.done) return;
      if (d.t === 'sym') s.sym = String(d.s ?? '').replace(/[^.-]/g, '').slice(0, 8);
      if (d.t === 'letter') {
        const c = String(d.c ?? '').toUpperCase().slice(0, 1);
        s.sym = '';
        s.bad = c === word[s.typed.length] ? null : c;
        if (!s.bad) s.typed += c;
        if (s.typed === word) {
          s.done = true;
          s.pts = POINTS[finished++] ?? LATE;
          score.set(p, score.get(p) + s.pts);
        }
        sendKey(p, s.bad ? { buzz: 150 } : s.done ? { buzz: [80, 60, 80] } : {});
      }
      render();
      if ([...st].every(([p, s]) => s.done || !p.online)) endRound();
    },
    join(p) { score.set(p, 0); st.set(p, { typed: '', sym: '', done: false }); if (active) sendKey(p); render(); },
    stop() { clearInterval(tick); clearTimeout(next); active = false; round = PLAN.length; },
  };
}
