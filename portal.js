/* The landing/menu interface does not depend on WebGL or model downloads. */
(() => {
  'use strict';
  let runtime = null;
  let wanted = 'landing';
  const byId = (id) => document.getElementById(id);
  const message = (text, error = false) => {
    for (const node of document.querySelectorAll('[data-boot-message]')) {
      node.textContent = text; node.classList.toggle('boot-error', error);
    }
  };
  function showStatic(id) {
    document.querySelectorAll('.screen').forEach((node) => node.classList.toggle('on', node.id === id));
    byId('hud').hidden = true;
    byId('touch').classList.remove('active');
    byId(id)?.scrollTo(0, 0);
    byId(id)?.querySelector('button')?.focus({ preventScroll: true });
  }
  function openMenu() {
    wanted = 'menu';
    if (runtime) runtime.openMenu(); else showStatic('scr-title');
  }
  function openLanding() {
    wanted = 'landing';
    if (runtime) runtime.openLanding(); else showStatic('scr-press');
  }
  function guide() {
    const d = byId('portal-guide'); if (d && !d.open) d.showModal();
  }
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-portal]'); if (!el) return;
    event.preventDefault();
    if (el.dataset.portal === 'menu') openMenu();
    if (el.dataset.portal === 'landing') openLanding();
    if (el.dataset.portal === 'guide') guide();
    if (el.dataset.portal === 'close-guide') byId('portal-guide').close();
    if (el.dataset.portal === 'reload') location.reload();
  });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.isComposing || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (byId('portal-guide')?.open) return;
    if (byId('scr-press')?.classList.contains('on') && (event.code === 'Enter' || event.code === 'Space') && !event.target.closest('button,a')) {
      event.preventDefault(); openMenu();
    }
  });
  for (const button of document.querySelectorAll('[data-runtime-action]')) button.disabled = true;
  window.ArkeiaPortal = {
    bind(api) {
      runtime = api;
      document.querySelectorAll('[data-runtime-action]').forEach((button) => { button.disabled = false; });
      message('メニューから遊び方を選んでください。モデルは必要な分を確認してから開始します。');
      if (wanted === 'menu') runtime.openMenu();
    },
    openMenu, openLanding,
    failure(error) {
      message('ゲームエンジンを読み込めませんでした。ページを再読込してください。', true);
      const node = byId('boot-detail');
      if (node) { node.hidden = false; node.textContent = error?.message || String(error); }
      document.querySelectorAll('[data-portal="reload"]').forEach((node) => { node.hidden = false; });
    }
  };
  window.addEventListener('error', (event) => {
    if (!runtime && event.error) window.ArkeiaPortal.failure(event.error);
    if (event.target?.id === 'game-entry') window.ArkeiaPortal.failure(new Error('main.js または依存ライブラリの読込に失敗しました'));
  }, true);
  window.addEventListener('unhandledrejection', (event) => {
    if (!runtime) window.ArkeiaPortal.failure(event.reason);
  });
  setTimeout(() => { if (!runtime) {
    message('エンジンを読み込み中です。長く続く場合は通信状態を確認し、再読込してください。');
    document.querySelectorAll('[data-portal="reload"]').forEach((node) => { node.hidden = false; });
  } }, 25000);
})();
