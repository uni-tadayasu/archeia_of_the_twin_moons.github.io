/* Riftfall Arena battle crash diagnostics V9.1 — no network reporting,
   no changes to saves, roles, fights or data files. */
(() => {
  'use strict';
  const KEY = 'rf-battle-v9-last-state';
  const historyKey = 'rf-battle-v9-errors';
  const now = () => Date.now();
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };
  const save = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const previous = read(KEY);
  const errors = Array.isArray(read(historyKey)) ? read(historyKey) : [];
  const report = (message, phase='error') => {
    const info = { time: new Date().toISOString(), phase, message: String(message || '不明なエラー').slice(0, 1300) };
    errors.push(info);
    while (errors.length > 8) errors.shift();
    save(historyKey, errors);
    save(KEY, { phase, note: info.message, at: now() });
    return info;
  };
  window.__rfMarkBattlePhase = (phase, note = '') => {
    if (phase === 'error') report(note, phase);
    else save(KEY, { phase, note: String(note).slice(0, 300), at: now() });
  };
  window.addEventListener('error', event => {
    report((event?.message || 'JavaScript error') + ' ' + (event?.filename || '') + ':' + (event?.lineno || 0));
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    report('Unhandled promise: ' + (reason?.stack || reason?.message || String(reason)));
  });
  window.addEventListener('webglcontextlost', event => {
    report('WebGL context lost (graphics memory / driver / GPU)', 'gpu-error');
    // Leave recovery to Three.js. Do not force a page reload or delete game data.
  }, true);
  function showDiagnostics(caption, message) {
    if (document.getElementById('rf-battle-v9-diagnostics')) return;
    const panel = document.createElement('aside');
    panel.id = 'rf-battle-v9-diagnostics';
    panel.style.cssText = 'position:fixed;z-index:200080;left:12px;right:12px;bottom:12px;margin:auto;max-width:740px;max-height:65vh;overflow:auto;border:1px solid #d9aa68;border-radius:9px;background:rgba(17,23,28,.98);color:#f4eedf;padding:15px 16px;box-shadow:0 12px 45px #000b;font:14px/1.65 system-ui,sans-serif;pointer-events:auto;white-space:normal';
    const title = document.createElement('strong');title.textContent = caption;
    const desc = document.createElement('div');desc.textContent = message;desc.style.marginTop='6px';
    const log = document.createElement('pre');log.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;max-height:160px;overflow:auto;opacity:.9';
    const output = () => ['Riftfall Arena crash report V9.1', navigator.userAgent, ...errors.map(e => `${e.time} ${e.phase} ${e.message}`)].join('\n');
    log.textContent = output().slice(-2400);
    const buttons = document.createElement('div');buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:9px';
    const makeButton = (label, action) => {const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:7px 12px;background:#254a37;color:white;border:1px solid #65b985;border-radius:4px;cursor:pointer';b.onclick=action;buttons.append(b);};
    makeButton('エラー情報をコピー', () => {const txt=output();if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).catch(()=>{});else {try{const a=document.createElement('textarea');a.value=txt;document.body.append(a);a.select();document.execCommand('copy');a.remove();}catch{}}});
    makeButton('閉じる', () => panel.remove());
    panel.append(title,desc,log,buttons);document.body.append(panel);
  }
  // An actual browser process crash cannot be caught; we can report that
  // the last session ended during battle initialization after next startup.
  window.addEventListener('load', () => {
    setTimeout(() => {
      const last = previous;
      if (last && now() - last.at < 1000 * 60 * 5 && ['loading','battle','error','gpu-error'].includes(last.phase)) {
        showDiagnostics('前回の戦闘が正常に終了しなかった可能性があります',
          '最新の戦闘開始エラーまたはスマホのメモリ不足が考えられます。再発したら「エラー情報をコピー」で状況を確認できます。');
      } else if (!window.__arkeiaBootOk) {
        showDiagnostics('ゲーム初期化エラー', 'main.jsが最後まで実行できていません。ファイルの配置とブラウザのエラーを確認してください。');
      }
    }, 10000);
  }, { once:true });
  window.__rfCrashDiagnostics = { report, showDiagnostics };
})();
