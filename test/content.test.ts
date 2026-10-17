import { describe, expect, it } from 'vitest';
import { CODE } from '#shared/morse';
import { LANGS } from '#shared/protocol';
import { COUNT, QUESTIONS } from '~/games/quiz/questions';
import { PLAN, WORDS } from '~/games/morse-master/words';

describe.each(LANGS)('content (%s)', lang => {
  it('quiz: enough questions, 4 distinct answers each', () => {
    expect(QUESTIONS[lang].length).toBeGreaterThanOrEqual(COUNT);
    for (const [, q, ...answers] of QUESTIONS[lang]) expect(new Set(answers).size, q).toBe(4);
  });

  it('morse: 4 tiers of keyable words, enough for every round', () => {
    const tiers = WORDS[lang];
    expect(tiers).toHaveLength(4);
    for (const w of tiers.flat()) for (const c of w) expect(CODE[c], w).toBeTruthy();
    tiers.forEach((tier, i) => expect(new Set(tier).size, `tier ${i}`).toBeGreaterThanOrEqual(PLAN.filter(t => t === i).length));
  });
});

it('quiz: same question count in every language', () => {
  expect(QUESTIONS.de.length).toBe(QUESTIONS.en.length);
});
