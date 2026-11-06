// 運営長の配信と受信箱。配信・既読・受け取りの確定は、常に認証済みサーバーの応答を待つ。
import { apiEnabled, api } from './api.js';
import { WEAPONS, ARMORS } from './data.js';

const ITEM_LIST = [...WEAPONS, ...ARMORS];
const ITEM_NAMES = new Map(ITEM_LIST.map(x => [x.id, x.name]));
const PID = /^[a-z0-9]{8,24}$/;
const DRAFT_ID = /^[A-Za-z0-9_-]{12,64}$/;
const stamp = value => new Date(value).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const number = value => Number(value || 0).toLocaleString('ja-JP');
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const button = (label, action, cls = '') => {
  const b = el('button', cls, label);
  b.type = 'button';
  if (action) b.addEventListener('click', action);
  return b;
};
const input = (type, value = '') => Object.assign(el('input'), { type, value });
const field = (label, control) => {
  const box = el('label', 'mb-field');
  box.append(el('span', '', label), control);
  return box;
};
const giftText = gift => [gift?.shards ? `灯晶 ${number(gift.shards)}` : '', ...(gift?.items || []).map(id => ITEM_NAMES.get(id) || id)].filter(Boolean).join(' ／ ');
const err = (code, status) => Object.assign(new Error(code), { code, status });

export function mailErrorMessage(error, chief = false) {
  const code = error?.code || error?.error || error?.message || 'net';
  if (code === 'unsupported' || code === 'mail_not_ready') return chief
    ? 'メール機能の更新がまだ有効になっていません。付属のサーバー更新手順を完了してから「更新」を押してください。'
    : 'メール機能はただいま準備中です。しばらくしてから「更新」を押してください。';
  const messages = {
    nosync: '受信箱を使うには、旅支度の「端末間の同期」で一度記録を預けてください。',
    denied: 'この操作は許可されませんでした。運営長の鍵を入力し直してからお試しください。',
    recipient_notfound: 'そのプレイヤーIDは見つかりません。相手に同期を設定してもらい、IDを確認してください。',
    mail_recipient: 'このメールはあなた宛てではありません。',
    notfound: 'このメールは見つかりませんでした。受信箱を更新してください。',
    expired: '配信・受取期限を過ぎています。',
    no_gift: 'このメールにプレゼントは添付されていません。',
    wallet_full: '灯晶の所持上限（999,999）を超えるため、まだ受け取れません。先に灯晶を使ってからお試しください。',
    wealth: '進行データを確認できませんでした。旅支度で同期の状態を確認してください。',
    'too large': '保存できる進行データの上限を超えています。受け取りは確定していません。',
    send_conflict: 'この送信記録には別の内容が保存されています。送信履歴を確認してください。',
    limit: '操作が続いています。少し時間をおいて再試行してください。',
    sync: '進行データを同期できませんでした。旅支度で同期の状態を確認してからお試しください。',
    busy: '戦闘を終えてから、プレゼントを受け取ってください。',
    storage: 'この端末に記録を保存できません。空き容量やブラウザの保存設定を確認してください。',
    identity: 'プレイヤー情報が変わりました。ページを再読み込みしてください。',
    bad: '入力内容を確認してください。件名80文字、本文2,000文字、装備10点までです。',
    invalid_response: '受け取り結果を確認できませんでした。同じメールで「結果を確認」を押してください。'
  };
  return messages[code] || '通信結果を確認できませんでした。回線を確認して、同じ操作をもう一度お試しください。';
}

export function initMailbox(opts) {
  const S = { tab: 'inbox', messages: [], nextCursor: null, history: [], historyCursor: null, loading: false, mutation: false, unsupported: false, selected: null, review: null, serverOffset: 0, lastFocus: null, draftKind: 'gift', recipient: '' };
  const dialog = el('dialog');
  dialog.id = 'mailbox-dialog';
  dialog.setAttribute('aria-labelledby', 'mailbox-heading');
  const heading = el('h2', '', '運営便り');
  heading.id = 'mailbox-heading';
  const closeButton = button('閉じる', close);
  closeButton.setAttribute('aria-label', '受信箱を閉じる');
  const head = el('div', 'mb-head');
  head.append(heading, closeButton);
  const tabs = el('nav', 'mb-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'メールメニュー');
  const tabButtons = new Map();
  for (const [key, label] of [['inbox', '受信箱'], ['gift', 'プレゼント配信'], ['system', 'システムメール'], ['history', '送信履歴']]) {
    const b = button(label, () => changeTab(key));
    b.setAttribute('role', 'tab');
    b.id = `mail-tab-${key}`;
    b.setAttribute('aria-controls', 'mail-content');
    tabs.append(b);
    tabButtons.set(key, b);
  }
  const status = el('p', 'mb-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const content = el('div', 'mb-content');
  content.id = 'mail-content';
  content.setAttribute('role', 'tabpanel');
  dialog.append(head, tabs, status, content);
  tabs.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || S.mutation) return;
    const available = [...tabButtons.values()].filter(b => !b.hidden);
    const current = available.indexOf(document.activeElement);
    if (current < 0) return;
    e.preventDefault();
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? available.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    available[index].click(); available[index].focus();
  });
  document.body.append(dialog);
  // 文字入力・キー操作を、背後の戦闘へ流さない。ネイティブdialogがフォーカスを閉じ込める。
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.addEventListener('keyup', e => e.stopPropagation());
  dialog.addEventListener('cancel', e => { if (S.mutation) { e.preventDefault(); note('処理の結果を確認しています。少しお待ちください。'); } });
  dialog.addEventListener('close', () => {
    opts.onClose?.();
    if (S.lastFocus?.isConnected) S.lastFocus.focus({ preventScroll: true });
  });

  const chief = () => !!opts.isChief?.();
  const now = () => Date.now() + S.serverOffset;
  const pendingIds = () => opts.pendingClaims?.() || [];
  const isExpired = m => !m.claimedAt && (+m.expiresAt || 0) <= now();
  const pending = m => pendingIds().includes(m.id);
  const draftKey = () => 'arkeia-mail-outbox:' + opts.save.pid;
  function note(text = '', bad = false) {
    status.textContent = text;
    status.classList.toggle('mb-error', bad);
  }
  function requestFailure(result) {
    const code = result?.error || (result?.status === 404 ? 'unsupported' : result?.status === 429 ? 'limit' : 'net');
    // 古いサーバーの汎用404だけを「未対応」と判定。個別メール/プレイヤーの404とは区別する。
    if (result?.status === 404 && (!result.error || ['not found', 'not_found', 'route', 'route_not_found', 'notfound'].includes(result.error)) && !result?.id) return err('unsupported', 404);
    return err(code, result?.status);
  }
  async function request(path, body) {
    if (!apiEnabled()) throw err('unsupported');
    const result = await api(path, body);
    if (!result.ok) {
      const failure = requestFailure(result);
      // /mail/list と配信の未対応だけを全機能停止の根拠にする。
      if (failure.code === 'unsupported' && ['/mail/list', '/chief/mail/history', '/chief/mail/send'].includes(path)) S.unsupported = true;
      if (failure.code === 'unsupported' && ['/mail/read', '/mail/claim'].includes(path)) failure.code = result.error || 'notfound';
      throw failure;
    }
    if (Number.isFinite(result.serverTime)) S.serverOffset = result.serverTime - Date.now();
    S.unsupported = false;
    return result;
  }
  function requireCode() {
    const code = opts.syncCode?.() || '';
    if (!/^[A-Z0-9]{12}$/.test(code)) throw err('nosync');
    return code;
  }
  function refreshAccess() {
    const isChief = chief();
    for (const [key, b] of tabButtons) {
      b.hidden = key !== 'inbox' && !isChief;
      b.disabled = S.mutation;
      b.setAttribute('aria-selected', String(S.tab === key));
      b.tabIndex = S.tab === key ? 0 : -1;
    }
    for (const id of ['btn-chief-mail', 'chief-mail-center']) {
      const b = document.getElementById(id);
      if (b) b.hidden = !isChief;
    }
    if (!isChief && S.tab !== 'inbox') { S.tab = 'inbox'; S.review = null; if (dialog.open) render(); }
  }
  function refreshBadge() {
    const unread = S.messages.filter(m => !m.readAt).length;
    const label = unread ? `${unread}${S.nextCursor ? '+' : ''}` : '';
    for (const b of document.querySelectorAll('[data-mail-badge]')) b.textContent = label;
    const entry = document.getElementById('btn-mailbox');
    entry?.setAttribute('aria-label', unread ? `受信箱、読み込み済みの未読 ${unread} 件${S.nextCursor ? '、続きあり' : ''}` : '受信箱を開く');
  }
  function mergeMessages(list, more, old) {
    const values = new Map((more ? old : []).map(m => [m.id, m]));
    for (const m of list) if (m && typeof m.id === 'string') values.set(m.id, m);
    return [...values.values()].sort((a, b) => (+b.createdAt - +a.createdAt) || String(b.id).localeCompare(String(a.id)));
  }
  async function refresh(more = false, quiet = false) {
    if (S.loading || S.mutation) return;
    S.loading = true;
    if (!quiet) note('受信箱を確認しています…');
    try {
      const code = requireCode();
      const pid = opts.save.pid;
      const r = await request('/mail/list', { code, ...(more && S.nextCursor ? { cursor: S.nextCursor } : {}) });
      if (opts.save.pid !== pid || opts.syncCode() !== code || r.pid !== pid) throw err('identity');
      if (!Array.isArray(r.messages)) throw err('invalid_response');
      S.messages = mergeMessages(r.messages, more, S.messages);
      S.nextCursor = r.nextCursor || null;
      S.unsupported = false;
      if (!S.messages.some(m => m.id === S.selected)) S.selected = null;
      refreshBadge();
      if (!quiet) note('');
    } catch (e) {
      if (!quiet) note(mailErrorMessage(e, chief()), true);
    } finally {
      S.loading = false;
      if (dialog.open && S.tab === 'inbox') renderInbox();
    }
  }
  async function loadHistory(more = false) {
    if (!chief() || S.loading || S.mutation) return;
    S.loading = true;
    note('送信履歴を確認しています…');
    try {
      const r = await request('/chief/mail/history', { token: opts.roleToken?.() || '', ...(more && S.historyCursor ? { cursor: S.historyCursor } : {}) });
      if (!Array.isArray(r.messages)) throw err('invalid_response');
      S.history = mergeMessages(r.messages, more, S.history);
      S.historyCursor = r.nextCursor || null;
      note('');
    } catch (e) { note(mailErrorMessage(e, true), true); }
    finally { S.loading = false; if (dialog.open && S.tab === 'history') renderHistory(); }
  }
  function saveDraft(payload) {
    try { localStorage.setItem(draftKey(), JSON.stringify(payload)); }
    catch { throw err('storage'); }
  }
  function readDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey()) || 'null');
      return d && DRAFT_ID.test(d.requestId) && typeof d.title === 'string' && typeof d.body === 'string' ? d : null;
    } catch { return null; }
  }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch {} }
  function close() {
    if (S.mutation) { note('処理の結果を確認しています。少しお待ちください。'); return false; }
    dialog.close();
    return true;
  }
  function open(tab = 'inbox', recipient = '') {
    if (S.mutation) return;
    S.tab = ['gift', 'system', 'history'].includes(tab) && chief() ? tab : 'inbox';
    S.selected = null;
    S.review = null;
    S.form = null;
    S.recipient = PID.test(recipient) ? recipient : '';
    if (S.tab === 'gift' || S.tab === 'system') {
      const stored = readDraft();
      if (stored) { S.review = stored; S.tab = stored.gift ? 'gift' : 'system'; }
    }
    if (!dialog.open) {
      S.lastFocus = document.activeElement;
      opts.onOpen?.();
      dialog.showModal();
    }
    note('');
    render();
    if (S.tab === 'inbox') refresh();
    else if (S.tab === 'history') loadHistory();
    else if (S.review) note('未確認の送信記録があります。同じ内容で結果を確認すると、二重配信を防げます。');
    closeButton.focus({ preventScroll: true });
  }
  function changeTab(tab) {
    if (S.mutation || (tab !== 'inbox' && !chief())) return;
    S.tab = tab;
    S.selected = null;
    S.form = null;
    S.review = (tab === 'gift' || tab === 'system') ? readDraft() : null;
    if (S.review) S.tab = S.review.gift ? 'gift' : 'system';
    note('');
    render();
    if (tab === 'inbox') refresh();
    else if (tab === 'history') loadHistory();
  }
  function render() {
    refreshAccess();
    content.setAttribute('aria-labelledby', `mail-tab-${S.tab}`);
    if (S.tab === 'inbox') renderInbox();
    else if (S.tab === 'history') renderHistory();
    else if (S.review) renderReview();
    else if (S.form && S.formTab === S.tab) content.replaceChildren(S.form);
    else renderComposer();
  }
  function accountLine() {
    const line = el('div', 'mb-row mb-space');
    const id = el('span', 'mb-muted');
    id.append(document.createTextNode('あなたのプレイヤーID：'), el('b', 'mb-id', opts.save.pid));
    const copy = button('IDをコピー', async () => {
      try { await navigator.clipboard.writeText(opts.save.pid); note('プレイヤーIDをコピーしました。'); }
      catch { note('IDを選択してコピーしてください：' + opts.save.pid); }
    });
    line.append(id, copy);
    return line;
  }
  function renderInbox() {
    content.replaceChildren();
    content.append(accountLine());
    if ((opts.syncCode?.() || '').length !== 12) {
      const box = el('div', 'mb-note');
      box.append(el('p', '', 'メールは同期済みのプレイヤーIDに届きます。まず記録を預けると、端末を替えても受信・受取状況を引き継げます。'), button('旅支度で同期を設定', () => { if (close()) opts.openSync?.(); }, 'mb-primary'));
      content.append(box);
      return;
    }
    const top = el('div', 'mb-row mb-space');
    const unread = S.messages.filter(m => !m.readAt).length;
    top.append(el('span', 'mb-muted', `未読 ${unread} 件 ／ 読み込み済み ${S.messages.length} 件${S.nextCursor ? '（続きがあります）' : ''}`));
    const reload = button('更新', () => { S.unsupported = false; S.selected = null; refresh(); });
    reload.disabled = S.loading || S.mutation;
    top.append(reload);
    content.append(top);
    if (S.selected) {
      const selected = S.messages.find(m => m.id === S.selected);
      if (selected) { renderDetail(selected, false); return; }
    }
    const list = el('div', 'mb-list');
    for (const m of S.messages) {
      const b = messageCard(m, () => select(m.id));
      b.classList.toggle('mb-unread', !m.readAt);
      list.append(b);
    }
    content.append(list);
    if (!S.messages.length) content.append(el('p', 'mb-empty', S.loading ? 'お便りを確認しています…' : 'まだお便りは届いていません。'));
    if (S.nextCursor) {
      const more = button('次の50件を読み込む', () => refresh(true));
      more.disabled = S.loading || S.mutation;
      content.append(more);
    }
  }
  function labelFor(m, history = false) {
    if (history) return m.expiresAt <= now() ? '配信終了' : '配信中';
    if (pending(m)) return '結果確認待ち';
    if (m.claimedAt) return '受取済み';
    if (isExpired(m)) return '期限切れ';
    return m.kind === 'gift' ? 'プレゼント' : 'システムメール';
  }
  function messageCard(m, action, history = false) {
    const b = button('', action, 'mb-message');
    b.append(el('b', '', m.title), el('small', '', `運営長から · ${stamp(m.createdAt)}${history ? ` · ${m.recipient === 'all' ? '全プレイヤー' : m.recipient}` : ''}`), el('span', 'mb-tag', labelFor(m, history)));
    return b;
  }
  async function select(id) {
    S.selected = id;
    note('');
    renderInbox();
    const m = S.messages.find(x => x.id === id);
    if (!m || m.readAt || S.mutation) return;
    try {
      const code = requireCode();
      const r = await request('/mail/read', { code, id });
      if (opts.syncCode() !== code) throw err('identity');
      m.readAt = +r.readAt || now();
      refreshBadge();
      if (S.selected === id && S.tab === 'inbox') renderInbox();
    } catch (e) { note(mailErrorMessage(e, chief()), true); }
  }
  function renderGift(gift, host) {
    const box = el('div', 'mb-gift');
    box.append(el('b', '', '添付プレゼント'));
    const ul = el('ul');
    if (gift.shards) ul.append(el('li', '', `灯晶 ${number(gift.shards)} 個`));
    for (const id of gift.items || []) ul.append(el('li', '', ITEM_NAMES.get(id) || id));
    box.append(ul);
    if (gift.items?.length) box.append(el('p', 'mb-muted', '装備は所持品へ追加されます。所持済みの装備は重複せず、灯晶への交換はありません。'));
    host.append(box);
  }
  function renderDetail(m, history) {
    const box = el('article', 'mb-detail');
    box.append(button(history ? '送信履歴へ戻る' : '受信一覧へ戻る', () => { S.selected = null; note(''); history ? renderHistory() : renderInbox(); }));
    const title = el('h3', '', m.title); title.style.marginTop = '16px';
    box.append(title, el('div', 'mb-muted', `差出人：運営長　配信日時：${stamp(m.createdAt)}`), el('div', 'mb-muted', `配信・受取期限：${stamp(m.expiresAt)}`));
    if (history) box.append(el('div', 'mb-muted', '宛先：' + (m.recipient === 'all' ? '全プレイヤー' : m.recipient)));
    box.append(el('div', 'mb-body', m.body));
    if (m.kind === 'gift') renderGift(m.gift || {}, box);
    if (history) box.append(el('p', 'mb-note', labelFor(m, true)));
    else {
      const row = el('div', 'mb-row');
      if (m.kind === 'gift') {
        const b = button(pending(m) ? '受け取り結果を確認' : m.claimedAt ? '受取済み' : isExpired(m) ? '受取期限切れ' : 'プレゼントを受け取る', () => claim(m), 'mb-primary');
        b.disabled = S.mutation || (!pending(m) && (!!m.claimedAt || isExpired(m))) || !!opts.inBattle?.();
        row.append(b);
        if (opts.inBattle?.() && !m.claimedAt) box.append(el('p', 'mb-muted', '戦闘を終えてから受け取れます。'));
      }
      if (!m.readAt) {
        const b = button('既読にする', () => select(m.id));
        b.disabled = S.mutation;
        row.append(b);
      }
      box.append(row);
      if (m.claimedAt) box.append(el('p', 'mb-muted', '受取日時：' + stamp(m.claimedAt)));
    }
    content.append(box);
  }
  async function claim(m) {
    if (S.mutation) return;
    if (opts.inBattle?.()) { note(mailErrorMessage(err('busy')), true); return; }
    S.mutation = true;
    refreshAccess();
    note('プレゼントの受け取りを確認しています…');
    renderInbox();
    try {
      const r = await opts.claim(m.id);
      m.claimedAt = +r.receipt?.claimedAt || now();
      m.readAt ||= m.claimedAt;
      refreshBadge();
      opts.sfx?.('burst');
      note(r.duplicate ? '受け取り済みのプレゼントと所持品を確認しました。二重には加算されません。' : 'プレゼントを受け取りました。' + (m.gift ? ' ' + giftText(m.gift) : ''));
    } catch (e) { note(mailErrorMessage(e, chief()), true); }
    finally { S.mutation = false; refreshAccess(); if (dialog.open && S.tab === 'inbox') renderInbox(); }
  }
  function renderHistory() {
    content.replaceChildren();
    if (!chief()) return;
    const selected = S.history.find(m => m.id === S.selected);
    if (selected) { renderDetail(selected, true); return; }
    const top = el('div', 'mb-row mb-space');
    const reload = button('更新', () => { S.unsupported = false; loadHistory(); });
    reload.disabled = S.loading;
    top.append(el('span', 'mb-muted', `読み込み済み ${S.history.length} 件`), reload);
    content.append(top);
    const list = el('div', 'mb-list');
    for (const m of S.history) list.append(messageCard(m, () => { S.selected = m.id; renderHistory(); }, true));
    content.append(list);
    if (!S.history.length) content.append(el('p', 'mb-empty', S.loading ? '履歴を確認しています…' : '送信履歴はありません。'));
    if (S.historyCursor) {
      const more = button('次の50件を読み込む', () => loadHistory(true));
      more.disabled = S.loading;
      content.append(more);
    }
  }
  function renderComposer(prefill = null) {
    content.replaceChildren();
    if (!chief()) return;
    const form = el('form', 'mb-form');
    form.append(el('h3', '', S.tab === 'gift' ? '運営長からプレゼントを贈る' : '運営長からシステムメールを送る'));
    const scope = el('select');
    for (const [value, text] of [['player', 'プレイヤーを指定'], ['all', '全プレイヤー']]) { const o = el('option', '', text); o.value = value; scope.append(o); }
    scope.value = prefill?.recipient === 'all' ? 'all' : 'player';
    const pid = input('text', PID.test(prefill?.recipient || '') ? prefill.recipient : S.recipient); pid.maxLength = 24; pid.autocomplete = 'off'; pid.spellcheck = false; pid.placeholder = '相手のプレイヤーID（8〜24文字）';
    const recipientField = field('プレイヤーID', pid);
    const info = el('p', 'mb-note', '相手の受信箱に表示されるプレイヤーIDを指定してください。同期コードは入力しません。');
    const recipients = opts.save.friends || [];
    if (recipients.length) {
      const list = el('datalist'); list.id = 'mail-friend-ids';
      for (const f of recipients) if (PID.test(f.pid)) { const o = el('option', '', f.name); o.value = f.pid; list.append(o); }
      form.append(list); pid.setAttribute('list', list.id);
    }
    scope.addEventListener('change', () => {
      recipientField.hidden = scope.value === 'all';
      info.textContent = scope.value === 'all' ? '全プレイヤーに配信します。現在オフラインの人と、期限までに新しく同期を設定した人も対象です。' : '相手の受信箱に表示されるプレイヤーIDを指定してください。同期コードは入力しません。';
    });
    scope.dispatchEvent(new Event('change'));
    form.append(field('宛先', scope), recipientField, info);
    const title = input('text'); title.maxLength = 80; title.required = true; title.placeholder = S.tab === 'gift' ? '例：ご参加ありがとうございます' : '例：メンテナンスのお知らせ';
    const body = el('textarea'); body.maxLength = 2000; body.required = true; body.rows = 5; body.placeholder = '本文を入力してください（2,000文字まで）';
    if (prefill) { title.value = prefill.title || ''; body.value = prefill.body || ''; }
    form.append(field('件名（80文字まで）', title), field('本文', body));
    const count = el('span', 'mb-muted', `${[...body.value].length} / 2,000`);
    body.addEventListener('input', () => { count.textContent = `${[...body.value].length} / 2,000`; });
    form.append(count);
    let shards = null;
    const selectedItems = new Set((prefill?.gift?.items || []).filter(id => ITEM_NAMES.has(id)).slice(0, 10));
    if (S.tab === 'gift') {
      shards = input('number', String(prefill?.gift?.shards ?? 100)); shards.min = '0'; shards.max = '999999'; shards.step = '1'; shards.inputMode = 'numeric';
      form.append(field('灯晶（0〜999,999個）', shards));
      const details = el('details');
      const summary = el('summary', '', `装備品も添える（${selectedItems.size} / 10点）`);
      const search = input('search'); search.placeholder = '装備名で絞り込む'; search.setAttribute('aria-label', '贈る装備を検索');
      const list = el('div', 'mb-items');
      for (const item of ITEM_LIST) {
        const row = el('label', 'mb-item'); row.dataset.name = item.name;
        const check = input('checkbox'); check.value = item.id;
        check.checked = selectedItems.has(item.id);
        check.addEventListener('change', () => {
          if (check.checked && selectedItems.size >= 10) { check.checked = false; note('添付できる装備は10点までです。', true); return; }
          if (check.checked) selectedItems.add(item.id); else selectedItems.delete(item.id);
          summary.textContent = `装備品も添える（${selectedItems.size} / 10点）`;
        });
        row.append(check, el('span', '', `${item.id[0] === 'w' ? '武器' : '防具'} · ${item.name}`));
        list.append(row);
      }
      search.addEventListener('input', () => { const q = search.value.trim(); for (const row of list.children) row.hidden = !row.dataset.name.includes(q); });
      details.append(summary, search, list);
      form.append(details);
    }
    const days = el('select');
    for (const d of [1, 7, 30, 90]) { const option = el('option', '', `${d}日後まで`); option.value = d; days.append(option); }
    days.value = '30';
    form.append(field('配信・受取期限', days));
    const submit = button('内容を確認', null, 'mb-primary'); submit.type = 'submit';
    submit.disabled = !apiEnabled() || S.unsupported;
    form.append(submit);
    if (!apiEnabled() || S.unsupported) form.append(el('p', 'mb-note', mailErrorMessage(err('unsupported'), true)));
    if (S.unsupported) form.append(button('接続を確認する', () => { S.form = null; changeTab('history'); }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!chief() || S.mutation) return;
      const recipient = scope.value === 'all' ? 'all' : pid.value.trim();
      if (recipient !== 'all' && !PID.test(recipient)) { note('相手のプレイヤーIDを8〜24文字の半角英数字で入力してください。', true); pid.focus(); return; }
      const amount = shards ? Number(shards.value) : 0;
      if (shards && (!Number.isSafeInteger(amount) || amount < 0 || amount > 999999 || (!amount && !selectedItems.size))) { note('プレゼントには灯晶1個以上、または装備品を選んでください。', true); return; }
      const cleanTitle = title.value.trim(), cleanBody = body.value.trim();
      if (!cleanTitle || !cleanBody || [...cleanTitle].length > 80 || [...cleanBody].length > 2000) { note(mailErrorMessage(err('bad')), true); return; }
      const requestId = 'mail_' + [...crypto.getRandomValues(new Uint8Array(18))].map(v => v.toString(16).padStart(2, '0')).join('');
      S.review = { requestId, recipient, title: cleanTitle, body: cleanBody, expiresAt: Math.floor(now() + Number(days.value) * 86400000 - 2000),
        ...(shards ? { gift: { shards: amount, items: [...selectedItems] } } : {}) };
      S.form = form;
      S.formTab = S.tab;
      note('');
      renderReview();
    });
    content.append(form);
    S.form = form;
    S.formTab = S.tab;
  }
  function renderReview() {
    content.replaceChildren();
    if (!chief() || !S.review) return;
    const d = S.review;
    const persisted = readDraft()?.requestId === d.requestId;
    const box = el('section', 'mb-review mb-form');
    box.append(el('h3', '', persisted ? '送信結果の確認' : '送信内容の確認'));
    const dl = el('dl');
    for (const [key, value] of [['差出人', '運営長'], ['宛先', d.recipient === 'all' ? '全プレイヤー' : d.recipient], ['種類', d.gift ? 'プレゼント付きメール' : 'システムメール'], ['期限', stamp(d.expiresAt)]]) dl.append(el('dt', '', key), el('dd', '', value));
    box.append(dl, el('h3', '', d.title), el('div', 'mb-body', d.body));
    if (d.gift) renderGift(d.gift, box);
    if (d.recipient === 'all') box.append(el('p', 'mb-note', '全プレイヤーに届きます。現在オフラインの人、新しく同期を設定する人も期限内は受け取れます。'));
    if (persisted) box.append(el('p', 'mb-note', '同じ送信IDで結果を照会・再試行します。確認できるまで新しい配信は作成しません。'));
    const row = el('div', 'mb-row');
    const back = button(persisted ? '送信履歴を見る' : '修正に戻る', () => {
      if (S.mutation) return;
      if (persisted) { S.tab = 'history'; S.selected = null; render(); loadHistory(); }
      else { S.review = null; content.replaceChildren(S.form); note(''); }
    });
    const send = button(persisted ? '同じ送信の結果を確認' : 'この内容で送信する', sendReview, 'mb-primary');
    back.disabled = send.disabled = S.mutation;
    row.append(back, send);
    box.append(row);
    content.append(box);
  }
  async function sendReview() {
    if (S.mutation || !S.review || !chief()) return;
    const draft = { ...S.review };
    const retry = readDraft()?.requestId === draft.requestId;
    let rejectedDraft = null;
    try { saveDraft(draft); }
    catch (e) { note(mailErrorMessage(e, true), true); return; }
    S.mutation = true;
    refreshAccess();
    renderReview();
    note('配信結果を確認しています…');
    try {
      const r = await request('/chief/mail/send', { ...draft, token: opts.roleToken?.() || '' });
      if (!r.id || !r.message) throw err('invalid_response');
      clearDraft();
      S.review = null;
      S.form = null;
      S.history = mergeMessages([r.message], true, S.history);
      S.tab = 'history';
      S.selected = r.id;
      opts.sfx?.('burst');
      note(r.duplicate ? '同じ内容の配信済み記録を確認しました。重複した配信は作成していません。' : '配信しました。相手がオフラインでも、期限まで受信箱に届きます。');
    } catch (e) {
      // 入力・宛先・権限などの確定した拒否は、編集して新しいIDで送れるようにする。
      if (e.status && e.status < 500 && e.status !== 429 && e.code !== 'send_conflict' &&
          (!retry || ['bad', 'expired', 'recipient_notfound'].includes(e.code))) {
        clearDraft();
        S.review = null;
        rejectedDraft = draft;
      }
      note(mailErrorMessage(e, true) + (S.review ? '\n内容を変えずに同じ送信の結果を確認してください。' : ''), true);
    } finally {
      S.mutation = false;
      refreshAccess();
      render();
      if (rejectedDraft && !S.review && (S.tab === 'gift' || S.tab === 'system')) renderComposer(rejectedDraft);
    }
  }
  const inboxEntry = document.getElementById('btn-mailbox');
  inboxEntry?.addEventListener('click', () => open());
  for (const id of ['btn-chief-mail', 'chief-mail-center']) document.getElementById(id)?.addEventListener('click', () => open('gift'));
  const timer = setInterval(() => { if (!document.hidden && !dialog.open && !S.unsupported && apiEnabled() && (opts.syncCode?.() || '').length === 12) refresh(false, true); }, 75000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !dialog.open && !S.unsupported) refresh(false, true); });
  setTimeout(() => { if (apiEnabled() && (opts.syncCode?.() || '').length === 12) refresh(false, true); }, 6500);
  refreshAccess();
  return { open, close, refresh: () => refresh(false, true), refreshAccess, isOpen: () => dialog.open, dispose: () => { clearInterval(timer); dialog.remove(); } };
}
