/**
 * Real-browser integration smoke for CI. No game-state hooks or mocked renderer.
 * Run after: npx playwright install --with-deps chromium
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts/rebirth-smoke');
const origin = 'http://127.0.0.1:4173';
const logs = { startedAt: new Date().toISOString(), steps: [], console: [], pageErrors: [], networkErrors: [], screenshots: [], server: [] };
await mkdir(output, { recursive: true });
let browser, currentPage, server, failure;

function note(message) {
  logs.steps.push({ at: new Date().toISOString(), message });
  console.log(message);
}
function observe(page, name) {
  page.on('console', message => logs.console.push({ page: name, type: message.type(), text: message.text(), location: message.location() }));
  page.on('pageerror', error => logs.pageErrors.push({ page: name, message: error.message, stack: error.stack }));
  page.on('requestfailed', request => logs.networkErrors.push({ page: name, url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }));
  page.on('response', response => {
    if (response.status() >= 400) logs.networkErrors.push({ page: name, url: response.url(), status: response.status() });
  });
}
async function screenshot(page, name, fullPage = true) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage, animations: 'disabled', timeout: 30000 });
  logs.screenshots.push(filename);
}
async function noOverflow(page, label) {
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    offenders: [...document.querySelectorAll('body *')].filter(element => {
      const box = element.getBoundingClientRect();
      return box.width && (box.right > window.innerWidth + 2 || box.left < -2) && getComputedStyle(element).position !== 'fixed';
    }).slice(0, 12).map(element => `${element.tagName.toLowerCase()}#${element.id}.${String(element.className).slice(0, 80)}`),
  }));
  assert.ok(layout.document <= layout.viewport + 2 && layout.body <= layout.viewport + 2, `${label}: horizontal overflow ${JSON.stringify(layout)}`);
}
async function home(page) {
  await expect(page.locator('#home-view')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#start-button')).toBeEnabled({ timeout: 30000 });
}
async function chooseMode(page, mode) {
  await home(page);
  await page.locator(`[data-mode="${mode}"]`).click();
  await expect(page.locator(`[data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#start-button').click();
  await expect(page.locator('#select-view')).toBeVisible();
  await page.locator('#character-search').fill('');
  await page.locator('#difficulty').focus();
  await page.locator('#difficulty').press('Home');
  await expect(page.locator('#difficulty-value')).toHaveText('1%');
}
async function battleReady(page, label) {
  await expect(page.locator('#play-view')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('#pause-button')).toBeEnabled({ timeout: 120000 });
  await expect(page.locator('#skill-bar button')).toHaveCount(7);
  await expect(page.locator('#hp-text')).toContainText('/');
  await expect.poll(() => page.locator('#battle-time').textContent(), { timeout: 30000, message: `${label}: simulation clock starts` }).not.toBe('00:00');
  const graphics = await page.locator('#world-canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    return gl ? { lost: gl.isContextLost(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, version: gl.getParameter(gl.VERSION) } : null;
  });
  assert.ok(graphics && !graphics.lost && graphics.width > 0 && graphics.height > 0, `${label}: missing live WebGL rendering context`);
  note(`${label}: live ${graphics.version}, ${graphics.width} × ${graphics.height}`);
  await noOverflow(page, label);
}
async function quitBattle(page) {
  await page.locator('#pause-button').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#quit-button').click();
  await home(page);
}
async function quietSettings(page, nickname) {
  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.locator('#nickname-input').fill(nickname);
  await page.locator('#quality-select').selectOption('low');
  await page.locator('#volume-input').focus();
  await page.locator('#volume-input').press('Home');
  await page.locator('#motion-input').check();
  await page.locator('#settings-close').click();
  await expect(page.locator('#settings-dialog')).not.toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('arkeia.rebirth.v1')));
  assert.equal(saved.nickname, nickname);
  assert.equal(saved.settings.quality, 'low');
  assert.equal(saved.settings.volume, 0);
  assert.equal(saved.settings.reducedMotion, true);
}
async function serverReady() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview server exited with ${server.exitCode}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Waiting for the server's listen callback. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not become available');
}

try {
  server = spawn(process.execPath, ['scripts/serve.mjs', '--port', '4173', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => logs.server.push(chunk.toString()));
  server.stderr.on('data', chunk => logs.server.push(chunk.toString()));
  server.on('error', error => logs.server.push(error.message));
  await serverReady();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = currentPage = await desktop.newPage();
  page.setDefaultTimeout(15000);
  observe(page, 'desktop');
  await page.goto(`${origin}/rebirth.html`, { waitUntil: 'networkidle', timeout: 45000 });
  await home(page);
  await noOverflow(page, 'desktop home');
  await screenshot(page, '01-desktop-home');
  note('Desktop home boots and fits 1440 × 900');

  await quietSettings(page, '検証の旅人');
  await page.locator('#records-button').click();
  await expect(page.locator('#records-dialog')).toBeVisible();
  await expect(page.locator('#records-content')).toContainText('灯の鍛錬');
  await page.locator('[data-upgrade="vitality"]').click();
  await expect(page.locator('#toast')).toContainText('灯晶が足りません');
  await expect(page.locator('[data-upgrade="vitality"]')).toContainText('Lv.0');
  await page.locator('#records-close').click();
  note('Settings persist; empty records and insufficient-funds feedback work');

  await chooseMode(page, 'duel');
  await page.locator('#character-search').fill('ミナセ');
  await expect(page.locator('#character-grid [data-fighter]')).toHaveCount(1);
  await page.locator('[data-fighter="minase"]').click();
  await page.locator('#favorite-button').click();
  await expect(page.locator('#favorite-button')).toContainText('登録済み');
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('arkeia.rebirth.v1')).favorites.includes('minase')));
  await page.locator('#character-search').fill('見つからない戦士');
  await expect(page.locator('#character-grid')).toContainText('該当する戦士はいません');
  await page.locator('#character-search').fill('');
  await expect(page.locator('#character-grid [data-fighter]')).toHaveCount(14);
  await page.locator('[data-fighter="rowen"]').click();
  await noOverflow(page, 'desktop selection');
  await screenshot(page, '02-desktop-selection');
  note('Roster search, empty search, fighter selection, and favorites work');

  await page.locator('[data-stage="moon"]').click();
  await page.locator('#launch-button').click();
  await battleReady(page, 'Moon duel');
  await screenshot(page, '03-desktop-moon-battle', false);
  await page.locator('#world-canvas').focus();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ');
  try {
    await expect.poll(() => page.locator('#damage-numbers .damage-number:not(.received)').count(), { timeout: 20000, message: 'Keyboard melee reaches an opponent and creates damage feedback' }).toBeGreaterThan(0);
  } finally { await page.keyboard.up('KeyJ'); }
  await page.keyboard.down('KeyK');
  try {
    await expect.poll(() => page.locator('[data-cooldown="skill"]').textContent(), { timeout: 5000 }).toMatch(/s$/);
  } finally { await page.keyboard.up('KeyK'); }
  await page.keyboard.press('Space');
  await expect.poll(() => page.locator('[data-cooldown="dash"]').textContent(), { timeout: 5000 }).toMatch(/s$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  // The HUD is throttled independently; allow its final pre-pause sample to flush.
  await page.waitForTimeout(200);
  const pausedTime = await page.locator('#battle-time').textContent();
  const pausedHp = await page.locator('#hp-text').textContent();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('#battle-time').textContent(), pausedTime, 'Pause freezes the combat clock');
  assert.equal(await page.locator('#hp-text').textContent(), pausedHp, 'Pause freezes damage');
  await page.locator('#resume-button').click();
  await expect(page.locator('#pause-dialog')).not.toBeVisible();
  await expect.poll(() => page.locator('#battle-time').textContent(), { timeout: 15000, message: 'Resume restarts the clock' }).not.toBe(pausedTime);
  await quitBattle(page);
  note('Keyboard movement, successful attack, skill, dodge, pause, resume, and quit work');

  await page.reload({ waitUntil: 'networkidle' });
  await home(page);
  await expect(page.locator('#profile-name')).toHaveText('検証の旅人');
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('arkeia.rebirth.v1')).favorites.includes('minase')));
  for (const [stage, fighter, number] of [['river', 'minase', '04'], ['frost', 'garou', '05'], ['moon', 'harlan', '05b']]) {
    await chooseMode(page, 'duel');
    await page.locator(`[data-fighter="${fighter}"]`).click();
    await page.locator(`[data-stage="${stage}"]`).click();
    await expect(page.locator(`[data-stage="${stage}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#launch-button').click();
    await battleReady(page, `${stage} duel`);
    if (fighter === 'harlan') {
      await page.locator('#world-canvas').focus();
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(500);
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyJ');
      await page.waitForTimeout(400);
      await screenshot(page, `${number}-desktop-${stage}-${fighter}-battle`, false);
      await page.keyboard.up('KeyJ');
    } else await screenshot(page, `${number}-desktop-${stage}-battle`, false);
    await quitBattle(page);
  }
  note('Save reload succeeds; river/frost stages and the Harlan runtime rig render in combat');

  await chooseMode(page, 'story');
  await page.locator('[data-fighter="rowen"]').click();
  await expect(page.locator('[data-stage="moon"]')).toBeDisabled();
  await page.locator('#launch-button').click();
  await expect(page.locator('#dialogue-view')).toBeVisible();
  await expect(page.locator('#dialogue-chapter')).toContainText('第一章');
  const firstLine = await page.locator('#dialogue-text').textContent();
  await page.locator('#dialogue-next').click();
  await expect(page.locator('#dialogue-text')).not.toHaveText(firstLine);
  await screenshot(page, '06-desktop-story-dialogue', false);
  await page.locator('#dialogue-skip').click();
  await battleReady(page, 'Story battle');
  await expect(page.locator('#enemy-count')).toHaveText('3');
  await screenshot(page, '07-desktop-story-battle', false);
  await quitBattle(page);

  await chooseMode(page, 'endless');
  await page.locator('#launch-button').click();
  await battleReady(page, 'Endless keep');
  await expect(page.locator('#objective')).toContainText('第1階');
  await expect(page.locator('#enemy-count')).toHaveText('4');
  await screenshot(page, '08-desktop-endless-keep', false);
  await quitBattle(page);
  note('Story dialogue advances/skips into combat; endless keep starts on floor 1');
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = currentPage = await mobile.newPage();
  phone.setDefaultTimeout(15000);
  observe(phone, 'mobile');
  await phone.goto(`${origin}/rebirth.html`, { waitUntil: 'networkidle', timeout: 45000 });
  logs.mobileCapabilities = await phone.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    coarse: matchMedia('(pointer: coarse)').matches,
    anyCoarse: matchMedia('(any-pointer: coarse)').matches,
    touchClass: document.documentElement.classList.contains('touch-input'),
    viewport: { width: innerWidth, height: innerHeight },
  }));
  await home(phone);
  await noOverflow(phone, 'mobile home');
  await screenshot(phone, '09-mobile-home');
  await quietSettings(phone, '小さな旅人');
  await chooseMode(phone, 'duel');
  await phone.locator('#character-search').fill('ロウエン');
  await expect(phone.locator('#character-grid [data-fighter]')).toHaveCount(1);
  await phone.locator('[data-fighter="rowen"]').tap();
  await noOverflow(phone, 'mobile selection');
  await screenshot(phone, '10-mobile-selection');
  await phone.locator('[data-stage="moon"]').tap();
  await phone.locator('#launch-button').tap();
  await battleReady(phone, 'Mobile battle');
  logs.mobileControls = await phone.evaluate(() => ({
    view: document.body.dataset.view,
    touchClass: document.documentElement.classList.contains('touch-input'),
    display: getComputedStyle(document.getElementById('touch-controls')).display,
    bounds: document.getElementById('touch-controls').getBoundingClientRect().toJSON(),
  }));
  await expect(phone.locator('#touch-controls')).toBeVisible();
  await expect(phone.locator('#joystick')).toBeVisible();
  const beforeEnergy = await phone.locator('#energy-fill').evaluate(node => parseFloat(node.style.width));
  await phone.locator('[data-action="skill"]').tap();
  await expect.poll(() => phone.locator('#energy-fill').evaluate(node => parseFloat(node.style.width)), { timeout: 5000 }).toBeLessThan(beforeEnergy);
  const joystick = await phone.locator('#joystick').boundingBox();
  assert.ok(joystick, 'Mobile joystick has a touchable box');
  const touch = await mobile.newCDPSession(phone);
  const center = { x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2 };
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x + 28, y: center.y - 20, id: 1 }] });
  await expect(phone.locator('#joystick-knob')).not.toHaveCSS('transform', 'none');
  await phone.waitForTimeout(400);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await screenshot(phone, '11-mobile-battle', false);
  await noOverflow(phone, 'mobile battle after touch');
  await quitBattle(phone);
  note('Mobile 390 × 844 home/selection/battle fit; touch skill and joystick respond');
  await mobile.close();

  const consoleErrors = logs.console.filter(entry => entry.type === 'error');
  // A media track deliberately aborted by switching scenes is expected; keep it
  // in the report, but fail all HTTP failures and every other failed request.
  const networkFailures = logs.networkErrors.filter(entry => entry.status || !(entry.resourceType === 'media' && entry.error === 'net::ERR_ABORTED'));
  assert.equal(logs.pageErrors.length, 0, `Runtime exceptions: ${JSON.stringify(logs.pageErrors)}`);
  assert.equal(consoleErrors.length, 0, `Console errors: ${JSON.stringify(consoleErrors)}`);
  assert.equal(networkFailures.length, 0, `Network failures: ${JSON.stringify(networkFailures)}`);
  logs.status = 'passed';
  note('Browser smoke passed with no runtime, console, or unexpected network errors');
} catch (error) {
  failure = error;
  logs.status = 'failed';
  logs.failure = { message: error.message, stack: error.stack };
  if (currentPage && !currentPage.isClosed()) {
    try { await screenshot(currentPage, 'failure', false); } catch (captureError) { logs.failure.screenshot = captureError.message; }
  }
} finally {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  logs.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(logs, null, 2));
}
if (failure) {
  console.error(failure.stack || failure.message);
  process.exitCode = 1;
}
