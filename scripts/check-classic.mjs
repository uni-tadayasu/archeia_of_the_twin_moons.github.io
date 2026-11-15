/** Static contract checks for the original game and its actual local module graph. */
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = new URL('https://classic.invalid/');
const checked = new Set(), assets = new Set(), remote = new Set();
const singletonUrls = new Map();
const html = await readFile(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<script\b[^>]*type="module"[^>]*src="(?:\.\/)?main\.js(?:\?[^"\s]*)?"/, 'The public entry must launch the original main.js engine');
assert.doesNotMatch(html, /src="(?:\.\/)?rebirth\/app\.mjs/, 'Rebirth must remain a separate optional entry');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate original game DOM ids');
for (const id of ['scr-press', 'press-start', 'scr-title', 'scr-select', 'select-grid', 'select-search', 'select-back', 'game-container', 'hud', 'hud-left', 'hud-right', 'flux', 'countdown', 'pause', 'btn-pause', 'btn-resume', 'btn-quit', 'joy', 'knob', 'tbtns', 'btn-story2', 'btn-ranked', 'btn-adventure-mode', 'btn-castle', 'btn-forge', 'btn-shop', 'btn-options', 'btn-mailbox']) {
  assert.ok(ids.includes(id), `Missing classic UI target #${id}`);
}
for (const mode of ['story', 'story2', 'infinite', 'cpu', 'duo', 'online-vs', 'online-coop', 'event']) assert.ok(html.includes(`data-go="${mode}"`), `Missing original mode ${mode}`);
const mapText = html.match(/<script\b[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/)?.[1];
assert.ok(mapText, 'The classic import map is required');
const imports = JSON.parse(mapText).imports;
const importMap = Object.entries(imports).map(([key, value]) => [key.startsWith('.') || key.startsWith('/') ? new URL(key, base).href : key, new URL(value, base).href]);
function resolve(specifier, importer = base.href) {
  const absolute = /^(?:\.{1,2}\/|\/|[a-z][\w+.-]*:)/i.test(specifier) ? new URL(specifier, importer).href : specifier;
  const match = importMap.filter(([key]) => key === absolute || (key.endsWith('/') && absolute.startsWith(key))).sort((a, b) => b[0].length - a[0].length)[0];
  const mapped = match ? match[1] + absolute.slice(match[0].length) : absolute;
  assert.match(mapped, /^https?:\/\//, `Unmapped module specifier ${specifier} in ${importer}`);
  return new URL(mapped);
}
async function checkAsset(url) {
  if (url.origin !== base.origin) { remote.add(url.href); return null; }
  // Browsers resolve query strings in the import map, but the static server reads
  // only the pathname. Keep this distinction so versioned imports are checked.
  const relative = decodeURIComponent(url.pathname).replace(/^\//, '');
  const file = path.resolve(root, relative);
  assert.ok(file.startsWith(root + path.sep), `Asset outside project: ${url}`);
  assert.ok((await stat(file).catch(() => null))?.isFile(), `Missing local asset ${relative} (referenced as ${url.pathname + url.search})`);
  assets.add(relative);
  return file;
}
function syntax(source, label, file) {
  const result = spawnSync(process.execPath, file ? ['--check', file] : ['--input-type=module', '--check'], { input: file ? undefined : source, encoding: 'utf8' });
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
}
async function moduleSource(source, url) {
  // Include static imports, re-exports, literal dynamic imports, and side-effect
  // imports. Dynamic generated URLs are covered by the browser smoke instead.
  const patterns = [
    /(?:^|[;\n])\s*(?:import|export)\s*(?:\*\s*(?:as\s+[\w$]+)?|(?:[\w$]+\s*,?\s*)?(?:\{[^}]*\})?)\s*from\s*['"]([^'"\n]+)['"]/g,
    /(?:^|[;\n])\s*import\s*['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]/g,
  ];
  const specs = new Set(patterns.flatMap(pattern => [...source.matchAll(pattern)].map(match => match[1])));
  for (const specifier of specs) await moduleFile(resolve(specifier, url.href));
}
async function moduleFile(url, recordIdentity = true) {
  if (recordIdentity && /^\/(?:game|model-runtime)\.js$/.test(url.pathname)) {
    const identities = singletonUrls.get(url.pathname) || new Set();
    identities.add(url.href);
    singletonUrls.set(url.pathname, identities);
  }
  const file = await checkAsset(url);
  if (!file || checked.has(file) || !/\.m?js$/i.test(file)) return;
  checked.add(file);
  const source = await readFile(file, 'utf8');
  syntax(source, path.relative(root, file), file);
  await moduleSource(source, url);
}
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const value = match[1].replaceAll('&amp;', '&');
  if (/^(?:#|data:|blob:|mailto:|javascript:)/.test(value)) continue;
  const url = new URL(value, base);
  if (url.origin === base.origin && url.pathname.endsWith('/')) continue;
  await checkAsset(url);
}
for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  const src = attributes.match(/\bsrc="([^"]+)"/)?.[1];
  if (src) await moduleFile(new URL(src, base));
  else if (source.trim() && !/type="(?:importmap|application\/ld\+json|application\/json)"/.test(attributes)) {
    syntax(source, 'inline classic bootstrap');
    await moduleSource(source, base);
  }
}
// These runtime files and original hero assets are core parts of the offline
// gameplay contract even when a script currently loads them lazily.
for (const file of ['main.js', 'game.js', 'data.js', 'model-runtime.js', 'field.js', 'net.js', 'api.js']) await moduleFile(new URL(file, base), false);
for (const file of ['assets/vendor/draco/draco_decoder.wasm', 'assets/vendor/draco/draco_wasm_wrapper.js', 'assets/vendor/meshopt_decoder.module.js']) await checkAsset(new URL(file, base));
for (const name of ['hero-swordsman', 'brute-axe', 'mage-weaver', 'seraph-boss']) {
  const url = new URL(`assets/models/${name}.glb`, base);
  const file = await checkAsset(url), bytes = await readFile(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `Invalid GLB ${name}`);
  assert.equal(bytes.readUInt32LE(4), 2, `Unsupported GLB ${name}`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `Truncated GLB ${name}`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  for (const entry of [...(gltf.buffers || []), ...(gltf.images || [])]) if (entry.uri && !entry.uri.startsWith('data:')) await checkAsset(new URL(entry.uri, url));
}
for (const [module, identities] of singletonUrls) assert.equal(identities.size, 1, `Multiple browser module identities for ${module}: ${[...identities].join(', ')}`);
console.log(`Classic checks passed: ${checked.size} local scripts, ${assets.size} assets, original modes/DOM, versioned imports and GLB dependencies; ${remote.size} external references identified.`);
