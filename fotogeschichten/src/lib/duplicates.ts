import type { Photo } from "../types";
import { hammingDistance } from "./pixels";

export interface DuplicateGroup {
  keepId: string;
  photoIds: string[];
}

/**
 * Findet Gruppen nahezu gleicher Bilder: gleiche Motive (kaum abweichender
 * Hash) oder Serienaufnahmen (ähnlicher Hash, wenige Sekunden auseinander).
 * Pro Gruppe wird das Bild mit der besten Qualität behalten.
 */
export function findDuplicateGroups(photos: Photo[]): DuplicateGroup[] {
  const hashed = photos.filter((p) => p.hash && p.status === "fertig");
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const p of hashed) parent.set(p.id, p.id);

  for (let i = 0; i < hashed.length; i++) {
    for (let j = i + 1; j < hashed.length; j++) {
      const a = hashed[i];
      const b = hashed[j];
      const d = hammingDistance(a.hash!, b.hash!);
      const closeInTime = a.takenAt !== undefined && b.takenAt !== undefined && Math.abs(a.takenAt - b.takenAt) < 60_000;
      if (d <= 5 || (d <= 12 && closeInTime)) parent.set(find(a.id), find(b.id));
    }
  }

  const groups = new Map<string, Photo[]>();
  for (const p of hashed) {
    const root = find(p.id);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }
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
