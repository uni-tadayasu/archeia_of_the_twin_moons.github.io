export const EDITABLE_CONTROL = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

export function activeInputModal(doc) {
  const dialogs = doc.querySelectorAll('dialog[open], [aria-modal="true"]:is([role="dialog"], [role="alertdialog"])');
  for (let i = dialogs.length - 1; i >= 0; i--) {
    const dialog = dialogs[i];
    if (!dialog.closest('[hidden], [inert]') && dialog.getClientRects().length) return dialog;
  }
  return null;
}

export function gamepadMenuItems(root) {
  if (!root) return [];
  const items = root.querySelectorAll('button, a[href], input, textarea, select, summary, #story-box');
  return [...items].filter(item => {
    if (item.tabIndex < 0 || item.matches(':disabled') || item.closest('[hidden], [inert]') || !item.getClientRects().length) return false;
    const disclosure = item.closest('details:not([open])');
    return !disclosure || (item === disclosure.querySelector(':scope > summary') && !disclosure.parentElement?.closest('details:not([open])'));
  });
}

export function adjustGamepadValue(control, direction) {
  if (!control || control.matches(':disabled')) return false;
  const before = control.value;
  if (control.matches('input[type="range"]')) {
    if (control.step === 'any') {
      const min = Number(control.min || 0);
      const max = Number(control.max || 100);
      control.valueAsNumber += direction * (max - min) / 20;
    } else {
      control.stepUp(direction);
    }
  } else if (control.matches('select:not([multiple])')) {
    const options = control.options;
    for (let index = control.selectedIndex + direction; index >= 0 && index < options.length; index += direction) {
      if (!options[index].matches(':disabled') && !options[index].closest('[hidden]')) {
        control.selectedIndex = index;
        break;
      }
    }
  } else {
    return false;
  }
  if (control.value !== before) {
    const Event = control.ownerDocument.defaultView.Event;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return true;
}

export function activateGamepadControl(control) {
  const Event = control.ownerDocument.defaultView.Event;
  const activate = new Event('riftfall-controller-activate', { bubbles: true, cancelable: true });
  if (control.dispatchEvent(activate)) control.click();
}

const HOLD_ACTIONS = new Set(['guard', 'skill', 'skill2']);
const ACTIVATE_KEYS = new Set(['Enter', 'Space']);

export function bindTouchControls(pad, state, edges, canUseInput) {
  const window = pad.ownerDocument.defaultView;
  const joy = pad.querySelector('#joy');
  const knob = pad.querySelector('#knob');
  const pressed = new Map();
  let stickPointer = null;

  function capture(element, pointer) {
    try { element.setPointerCapture(pointer); } catch { /* A pointer may end while its event is being handled. */ }
  }
  function release(element, pointer) {
    if (pointer !== null && element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
  }
  function updateStick(event) {
    const rect = joy.getBoundingClientRect();
    const radius = Math.max(1, rect.width / 2);
    const dx = (event.clientX - rect.left - radius) / radius;
    const dy = (event.clientY - rect.top - rect.height / 2) / radius;
    const distance = Math.hypot(dx, dy);
    const amount = Math.max(0, Math.min(1, (distance - .13) / .87));
    state.mx = distance ? dx * amount / distance : 0;
    state.mz = distance ? dy * amount / distance : 0;
    knob.style.transform = `translate(${state.mx * radius * .6}px, ${state.mz * radius * .6}px)`;
  }
  function clearStick() {
    const pointer = stickPointer;
    stickPointer = null;
    state.mx = state.mz = 0;
    knob.style.transform = '';
    release(joy, pointer);
  }
  function press(button, source, id) {
    if (!canUseInput() || pressed.has(button)) return null;
    const action = button.dataset.act;
    const entry = { source, id, timer: null };
    pressed.set(button, entry);
    button.classList.add('rf5521-held');
    if (action !== 'guard') edges[action] = true;
    if (HOLD_ACTIONS.has(action)) state[action] = true;
    return entry;
  }
  function clearButton(button) {
    const entry = pressed.get(button);
    if (!entry) return;
    pressed.delete(button);
    if (entry.timer !== null) window.clearTimeout(entry.timer);
    button.classList.remove('rf5521-held');
    const action = button.dataset.act;
    if (HOLD_ACTIONS.has(action)) state[action] = false;
    if (entry.source === 'pointer') release(button, entry.id);
  }
  function finishPointer(event) {
    if (event.pointerId === stickPointer) clearStick();
    for (const [button, entry] of pressed) {
      if (entry.source === 'pointer' && entry.id === event.pointerId) clearButton(button);
    }
  }
  joy.addEventListener('pointerdown', event => {
    if (stickPointer !== null || event.button !== 0 || !canUseInput()) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    capture(joy, stickPointer);
    updateStick(event);
  });
  window.addEventListener('pointermove', event => {
    if (event.pointerId === stickPointer) updateStick(event);
  }, { passive: true });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    window.addEventListener(type, finishPointer, { capture: true });
  }

  for (const button of pad.querySelectorAll('button[data-act]')) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !press(button, 'pointer', event.pointerId)) return;
      event.preventDefault();
      capture(button, event.pointerId);
    });
    button.addEventListener('keydown', event => {
      if (!ACTIVATE_KEYS.has(event.code) || event.altKey || event.ctrlKey || event.metaKey || event.isComposing || !canUseInput()) return;
      event.preventDefault();
      if (!event.repeat) press(button, 'key', event.code);
    });
    button.addEventListener('keyup', event => {
      const entry = pressed.get(button);
      if (entry?.source !== 'key' || entry.id !== event.code) return;
      event.preventDefault();
      clearButton(button);
    });
    button.addEventListener('blur', () => {
      if (pressed.get(button)?.source === 'key') clearButton(button);
    });
    button.addEventListener('click', event => {
      // Assistive technologies can activate a native button without a pointer or key event.
      if (event.detail !== 0 || !canUseInput() || pressed.has(button)) return;
      if (button.dataset.act !== 'guard') {
        edges[button.dataset.act] = true;
        return;
      }
      const entry = press(button, 'click', null);
      if (entry) entry.timer = window.setTimeout(() => clearButton(button), 180);
    });
  }
  return () => {
    clearStick();
    for (const button of pressed.keys()) clearButton(button);
  };
}
