import { useEffect, useState } from "react";
import type { Photo } from "../types";
import { photoDisplayUrl } from "../lib/photoData";

/** Große Fassung eines Fotos zum Anzeigen – bis sie da ist, das Vorschaubild. */
export function usePhotoUrl(photo: Photo | undefined, maxSize = 2048): string | undefined {
  const [url, setUrl] = useState<string | undefined>(photo?.thumbUrl);
  const id = photo?.id;
  useEffect(() => {
    if (!photo) return;
    let alive = true;
    let release = () => undefined as void;
    setUrl(photo.thumbUrl);
    photoDisplayUrl(photo, maxSize)
      .then((r) => {
        if (alive) {
          setUrl(r.url);
          release = r.release;
        } else r.release();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      release();
    };
    // Nur bei einem anderen Foto neu laden, nicht bei jeder Zustandsänderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, maxSize]);
  return url;
}
