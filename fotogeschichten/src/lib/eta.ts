export interface EtaStart {
  at: number;
  done: number;
}

/**
 * Restzeit der Analyse aus dem bisherigen Tempo. Gemessen wird ab dem ersten
 * fertigen Foto – das einmalige Laden der KI-Modelle soll die Schätzung nicht
 * verfälschen. Liefert nichts, solange zu wenig Erfahrung vorliegt.
 */
export function remaining(start: EtaStart, now: number, done: number, total: number): string | undefined {
  const finished = done - start.done;
  const elapsed = now - start.at;
  if (finished < 3 || elapsed < 4000 || done >= total) return undefined;
  const minutes = ((elapsed / finished) * (total - done)) / 60_000;
  if (minutes < 1) return "gleich fertig";
  if (minutes < 90) return `noch ca. ${Math.round(minutes)} Min.`;
  return `noch ca. ${(minutes / 60).toFixed(1).replace(".", ",")} Std.`;
}
