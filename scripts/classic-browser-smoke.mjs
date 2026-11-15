/** Original-engine UI integration in CI Chromium; combat and assets are real.
 * All external API requests and WebSockets are refused before page navigation.
 * This suite never signs in, buys, submits results, or modifies a live account.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts/classic-smoke');
const origin = 'http://127.0.0.1:4173';
const logs = { startedAt: new Date().toISOString(), steps: [], console: [], pageErrors: [], networkErrors: [], blockedNetwork: [], screenshots: [], server: [] };
const staticHosts = new Set(['esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'storage.googleapis.com']);
await mkdir(output, { recursive: true });
let browser, server, currentPage, failure;
const note = message => { logs.steps.push({ at: new Date().toISOString(), message }); console.log(message); };

async function offlineContext(options, name) {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    // Only static CDN reads may leave CI. This also refuses future API hosts and
    // remote form submissions, regardless of which original script initiates it.
    if (['GET', 'HEAD'].includes(request.method()) && staticHosts.has(url.hostname)) return route.continue();
    logs.blockedNetwork.push({ page: name, url: request.url(), method: request.method(), type: request.resourceType() });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': request.headers()['access-control-request-headers'] || 'content-type, authorization',
    }, body: JSON.stringify({ ok: false, error: 'ci-offline', reason: 'ci-offline', status: 503 }) });
  });
  await context.routeWebSocket('**', socket => {
    logs.blockedNetwork.push({ page: name, url: socket.url(), type: 'websocket' });
    socket.close({ code: 1000, reason: 'CI offline gameplay verification' });
  });
  return context;
}
function observe(page, name) {
  page.on('console', message => logs.console.push({ page: name, type: message.type(), text: message.text(), location: message.location() }));
  page.on('pageerror', error => logs.pageErrors.push({ page: name, message: error.message, stack: error.stack }));
  page.on('requestfailed', request => logs.networkErrors.push({ page: name, url: request.url(), error: request.failure()?.errorText, resourceType: request.resourceType() }));
  page.on('response', response => { if (response.status() >= 400) logs.networkErrors.push({ page: name, url: response.url(), status: response.status() }); });
}
async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage, animations: 'disabled', timeout: 30000 });
  logs.screenshots.push(`${name}.png`);
}
async function fits(page, label) {
  const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(layout.document <= layout.viewport + 2 && layout.body <= layout.viewport + 2, `${label}: horizontal overflow ${JSON.stringify(layout)}`);
}
async function boot(page, label) {
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page.locator('#press-start')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('#press-start')).toBeEnabled({ timeout: 90000 });
  await shot(page, `${label}-start`);
  await page.locator('#press-start').click();
  await expect(page.locator('.rf51-overlay')).toBeVisible();
  await expect(page.locator('#rf51-title')).toHaveText('冒険の開始方法');
  await page.locator('.rf51-overlay .rf51-primary').click();
  await expect(page.locator('#scr-title')).toHaveClass(/\bon\b/, { timeout: 30000 });
  const modes = page.locator('.portal-modes > button');
  await expect(modes).toHaveCount(10);
  for (const selector of ['[data-go="story"]', '[data-go="story2"]', '[data-go="infinite"]', '#btn-ranked', '[data-go="cpu"]', '[data-go="duo"]', '[data-go="online-vs"]', '[data-go="online-coop"]', '[data-go="event"]', '#btn-adventure-mode']) {
    await expect(page.locator(`.portal-modes ${selector}`)).toBeVisible();
    await expect(page.locator(`.portal-modes ${selector}`)).toBeEnabled();
  }
  for (const id of ['btn-castle', 'btn-forge', 'btn-shop', 'btn-mailbox', 'btn-options']) await expect(page.locator(`#${id}`)).toBeVisible();
  await fits(page, `${label} original menu`);
  await shot(page, `${label}-menu`);
  note(`${label}: original start confirmation, all 10 modes, and service entries are available`);
}
async function configureLocalDisplay(page) {
  await page.locator('#btn-options').click();
  await expect(page.locator('#scr-options')).toHaveClass(/\bon\b/);
  await page.locator('#rf45-quality').selectOption('low');
  // These are local presentation preferences. Do not touch operator difficulty,
  // synchronization, entitlements, balances, or any server-managed settings.
  await page.locator('#opt-mute').click();
  for (const id of ['opt-bgm-volume', 'opt-sfx-volume', 'opt-voice-volume', 'opt-ui-volume']) {
    const slider = page.locator(`#${id}`);
    if (await slider.count()) { await slider.focus(); await slider.press('Home'); }
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('rf45-quality-v1')), 'low');
  await page.locator('#scr-options [data-to="title"]').click();
  await expect(page.locator('#scr-title')).toHaveClass(/\bon\b/);
}
async function selectDuel(page, label) {
  await page.locator('.portal-modes [data-go="cpu"]').click();
  await expect(page.locator('#scr-select')).toHaveClass(/\bon\b/);
  await expect(page.locator('#select-label')).toContainText('あなたが握る剣');
  await page.locator('#select-search').fill('ロウエン');
  await expect(page.locator('#select-grid [data-special-key="rowen"]')).toBeVisible();
  await expect(page.locator('#select-grid [data-special-key="garou"]')).not.toBeVisible();
  await fits(page, `${label} fighter selection`);
  await shot(page, `${label}-selection`);
  await page.locator('#select-grid [data-special-key="rowen"]').click();
  await expect(page.locator('#select-label')).toContainText('向かい合うのは');
  await page.locator('#select-grid [data-special-key="garou"]').click();
  await expect(page.locator('#select-label')).toHaveText('戦いの舞台を選ぶ');
  assert.ok(await page.locator('.stage-tile').count() > 3, 'Original stage catalogue is available');
  await page.locator('.stage-tile[data-search~="moon"]').click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('#hud-left .plate')).toHaveCount(1);
  await expect(page.locator('#hud-right .plate')).toHaveCount(1);
  await expect(page.locator('#hud-left')).toContainText('ロウエン');
  await expect(page.locator('#hud-right')).toContainText('ガロウ');
  // Countdown is observed, rather than waiting a fixed amount of real time: CI
  // software rendering and the classic delta-time cap can lengthen it.
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 60000 });
  await expect(page.locator('#rf-battle-v9-error')).toHaveCount(0);
  const graphics = await page.locator('#game-container canvas').first().evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    return gl ? { lost: gl.isContextLost(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, version: gl.getParameter(gl.VERSION) } : null;
  });
  assert.ok(graphics && !graphics.lost && graphics.width > 0 && graphics.height > 0, `${label}: live original WebGL context`);
  logs.steps.push({ message: `${label}: real original models loaded, countdown completed, live WebGL`, graphics });
  await shot(page, `${label}-battle`, false);
}
const gauge = (page, selector) => page.locator(selector).evaluate(element => parseFloat(element.style.width));
async function keyboardCombat(page) {
  const originalEnergy = await gauge(page, '#flux u');
  // Global game input ignores editable targets; focus the actual play surface.
  await page.locator('#game-container canvas').first().click();
  await page.keyboard.down('KeyK');
  try { await expect.poll(() => gauge(page, '#flux u'), { timeout: 15000, message: 'Original keyboard skill spends real energy' }).toBeLessThan(originalEnergy - 1); }
  finally { await page.keyboard.up('KeyK'); }
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
  await page.waitForTimeout(650);
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
  const enemyHealth = await gauge(page, '#hud-right .plate u');
  await page.keyboard.down('KeyJ');
  try { await expect.poll(() => gauge(page, '#hud-right .plate u'), { timeout: 30000, message: 'Original melee/skill combat damages the actual CPU fighter' }).toBeLessThan(enemyHealth); }
  finally { await page.keyboard.up('KeyJ'); }
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeVisible();
  await page.waitForTimeout(250);
  const frozen = await page.locator('#hud .plate u, #flux u, #over u').evaluateAll(elements => elements.map(element => element.style.width));
  await page.waitForTimeout(1250);
  assert.deepEqual(await page.locator('#hud .plate u, #flux u, #over u').evaluateAll(elements => elements.map(element => element.style.width)), frozen, 'Pause freezes original health and resource simulation');
  await page.locator('#btn-resume').click();
  await expect(page.locator('#pause')).toBeHidden();
  await expect.poll(() => page.locator('#hud .plate u, #flux u, #over u').evaluateAll(elements => elements.map(element => element.style.width).join('|')), { timeout: 20000, message: 'Resume restarts actual combat/resources' }).not.toBe(frozen.join('|'));
  note('Desktop: original keyboard movement, skill energy, CPU damage, jump, pause and resume verified');
}
async function leaveBattle(page) {
  await page.locator('#btn-pause').click();
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#btn-quit').click();
  await expect(page.locator('#rf51-title')).toHaveText('戦闘から離脱しますか？');
  await page.locator('.rf51-overlay .rf51-danger').click();
  await expect(page.locator('#scr-select')).toHaveClass(/\bon\b/);
  await expect(page.locator('#select-label')).toHaveText('戦いの舞台を選ぶ');
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#pause')).toBeHidden();
}
async function touchCombat(page, context) {
  await expect(page.locator('#touch')).toBeVisible();
  await expect(page.locator('#joy')).toBeVisible();
  await expect(page.locator('#tbtns button')).toHaveCount(7);
  const cdp = await context.newCDPSession(page);
  const skill = await page.locator('#tbtns [data-act="skill"]').boundingBox();
  assert.ok(skill, 'The actual classic touch skill is reachable');
  const energy = await gauge(page, '#flux u');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: skill.x + skill.width / 2, y: skill.y + skill.height / 2, id: 1 }] });
  try { await expect.poll(() => gauge(page, '#flux u'), { timeout: 10000 }).toBeLessThan(energy - 1); }
  finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  const joystick = await page.locator('#joy').boundingBox();
  assert.ok(joystick, 'The original mobile joystick is reachable');
  const center = { x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2 };
  const beforeKnob = await page.locator('#knob').getAttribute('style');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x + 25, y: center.y - 20, id: 2 }] });
  await expect.poll(() => page.locator('#knob').getAttribute('style'), { timeout: 5000 }).not.toBe(beforeKnob);
  await page.waitForTimeout(350);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await fits(page, 'mobile battle');
  await shot(page, '02-mobile-touch-battle', false);
  note('Mobile: original touch controls spend real skill energy and respond to a joystick drag');
}
async function serverReady() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview server exited with ${server.exitCode}`);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Waiting for listen. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start');
}
try {
  server = spawn(process.execPath, ['scripts/serve.mjs', '--port', '4173', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => logs.server.push(chunk.toString()));
  server.stderr.on('data', chunk => logs.server.push(chunk.toString()));
  server.on('error', error => logs.server.push(error.message));
  await serverReady();
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const desktop = await offlineContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, 'desktop');
  const page = currentPage = await desktop.newPage(); page.setDefaultTimeout(20000); observe(page, 'desktop');
  await boot(page, '01-desktop');
  await configureLocalDisplay(page);
  await selectDuel(page, '01-desktop');
  await keyboardCombat(page);
  await shot(page, '01-desktop-combat', false);
  await leaveBattle(page);
  await desktop.close();
  const mobile = await offlineContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, 'mobile');
  const phone = currentPage = await mobile.newPage(); phone.setDefaultTimeout(20000); observe(phone, 'mobile');
  await boot(phone, '02-mobile');
  await configureLocalDisplay(phone);
  await selectDuel(phone, '02-mobile');
  await touchCombat(phone, mobile);
  await leaveBattle(phone);
  await mobile.close();
  const blockedUrls = new Set(logs.blockedNetwork.map(entry => entry.url));
  const expectedOffline = entry => /ci-offline/.test(entry.text || '') || (blockedUrls.has(entry.location?.url) && /(?:network|fetch|connect|offline|503)/i.test(entry.text || ''));
  logs.expectedOfflineConsole = logs.console.filter(entry => entry.type === 'error' && expectedOffline(entry));
  const errors = logs.console.filter(entry => entry.type === 'error' && !expectedOffline(entry));
  // A track or image that the user leaves mid-load is cancellable. Local HTTP
  // errors and non-cancellation failures always block publication.
  const network = logs.networkErrors.filter(entry => entry.status || entry.error !== 'net::ERR_ABORTED');
  assert.equal(logs.pageErrors.length, 0, `Runtime exceptions: ${JSON.stringify(logs.pageErrors)}`);
  assert.equal(errors.length, 0, `Console errors: ${JSON.stringify(errors)}`);
  assert.equal(network.length, 0, `Network errors: ${JSON.stringify(network)}`);
  logs.status = 'passed';
  note(`Classic smoke passed; ${logs.blockedNetwork.length} external API/WebSocket operations safely refused. Online/economy features were not exercised.`);
} catch (error) {
  failure = error; logs.status = 'failed'; logs.failure = { message: error.message, stack: error.stack };
  if (currentPage && !currentPage.isClosed()) try { await shot(currentPage, 'failure', false); } catch (captureError) { logs.failure.screenshot = captureError.message; }
} finally {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit'); server.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2000))]);
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  logs.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'report.json'), JSON.stringify(logs, null, 2));
}
if (failure) { console.error(failure.stack || failure.message); process.exitCode = 1; }
