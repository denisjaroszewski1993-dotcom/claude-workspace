#!/usr/bin/env node
// Erzeugt aus dem fertigen Build (dist/) eine Seite für claude.ai-Artifacts:
// dist/artifact.html enthält nur den Seiteninhalt (Titel, Styles, Skripte) –
// das Grundgerüst <html>/<head>/<body> ergänzt claude.ai beim Veröffentlichen.
// Alle übrigen Dateien aus dist/ (JS, CSS, Modelle, Beispielfotos) werden
// daneben veröffentlicht; die App lädt sie über relative Pfade.

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const html = await readFile(join(dist, "index.html"), "utf8");

const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"));
const keep = [...head.matchAll(/<(?:link|script)\b[^>]*>(?:<\/script>)?/g)]
  .map((m) => m[0])
  .filter((tag) => !/rel="icon"/.test(tag));

const page = [
  "<title>Fotogeschichten</title>",
  ...keep,
  '<div id="root"></div>',
  "",
].join("\n");
await writeFile(join(dist, "artifact.html"), page);

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = (await walk(dist))
  .map((f) => relative(dist, f))
  .filter((f) => f !== "index.html" && f !== "artifact.html");
await writeFile(join(dist, "artifact-files.json"), JSON.stringify(files, null, 1));

const size = (await Promise.all(files.map((f) => stat(join(dist, f))))).reduce((s, st) => s + st.size, 0);
console.log(`artifact.html + ${files.length} Dateien (${(size / 1024 / 1024).toFixed(1)} MB)`);
