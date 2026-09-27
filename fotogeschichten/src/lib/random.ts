/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32). */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    chance(p: number): boolean {
      return next() < p;
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
