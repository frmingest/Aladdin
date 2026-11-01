// Vets a downloaded asset pack before anything is built from it, and copies its licence text next to our models.
// Usage: node scripts/import-pack.mjs <pack folder> <licence-name>
//   e.g. node scripts/import-pack.mjs "frontend/3D art review/Kenney Fantasy tower kit" Kenney-Fantasy-Town-Kit
// Writes frontend/public/models/LICENSE-<licence-name>.txt. Stops (exit 1) if the pack has no licence text, or
// the text is not CC0 / public domain. Converts nothing: packing is scripts/pack-*.mjs.
import { readdirSync, readFileSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [packDir, name] = process.argv.slice(2);
if (!packDir || !name) {
  console.error("usage: node scripts/import-pack.mjs <pack folder> <licence-name>");
  process.exit(1);
}
if (!/^[A-Za-z0-9._-]+$/.test(name)) {
  console.error(`licence name "${name}" must be letters, digits, dot, dash or underscore only`);
  process.exit(1);
}
const fail = (msg) => {
  console.error(`STOP: ${msg}`);
  process.exit(1);
};

// Licence file at the top of the pack (License.txt, LICENSE, licence.md ...), case-insensitive.
const root = resolve(packDir);
if (!existsSync(root)) fail(`pack folder not found: ${root}`);
const file = readdirSync(root).find((f) => /^licen[cs]e(\.(txt|md))?$/i.test(f));
if (!file) fail(`no licence text in ${root}. Open the download page, save its licence, then run again.`);

const text = readFileSync(join(root, file), "utf8");
const isCC0 =
  /creative\s+commons\s+zero/i.test(text) ||
  /creativecommons\.org\/publicdomain\/zero\/1\.0/i.test(text) ||
  /\bCC0\b/.test(text);
if (!isCC0) fail(`${file} does not say CC0 (Creative Commons Zero). Not importing.`);
// A text that names CC0 but also a non-commercial / attribution-only term is not "or equivalent".
if (/non-?commercial|\bCC[ -]BY\b|\bCC[ -]NC\b/i.test(text)) fail(`${file} mentions a restrictive licence term. Read it by hand first.`);

const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const title = lines.find((l) => !/^[-=]+$/.test(l)) ?? "(untitled)";
const author = lines.find((l) => /created\/distributed by|created by/i.test(l)) ?? "(author line not found)";
const date = lines.find((l) => /creation date/i.test(l)) ?? "(date line not found)";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "frontend", "public", "models", `LICENSE-${name}.txt`);
copyFileSync(join(root, file), out);
console.log(`OK  CC0 confirmed in ${file}`);
console.log(`    ${title}`);
console.log(`    ${author}`);
console.log(`    ${date}`);
console.log(`    copied to ${out}`);
