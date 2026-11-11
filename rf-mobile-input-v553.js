// RF553_MOBILE_FOCUS_ZOOM_FIX_20261111
// Prevent Safari's small-input auto-zoom and recover the viewport after keyboard dismissal.
// This does not permanently disable pinch zoom or change the document scroll position.
(() => {
  'use strict';
  if (window.__rf553MobileInputFix) return;
  window.__rf553MobileInputFix = true;
  const mobile = (window.matchMedia?.('(pointer: coarse)').matches) || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!mobile) return;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const viewport = document.querySelector('meta[name="viewport"]');
  const metaOriginal = viewport?.getAttribute('content') || 'width=device-width, initial-scale=1, viewport-fit=cover';
  const vv = window.visualViewport;
  const editable = el => el instanceof Element && (
    el.matches('textarea, select, [contenteditable="true"], [role="textbox"]') ||
    (el.matches('input') && !el.matches('input[type=checkbox],input[type=radio],input[type=range],input[type=button],input[type=submit],input[type=file],input[type=color]'))
  );
  let focused = false;
  let beforeScale = 1;
  let lastEdited = 0;
  let recoveryTimer = 0;
  const prepare = () => {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    beforeScale = vv?.scale || 1;
    focused = true;
    lastEdited = Date.now();
    document.documentElement.classList.add('rf553-keyboard-open');
  };
  document.addEventListener('focusin', e => { if (editable(e.target)) prepare(); }, true);
  document.addEventListener('focusout', e => {
    if (!editable(e.target)) return;
    focused = false;
    lastEdited = Date.now();
    document.documentElement.classList.remove('rf553-keyboard-open');
    // Safari often animates its visual viewport after focusout, so check after the keyboard closes.
    [180, 460, 860].forEach(delay => setTimeout(restore, delay));
  }, true);
  const restore = () => {
    if (focused || editable(document.activeElement)) return;
    // Explicit user pinch zoom should never be reset. Only recover input-induced zoom.
    const scale=vv?.scale || 1;
    if (ios && viewport && beforeScale < 1.06 && scale > 1.07 && Date.now()-lastEdited < 2400) {
      const original=viewport.getAttribute('content') || metaOriginal;
      // Temporary viewport toggle restores the initial scale on affected WebKit versions.
      // Restore normal pinch-to-zoom in the next frame.
      const withoutMax=original.replace(/(?:^|,)\s*maximum-scale\s*=\s*[^,]+/ig,'').trim();
      viewport.setAttribute('content', withoutMax + ', maximum-scale=1');
      requestAnimationFrame(() => {
        viewport.setAttribute('content', original);
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      });
      return;
    }
    // The keyboard can change visualViewport dimensions even if no scale adjustment is needed.
    window.dispatchEvent(new Event('resize'));
  };
  vv?.addEventListener('resize', () => {
    if (!focused && Date.now() - lastEdited < 1800) {
      if (recoveryTimer) clearTimeout(recoveryTimer);
      recoveryTimer = setTimeout(restore, 140);
    }
  }, { passive:true });
  window.addEventListener('orientationchange', () => {
    beforeScale=1;
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  });
})();
