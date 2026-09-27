import type { Photo } from "../types";

export interface DuplicateGroup {
  keepId: string;
  photoIds: string[];
}

/**
 * Findet Gruppen nahezu gleicher Bilder: gleiche Motive (kaum abweichender
 * Hash) oder Serienaufnahmen (ähnlicher Hash, wenige Sekunden auseinander).
 * Pro Gruppe wird das Bild mit der besten Qualität behalten.
 */
function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

export function findDuplicateGroups(photos: Photo[]): DuplicateGroup[] {
  const hashed = photos.filter((p) => p.hash && p.status === "fertig").sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));
  const parent = hashed.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[a] = b;
  };
  // Hash als zwei 32-Bit-Zahlen: Abstand per XOR und Bitzählung statt Textvergleich.
  const hi = new Uint32Array(hashed.length);
  const lo = new Uint32Array(hashed.length);
  hashed.forEach((p, i) => {
    hi[i] = parseInt(p.hash!.slice(0, 8), 16);
    lo[i] = parseInt(p.hash!.slice(8, 16), 16);
  });
  const distance = (i: number, j: number) => popcount(hi[i] ^ hi[j]) + popcount(lo[i] ^ lo[j]);

  // 1. Nahezu gleiche Bilder: Hash in 8 Bänder à 8 Bit teilen. Bei höchstens
  //    5 abweichenden Bits stimmen mindestens 3 Bänder überein – verglichen
  //    wird also nur, was in einem Band gleich ist, nicht jedes mit jedem.
  const buckets: number[][] = Array.from({ length: 8 * 256 }, () => []);
  for (let i = 0; i < hashed.length; i++) {
    for (let band = 0; band < 8; band++) {
      const word = band < 4 ? hi[i] : lo[i];
      const byte = (word >>> (24 - 8 * (band % 4))) & 0xff;
      buckets[band * 256 + byte].push(i);
    }
  }
  for (const list of buckets) {
    // Riesige Fächer (z. B. viele fast schwarze Bilder) nur mit zeitlichen Nachbarn vergleichen.
    const window = list.length > 1500 ? 40 : list.length;
    for (let a = 0; a < list.length; a++) {
      const end = Math.min(list.length, a + 1 + window);
      for (let b = a + 1; b < end; b++) {
        if (distance(list[a], list[b]) <= 5) union(list[a], list[b]);
      }
    }
  }

  // 2. Serienaufnahmen: ähnlicher Hash und höchstens eine Minute auseinander.
  for (let i = 0; i < hashed.length; i++) {
    const t = hashed[i].takenAt;
    if (t === undefined) continue;
    for (let j = i + 1; j < hashed.length; j++) {
      const u = hashed[j].takenAt;
      if (u === undefined || u - t >= 60_000) break;
      if (distance(i, j) <= 12) union(i, j);
    }
  }

  const groups = new Map<number, Photo[]>();
  hashed.forEach((p, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(p);
    else groups.set(root, [p]);
  });
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const best = [...g].sort((a, b) => (b.quality?.score ?? 0) - (a.quality?.score ?? 0) || b.size - a.size)[0];
      return { keepId: best.id, photoIds: g.map((p) => p.id) };
    });
}

/** Liefert für jedes Foto, das eine schwächere Kopie ist, die ID des behaltenen Bildes. */
export function duplicateMap(photos: Photo[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of findDuplicateGroups(photos)) {
    for (const id of group.photoIds) if (id !== group.keepId) map.set(id, group.keepId);
  }
  return map;
}

/** Gruppen aus den gespeicherten Markierungen (duplicateOf) – ohne erneuten Vergleich, O(n). */
export function groupsFromMarks(photos: Photo[]): DuplicateGroup[] {
  const groups = new Map<string, string[]>();
  for (const p of photos) {
    if (!p.duplicateOf) continue;
    const ids = groups.get(p.duplicateOf);
    if (ids) ids.push(p.id);
    else groups.set(p.duplicateOf, [p.duplicateOf, p.id]);
  }
  return [...groups.entries()].map(([keepId, photoIds]) => ({ keepId, photoIds }));
}
