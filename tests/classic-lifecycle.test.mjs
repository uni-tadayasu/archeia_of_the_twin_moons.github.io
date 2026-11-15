import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoPauseOffline, installOfflineAutoPause } from '../assets/classic-lifecycle.js';

test('only active solo gameplay can automatically pause', () => {
  for (const mode of ['story', 'story2', 'cpu', 'duo', 'infinite', 'event', 'adventure']) {
    assert.equal(canAutoPauseOffline({ mode, battle: {} }), true, mode);
  }
  assert.equal(canAutoPauseOffline({ mode: 'story', field: {} }), true);
  assert.equal(canAutoPauseOffline({ mode: 'adventure', adventureRest: true }), true);
  for (const extra of [
    { paused: true }, { battleLoading: true }, { online: {} }, { net: {} },
    { invaded: true }, { duel: {} }, { battle: { ranked: {} } },
    { battle: { siege: {} } }, { battle: { ended: true } }
  ]) assert.equal(canAutoPauseOffline({ mode: 'cpu', battle: {}, ...extra }), false, JSON.stringify(extra));
  for (const mode of ['online-vs', 'online-coop', 'event-coop', 'ranked', 'invade', 'castle', null]) {
    assert.equal(canAutoPauseOffline({ mode, battle: {} }), false, String(mode));
  }
  assert.equal(canAutoPauseOffline({ mode: 'story', field: { frozen: true } }), false);
  assert.equal(canAutoPauseOffline({ mode: 'cpu' }), false, 'menus and initial boot have no active game');
  assert.equal(canAutoPauseOffline({ mode: 'story', battle: {} }, true), false, 'dialogues and overlays retain focus');
});

function harness() {
  const window = new EventTarget(), document = new EventTarget();
  let focused = true, blocked = false, pauses = 0, returns = 0;
  const state = { mode: 'cpu', battle: {}, paused: false };
  document.hidden = false;
  document.hasFocus = () => focused;
  const stop = installOfflineAutoPause({
    window, document, getState: () => state, isBlocked: () => blocked,
    pause() { pauses++; state.paused = true; }, focusResume() { returns++; }
  });
  return {
    window, document, state, stop,
    focus(value) { focused = value; window.dispatchEvent(new Event(value ? 'focus' : 'blur')); },
    visible(value) { document.hidden = !value; document.dispatchEvent(new Event('visibilitychange')); },
    block(value) { blocked = value; },
    get pauses() { return pauses; }, get returns() { return returns; }
  };
}

test('window blur pauses once, and returning focuses resume without restarting gameplay', () => {
  const app = harness();
  app.focus(false);
  app.visible(false);
  assert.equal(app.pauses, 1, 'blur and visibility events must not toggle the pause off');
  app.visible(true);
  assert.equal(app.returns, 0, 'a visible but unfocused window must not steal focus');
  app.focus(true);
  assert.equal(app.returns, 1);
  assert.equal(app.state.paused, true);
  app.focus(true);
  assert.equal(app.returns, 1, 'focus restoration is performed once');
  app.state.paused = false; // The user explicitly resumes.
  app.focus(false);
  assert.equal(app.pauses, 2, 'later departures also pause');
  app.stop();
});

test('visibility alone pauses, but a manual pause and open dialogs are left alone', () => {
  const app = harness();
  app.visible(false);
  assert.equal(app.pauses, 1, 'mobile application switches need no blur event');
  app.visible(true);
  assert.equal(app.returns, 1);
  app.focus(false);
  app.focus(true);
  assert.equal(app.pauses, 1);
  assert.equal(app.returns, 1, 'an existing pause is not claimed by the lifecycle helper');
  app.state.paused = false;
  app.block(true);
  app.focus(false);
  app.focus(true);
  assert.equal(app.pauses, 1, 'a dialogue cannot be replaced by pause controls');
  app.block(false);
  app.stop();
  app.visible(false);
  app.focus(false);
  assert.equal(app.pauses, 1, 'cleanup removes all lifecycle listeners');
});

test('returning never steals focus from a dialog opened while away', () => {
  const app = harness();
  app.focus(false);
  app.block(true);
  app.focus(true);
  assert.equal(app.returns, 0);
  assert.equal(app.state.paused, true);
  app.stop();
});
