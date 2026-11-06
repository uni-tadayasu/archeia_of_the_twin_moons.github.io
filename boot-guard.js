/* Startup diagnostics: helps when the game module cannot initialize. */
(() => {
  let reported = false;
  const hint = () => document.getElementById('loading');
  const panel = () => document.getElementById('boot-recovery');
  const text = () => document.getElementById('boot-detail');
  const recover = (detail) => {
    if (window.__arkeiaBootReady || reported) return;
    reported = true;
    if (hint()) hint().textContent = '起動を完了できませんでした。';
    if (text()) text().textContent = detail;
    if (panel()) panel().hidden = false;
  };
  window.addEventListener('error', e => {
    const detail = e.message || '読み込み中にエラーが発生しました。';
    if (!window.__arkeiaBootReady) recover(detail);
  });
  window.addEventListener('unhandledrejection', e => {
    const detail = e.reason?.message || '通信または読み込みが失敗しました。';
    if (!window.__arkeiaBootReady) recover(detail);
  });
  document.getElementById('boot-retry')?.addEventListener('click', () => {
    const u = new URL(window.location.href);
    u.searchParams.set('refresh', Date.now().toString());
    window.location.replace(u.toString());
  });
  setTimeout(() => {
    if (!window.__arkeiaBootReady) recover('起動処理が応答していません。通信環境とJavaScriptのエラーを確認し、再読み込みしてください。');
  }, 14000);
})();
