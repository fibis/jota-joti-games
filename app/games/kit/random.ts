// Small randomness helpers shared by the games.

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** One random element of a non-empty list. */
export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** Random number in [min, max). */
export const between = (min: number, max: number) => min + Math.random() * (max - min);
