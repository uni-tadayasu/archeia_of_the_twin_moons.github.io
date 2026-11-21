/** The archived game stays playable without sharing Sengoku VS search identity. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://uni-tadayasu.github.io/archeia_of_the_twin_moons.github.io/';
const read = file => readFileSync(new URL(file, new URL('../', import.meta.url)), 'utf8');
const pages = execFileSync('git', ['ls-files', '-z', '--', '*.html'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
assert(pages.length >= 9, 'all published pages and HTML helpers are checked');
for (const file of pages) {
  const html = read(file);
  // This fragment is also directly reachable. A leading meta element belongs
  // to the implicit head on direct navigation and does not change its UI nodes.
  const head = file === 'rebirth/shell.html'
    ? html.match(/^<meta name="robots" content="noindex, follow">/)?.[0]
    : html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0];
  assert(head, `${file}: a crawlable head or leading fragment directive exists`);
  const directives = [...head.matchAll(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*\bcontent=["']([^"']+)["'][^>]*>/gi)];
  assert.equal(directives.length, 1, `${file}: one robots directive`);
  assert.deepEqual(directives[0][1].split(',').map(value => value.trim()).sort(), ['follow', 'noindex'], `${file}: excluded from search`);
  assert(!/https?:\/\/(?:www\.)?kasai-solutions-inc\.com(?:[/?#"\s<]|$)/i.test(head), `${file}: no Sengoku VS metadata`);
  for (const match of head.matchAll(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/gi)) {
    assert(match[1].startsWith(site), `${file}: canonical stays on the legacy Pages site`);
  }
  for (const match of head.matchAll(/<meta\b(?=[^>]*(?:property|name)=["'](?:og:url|twitter:url)["'])[^>]*\bcontent=["']([^"']+)["']/gi)) {
    assert(match[1].startsWith(site), `${file}: social URL stays on the legacy Pages site`);
  }
  for (const match of head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) JSON.parse(match[1]);
}
const robots = read('robots.txt');
assert(/^Allow: \/\s*$/m.test(robots), 'crawlers can read noindex');
assert(!/^Disallow: \/\s*$/m.test(robots), 'the whole site is not blocked from crawling');
assert(!/^Sitemap:/mi.test(robots), 'the archived site does not advertise a sitemap');
const sitemap = read('sitemap.xml');
assert(/<urlset\b[^>]*>\s*<\/urlset>/.test(sitemap), 'the sitemap contains no indexable URLs');
assert(!/kasai-solutions-inc\.com/.test(sitemap), 'the sitemap does not reference Sengoku VS');
console.log(JSON.stringify({ ok: true, pages: pages.length, indexable: 0, sitemapUrls: 0 }));
