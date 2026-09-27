#!/usr/bin/env node
// Lädt die beiden Erkennungsmodelle einmalig nach public/models/, damit die App
// sie später vom eigenen Server (oder offline) laden kann und keine Fotos oder
// Anfragen an fremde Dienste gehen.
//
//   node scripts/fetch-models.mjs              -> lädt immer neu
//   node scripts/fetch-models.mjs --if-missing -> nur, wenn noch nicht vorhanden

import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "models");

const MODELS = [
  {
    // MobileNet v2 (ImageNet, 1000 Klassen) – erkennt Motive und Szenen.
    name: "mobilenet",
    base: "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2",
    query: "?tfjs-format=file",
  },
  {
    // COCO-SSD lite – findet Personen, Tiere, Fahrzeuge, Essen usw. im Bild.
    name: "coco-ssd",
    base: "https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2",
    query: "",
  },
];

const ifMissing = process.argv.includes("--if-missing");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} für ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchModel({ name, base, query }) {
  const dir = join(target, name);
  const modelJsonPath = join(dir, "model.json");
  if (ifMissing && (await exists(modelJsonPath))) {
    const manifest = JSON.parse(await readFile(modelJsonPath, "utf8"));
    const shards = manifest.weightsManifest.flatMap((g) => g.paths);
    const complete = await Promise.all(shards.map((p) => exists(join(dir, p))));
    if (complete.every(Boolean)) return false;
  }
  await mkdir(dir, { recursive: true });
  const json = await download(`${base}/model.json${query}`);
  const manifest = JSON.parse(json.toString("utf8"));
  let bytes = json.length;
  for (const group of manifest.weightsManifest) {
    const local = [];
    for (const path of group.paths) {
      const shard = await download(`${base}/${path}${query}`);
      // Einheitlich ".bin": Webserver (und die iPhone-App) liefern Dateien
      // ohne Endung sonst womöglich als Webseite aus.
      const fileName = /\.[a-z0-9]+$/i.test(path) ? path : `${path}.bin`;
      await writeFile(join(dir, fileName), shard);
      local.push(fileName);
      bytes += shard.length;
    }
    group.paths = local;
  }
  await writeFile(modelJsonPath, JSON.stringify(manifest));
  console.log(`✓ ${name}: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  return true;
}

let failed = false;
for (const model of MODELS) {
  try {
    await fetchModel(model);
  } catch (err) {
    failed = true;
    console.warn(`! ${model.name} konnte nicht geladen werden: ${err.message}`);
  }
}
if (failed) {
  console.warn(
    "  Die App funktioniert trotzdem – nur ohne KI-Motiverkennung. " +
      "Später erneut versuchen mit: npm run models",
  );
}
