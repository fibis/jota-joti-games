import assert from 'node:assert/strict';
import { CODE, DECODE, DAH_MS, MorseKey } from './public/morse.js';
import { QUESTIONS } from './public/games/quiz.js';
import { WORDS } from './public/games/morse-master.js';

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

// Both languages: 4 distinct answers per question, same question count, Morse words only use keyable letters.
for (const lang of ['en', 'de']) {
  for (const [, q, ...a] of QUESTIONS[lang]) assert.equal(new Set(a).size, 4, q);
  for (const w of WORDS[lang].flat()) for (const c of w) assert.ok(CODE[c], w);
  assert.equal(WORDS[lang].length, 4);
}
assert.equal(QUESTIONS.de.length, QUESTIONS.en.length);

console.log(`ok — ${QUESTIONS.en.length} questions and ${WORDS.en.flat().length}/${WORDS.de.flat().length} words (en/de)`);
