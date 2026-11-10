// Riftfall Arena V41 / Fujiwara Nobuyori administrator controls.
// Drop-in replacement for fujiwara-chief-v39.js introduced by V39.
// The original GLB, animations, skills, BGM, and other fighters are untouched.
const RF41_KEY = 'rf39_fujiwara_strength'; // Keep existing V39 saved preferences.
const RF41_FIGHTER = 'fujiwara_nobuyori';

function rf41Percent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(100, Math.round(n))) : 100;
}
function rf41Read() {
  try { return rf41Percent(localStorage.getItem(RF41_KEY) ?? 100); }
  catch { return 100; }
}
function rf41Save(value) {
  const n = rf41Percent(value);
  try { localStorage.setItem(RF41_KEY, String(n)); }
  catch (err) { console.warn('[RF41] 強さ設定を保存できませんでした', err); }
  return n;
}

/**
 * Battle: existing Battle class; isChief: the game's chiefUnlocked() authority check.
 * save/persist/UPGRADES/LB_MAX/lbMaxLv: optional direct game integration, needed
 * for full administrator max-level upgrade and limit-break support.
 */
export function installFujiwaraChief({ Battle, isChief, save, persist, UPGRADES, LB_MAX, lbMaxLv } = {}) {
  if (!Battle?.prototype?.applyHit) {
    console.warn('[RF41] Battle.prototype.applyHit が見つかりません');
    return;
  }
  const authorized = () => {
    try { return typeof isChief === 'function' && isChief() === true; }
    catch { return false; }
  };

  // Only locally controlled Fujiwara hits are scaled. Avoid rescaling received
  // network-authoritative hits. The server must also verify online permissions.
  if (!Battle.prototype.__rf41FujiwaraStrength) {
    const originalApplyHit = Battle.prototype.applyHit;
    Battle.prototype.applyHit = function(attacker, target, damage, ...rest) {
      if (attacker?.key === RF41_FIGHTER && !attacker.remoteAuth) {
        const percent = authorized() ? rf41Read() : 100;
        const base = Number(damage);
        if (Number.isFinite(base) && base > 0) {
          damage = Math.round(base * (percent / 100));
          if (damage <= 0) return false;
        }
      }
      return originalApplyHit.call(this, attacker, target, damage, ...rest);
    };
    Battle.prototype.__rf41FujiwaraStrength = true;
  }

  let panel = null;
  const byId = id => panel?.querySelector('#' + id);
  let slider, numeric, valueText;
  function repaint(value = rf41Read()) {
    const percent = rf41Percent(value);
    if (slider && document.activeElement !== slider) slider.value = String(percent);
    if (numeric && document.activeElement !== numeric) numeric.value = String(percent);
    if (valueText) valueText.textContent = `${percent}%`;
    if (panel) panel.style.setProperty('--rf41-progress', percent + '%');
  }
  function commit(raw) {
    if (!authorized()) return;
    const percent = rf41Save(raw);
    if (slider) slider.value = String(percent);
    if (numeric) numeric.value = String(percent);
    repaint(percent);
  }
  function el(tag, text, css) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (css) element.style.cssText = css;
    return element;
  }
  function create() {
    if (panel?.isConnected) return panel;
    const host = document.querySelector('#scr-options .inner');
    if (!host) return null;
    panel = el('section', null,
      'margin:18px 0;padding:16px 18px;border:1px solid #b693e1;border-radius:12px;background:linear-gradient(145deg,#292038,#171426);color:#f8f0ff;max-width:660px;');
    panel.id = 'rf39-fujiwara-admin';
    panel.hidden = true;
    panel.setAttribute('aria-label', '藤原信頼の運営長専用設定');
    panel.appendChild(el('h3', '藤原信頼｜運営長専用設定', 'margin:0 0 7px;font-size:18px;color:#ead0ff;'));
    panel.appendChild(el('p', '強さ（与えるダメージ倍率）を1％単位で調整します。', 'font-size:13px;margin:4px 0 12px;color:#d8cde5;'));
    const label = el('label', '現在の強さ：', 'display:block;font-weight:700;margin-bottom:7px;');
    label.htmlFor = 'rf41-strength-slider';
    valueText = el('output', '100%', 'font-variant-numeric:tabular-nums;font-size:26px;color:#f8dfaa;');
    valueText.id = 'rf41-percent-output';
    valueText.setAttribute('aria-live', 'polite');
    label.appendChild(valueText);
    panel.appendChild(label);
    slider = el('input', null, 'display:block;width:100%;margin:9px 0 14px;accent-color:#c4a1ff;cursor:pointer;');
    slider.id = 'rf41-strength-slider';
    slider.type = 'range'; slider.min = '1'; slider.max = '100'; slider.step = '1';
    slider.setAttribute('aria-label', '藤原信頼の強さを1％から100％まで変更');
    slider.addEventListener('input', () => commit(slider.value));
    panel.appendChild(slider);
    const row = el('div', null, 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:5px 0 12px;');
    const btnStyle = 'padding:8px 12px;border:1px solid #a78bbb;border-radius:7px;background:#463451;color:#fff;font-weight:bold;cursor:pointer;';
    const minus = el('button', '−1％', btnStyle); minus.type = 'button'; minus.addEventListener('click', () => commit(rf41Read()-1));
    const plus = el('button', '+1％', btnStyle); plus.type = 'button'; plus.addEventListener('click', () => commit(rf41Read()+1));
    numeric = el('input', null, 'width:82px;padding:7px 9px;border:1px solid #a78bbb;border-radius:6px;background:#191323;color:#fff;text-align:right;');
    numeric.type = 'number'; numeric.min = '1'; numeric.max = '100'; numeric.step = '1'; numeric.id = 'rf41-strength-number';
    numeric.setAttribute('aria-label', '強さのパーセント数値入力');
    numeric.addEventListener('change', () => commit(numeric.value));
    const pct = el('span', '%');
    const reset = el('button', '100％に戻す', btnStyle); reset.type = 'button'; reset.addEventListener('click', () => commit(100));
    row.append(minus,plus,numeric,pct,reset);
    panel.appendChild(row);
    const split = el('hr', null, 'border:0;border-top:1px solid #715a83;margin:16px 0 12px;');
    panel.appendChild(split);
    panel.appendChild(el('h4', '強化・限界突破', 'font-size:15px;margin:0 0 7px;'));
    const max = el('button', '強化と限界突破を最大化', btnStyle + 'background:#6d397d;');
    max.type = 'button'; max.id = 'rf41-admin-max';
    const info = el('p', '現在のデータに対応する場合のみ最大化します。', 'font-size:12px;line-height:1.5;color:#d6c8e5;');
    info.id = 'rf41-admin-result'; info.setAttribute('role', 'status');
    max.addEventListener('click', () => {
      if (!authorized()) return;
      if (!save || typeof persist !== 'function' || !Array.isArray(UPGRADES) || !Number.isInteger(LB_MAX) || typeof lbMaxLv !== 'function') {
        info.textContent = 'ゲーム本体との連携が未更新です。V41導入ツールで現在のゲームZIPを更新してください。';
        return;
      }
      const level = lbMaxLv(LB_MAX);
      const count = UPGRADES.length;
      if (!Number.isInteger(level) || level < 1 || count < 1) {
        info.textContent = '最大値を取得できなかったため変更していません。'; return;
      }
      if (!window.confirm(`藤原信頼の限界突破を${LB_MAX}回、全${count}種の強化を各${level}段にします。\n現在のセーブデータを更新します。よろしいですか？`)) return;
      save.lb ||= {}; save.upg ||= {};
      save.lb[RF41_FIGHTER] = LB_MAX;
      save.upg[RF41_FIGHTER] = Object.fromEntries(UPGRADES.map(u => [u.id, level]));
      try { persist(); info.textContent = `最大化しました：限界突破${LB_MAX}回・${count}種類すべて${level}段。反映には戦闘の再開始が必要な場合があります。`; }
      catch (e) { info.textContent = `保存に失敗しました：${String(e?.message || e)}`; }
    });
    panel.append(max,info);
    host.appendChild(panel);
    repaint();
    return panel;
  }
  function refresh() {
    const target = create();
    if (!target) return;
    target.hidden = !authorized();
    if (!target.hidden && document.activeElement !== slider && document.activeElement !== numeric) repaint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once:true });
  else refresh();
  window.addEventListener('storage', e => { if (e.key === RF41_KEY) repaint(); });
  window.addEventListener('focus', refresh);
  // The role is usually obtained asynchronously from the server.
  setInterval(refresh, 1500);
  if (typeof window !== 'undefined') window.__RF41_FujiwaraStrength = rf41Read;
  console.info('[RF41] 藤原信頼の強さを1～100%、1%刻みで変更可能');
}
