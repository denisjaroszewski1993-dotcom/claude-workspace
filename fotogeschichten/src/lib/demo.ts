// Lädt die mitgelieferten Beispielfotos (Unsplash-Lizenz) samt erfundenen
// Aufnahmedaten und Orten, damit man die App ohne eigene Bilder ausprobieren kann.

export interface DemoPhoto {
  file: string;
  takenAt: string;
  lat: number;
  lon: number;
  place: string;
  author: string;
  source: string;
}

export interface DemoItem {
  file: File;
  takenAt: number;
  gps: { lat: number; lon: number };
  place: string;
  credit: string;
}

export async function loadDemo(): Promise<DemoItem[]> {
  const base = `${import.meta.env.BASE_URL}demo/`;
  const manifest = (await (await fetch(`${base}demo.json`)).json()) as { photos: DemoPhoto[] };
  return Promise.all(
    manifest.photos.map(async (p) => {
      const blob = await (await fetch(base + p.file)).blob();
      const takenAt = new Date(p.takenAt).getTime();
      return {
        file: new File([blob], p.file, { type: "image/jpeg", lastModified: takenAt }),
        takenAt,
        gps: { lat: p.lat, lon: p.lon },
        place: p.place,
        credit: `Foto: ${p.author} (Unsplash)`,
      };
    }),
  );
}
