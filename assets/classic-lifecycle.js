// Backgrounding a solo game must not leave the player fighting without input.
// Networked and server-authoritative modes keep their existing clock semantics.
const SOLO_MODES = new Set(['story', 'story2', 'cpu', 'duo', 'infinite', 'event', 'adventure']);

export function canAutoPauseOffline(state, blocked = false) {
  if (!state || blocked || !SOLO_MODES.has(state.mode) || state.paused || state.battleLoading) return false;
  if (state.online || state.net || state.invaded || state.duel || state.battle?.ranked || state.battle?.siege) return false;
  return Boolean((state.battle && !state.battle.ended) ||
    (!state.battle && state.field && !state.field.frozen) ||
    (!state.battle && state.adventureRest));
}

export function installOfflineAutoPause({ window, document, getState, isBlocked, pause, focusResume }) {
  let pausedWhileAway = false;
  const leave = () => {
    if (!canAutoPauseOffline(getState(), isBlocked())) return;
    pause();
    pausedWhileAway = true;
  };
  const returnToGame = () => {
    if (document.hidden || !document.hasFocus() || !pausedWhileAway) return;
    pausedWhileAway = false;
    // Return to the pause controls, never silently resume a battle.
    if (getState().paused && !isBlocked()) focusResume();
  };
  const visibility = () => document.hidden ? leave() : returnToGame();
  window.addEventListener('blur', leave);
  window.addEventListener('focus', returnToGame);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    window.removeEventListener('blur', leave);
    window.removeEventListener('focus', returnToGame);
    document.removeEventListener('visibilitychange', visibility);
  };
}
