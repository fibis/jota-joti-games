import assert from 'node:assert/strict';
import { CODE, DECODE, DAH_MS, MorseKey } from './public/morse.js';
import { QUESTIONS } from './public/games/quiz.js';
import { TIERS } from './public/games/morse-master.js';

// Morse table is a clean two-way mapping.
for (const [c, m] of Object.entries(CODE)) assert.equal(DECODE[m], c);

// Key timing: short = dit, long = dah, garbage = '?'.
const out = [];
const key = new MorseKey(c => out.push(c));
const press = (...lens) => { let t = 1000; for (const l of lens) { key.down(t); key.up(t += l); t += 100; } key.flush(); };
press(50, 50, 50); // S
press(DAH_MS + 50, DAH_MS + 50, DAH_MS + 50); // O
press(50, DAH_MS + 1); // A
press(...Array(8).fill(50)); // 8 dits: not a letter
assert.deepEqual(out, ['S', 'O', 'A', '?']);

// Quiz: 4 distinct answers each; Morse words only use keyable letters.
for (const [, q, ...a] of QUESTIONS) assert.equal(new Set(a).size, 4, q);
for (const w of TIERS.flat()) for (const c of w) assert.ok(CODE[c], w);

console.log(`ok — ${QUESTIONS.length} questions, ${TIERS.flat().length} words`);
