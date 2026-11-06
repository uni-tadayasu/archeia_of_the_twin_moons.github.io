// Shared collection browsing and accessible menu helpers. No saved gameplay data is changed here.
const $ = (selector) => document.querySelector(selector);
const norm = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase('ja');
const make = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

export function filterSelection() {
  const grid = $('#select-grid');
  const kind = $('#scr-select').dataset.kind;
  const terms = norm($('#select-search').value).trim().split(/\s+/).filter(Boolean);
  const group = $('#select-filter').value;
  const cards = [...grid.children];
  let visible = 0, total = 0, random = false;
  for (const card of cards) {
    const haystack = norm(card.dataset.search);
    const matches = terms.every((term) => haystack.includes(term));
    const category = group === 'all' || (group === 'available' && !card.disabled)
      || (group === 'locked' && card.disabled) || (group === 'picked' && card.classList.contains('picked'))
      || card.dataset.group === group;
    card.hidden = !matches || !category;
    if (card.dataset.stage === 'random') random = !card.hidden;
    else { total++; if (!card.hidden) visible++; }
  }
  $('#select-count').textContent = kind === 'stage'
    ? visible + ' / ' + total + ' 舞台' + (random ? ' ＋ 風まかせ' : '')
    : visible + ' / ' + total + ' 人';
  $('#select-empty').hidden = visible > 0 || random;
  $('#select-clear').disabled = !terms.length && group === 'all';
  if (grid.contains(document.activeElement) && document.activeElement.closest('[hidden]')) $('#select-search').focus({ preventScroll: true });
}

export function configureSelection(kind, categories = []) {
  $('#scr-select').dataset.kind = kind;
  $('#stage-detail').hidden = kind !== 'stage';
  $('#selection-notice').textContent = '';
  const search = $('#select-search'), select = $('#select-filter');
  search.value = '';
  search.placeholder = kind === 'stage' ? '舞台名・地形で探す' : '名前・二つ名・技で探す';
  $('#select-search-label').textContent = kind === 'stage' ? '舞台を探す' : '戦士を探す';
  $('#select-filter-label').textContent = kind === 'stage' ? '地形' : '表示';
  const options = kind === 'stage' ? [['all', 'すべての地形'], ...categories]
    : kind === 'party' ? [['all', 'すべての仲間'], ['picked', '編成した仲間']]
      : [['all', 'すべての戦士'], ['available', '選択できる戦士'], ['locked', '未解放の戦士']];
  select.replaceChildren(...options.map(([value, label]) => {
    const option = make('option', '', label); option.value = value; return option;
  }));
  search.oninput = filterSelection;
  select.onchange = filterSelection;
  $('#select-clear').onclick = () => {
    search.value = ''; select.value = 'all'; filterSelection(); search.focus();
  };
  $('#select-layout').removeAttribute('aria-busy');
  filterSelection();
}

export function renderStageBrowser({ stages, getArt, selected, onConfirm, sound }) {
  const grid = $('#select-grid'), confirm = $('#stage-confirm');
  const choices = [{ id: 'random', name: '風まかせ' }, ...stages];
  const cards = new Map(), categories = new Map();
  let picked = choices.find((stage) => stage.id === selected) || stages[0], starting = false;
  const select = (stage) => {
    if (starting) return;
    picked = stage;
    const art = getArt(stage);
    for (const [id, card] of cards) {
      const active = id === stage.id;
      card.classList.toggle('picked', active);
      card.setAttribute('aria-pressed', String(active));
    }
    const img = $('#stage-preview');
    img.src = art.src;
    img.alt = stage.id === 'random' ? '月明かりに照らされた闘技場のイラスト' : stage.name + 'の風景イラスト';
    $('#stage-detail').style.setProperty('--stage-accent', art.accent);
    $('#stage-location').textContent = art.label;
    $('#stage-name').textContent = stage.name;
    $('#stage-note').textContent = stage.id === 'random'
      ? '全' + stages.length + '舞台から、出発時にひとつを選びます。'
      : '選択中の舞台です。準備ができたら、下のボタンで手合わせを始めましょう。';
    confirm.textContent = stage.id === 'random' ? '風まかせで始める' : 'この舞台で始める';
    confirm.disabled = false;
  };
  grid.replaceChildren();
  for (const [index, stage] of choices.entries()) {
    const art = getArt(stage);
    if (stage.id !== 'random') categories.set(art.biome, art.label);
    const card = make('button', 'card stage-card');
    card.type = 'button';
    card.dataset.stage = stage.id;
    card.dataset.group = art.biome;
    card.dataset.search = stage.name + ' ' + art.label;
    card.style.setProperty('--c', art.accent);
    card.setAttribute('aria-label', stage.name + '、' + art.label + '。舞台を選択');
    card.setAttribute('aria-controls', 'stage-detail');
    const thumb = make('span', 'sthumb');
    const img = make('img');
    img.src = art.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.width = 384; img.height = 216;
    thumb.append(img, make('span', 'stage-tag', art.label));
    const caption = make('span', 'stage-caption');
    caption.append(make('em', '', index ? '舞台 ' + String(index).padStart(2, '0') : '月に行き先を委ねる'), make('b', '', stage.name));
    card.append(thumb, caption);
    card.addEventListener('click', () => {
      if (starting) return;
      sound?.(); select(stage); confirm.focus({ preventScroll: true });
      if (window.matchMedia('(max-width:680px)').matches) {
        $('#stage-detail').scrollIntoView?.({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
      }
    });
    cards.set(stage.id, card);
    grid.append(card);
  }
  configureSelection('stage', [...categories.entries()]);
  select(picked);
  confirm.onclick = async () => {
    if (starting) return;
    starting = true; confirm.disabled = true;
    confirm.textContent = '舞台を準備しています…';
    $('#select-layout').setAttribute('aria-busy', 'true');
    sound?.();
    try { await onConfirm(picked); }
    catch {
      starting = false; select(picked);
      $('#stage-note').textContent = '開始できませんでした。もう一度お試しください。';
    } finally { $('#select-layout').removeAttribute('aria-busy'); }
  };
}

export function renderHubStatus(save, fighters, story, canUse) {
  $('#hub-greeting').textContent = (save.uname || '旅人') + 'の旅の記録';
  const completed = Math.min(story.length, Math.max(0, save.chapter || 0));
  $('#hub-progress').textContent = '踏破 ' + completed + ' / ' + story.length + ' 章';
  const progress = $('#hub-progress-bar');
  progress.max = story.length; progress.value = completed;
  progress.setAttribute('aria-valuetext', completed + '章を踏破。全' + story.length + '章');
  const selected = (save.party || []).filter((id) => fighters[id] && canUse(id)).slice(0, 4);
  if (!selected.length && fighters.rowen) selected.push('rowen');
  const party = $('#hub-party');
  party.replaceChildren(...selected.map((id) => {
    const item = make('span', 'hub-ally');
    const img = make('img'); img.src = fighters[id].face; img.alt = ''; img.decoding = 'async';
    item.append(img, make('span', '', fighters[id].name)); return item;
  }));
}

export function filterForge() {
  const term = norm($('#forge-search').value).trim();
  let count = 0;
  for (const chip of $('#forge-list').children) {
    chip.hidden = !norm(chip.dataset.search || chip.textContent).includes(term);
    if (!chip.hidden) count++;
  }
  $('#forge-count').textContent = count + ' 人';
  $('#forge-empty').hidden = count !== 0;
}

function keepFocus(event, box) {
  if (event.key !== 'Tab') return;
  const items = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')]
    .filter((node) => !node.closest('[hidden]'));
  const first = items[0], last = items.at(-1);
  if (!first) { event.preventDefault(); box.focus(); }
  else if (event.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
}

const activeDialogs = [];
const dialogLocks = new WeakMap();

export function activateUiDialog(overlay, box, label, cancel) {
  const previous = document.activeElement, ui = $('#ui');
  const entry = { overlay, box };
  activeDialogs.push(entry);
  if (ui) {
    const lock = dialogLocks.get(ui) || { count: 0, inert: ui.inert };
    lock.count++;
    dialogLocks.set(ui, lock);
    ui.inert = true;
  }
  let closed = false;
  overlay.classList.add('ui-overlay'); box.classList.add('ui-dialog');
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', label); box.tabIndex = -1;
  overlay.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (activeDialogs.at(-1) !== entry || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    else keepFocus(event, box);
  });
  overlay.addEventListener('keyup', (event) => event.stopPropagation());
  queueMicrotask(() => {
    if (!closed && activeDialogs.at(-1) === entry && box.isConnected) (box.querySelector('input:not([disabled]),button:not([disabled]),select:not([disabled])') || box).focus();
  });
  return () => {
    if (closed) return;
    const wasTop = activeDialogs.at(-1) === entry;
    closed = true;
    activeDialogs.splice(activeDialogs.indexOf(entry), 1);
    overlay.remove();
    if (ui) {
      const lock = dialogLocks.get(ui);
      if (lock && --lock.count === 0) { ui.inert = lock.inert; dialogLocks.delete(ui); }
    }
    if (!wasTop) return;
    const current = activeDialogs.at(-1)?.box;
    if (previous?.isConnected && !previous.closest('[hidden],[inert]') && (!current || current.contains(previous))) previous.focus({ preventScroll: true });
    else if (current) (current.querySelector('input:not([disabled]),button:not([disabled]),select:not([disabled])') || current).focus({ preventScroll: true });
  };
}

export function installUiShell() {
  $('#forge-search').oninput = filterForge;
  $('#pause').addEventListener('keydown', (event) => keepFocus(event, $('#pause')));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229 || document.querySelector('dialog[open],.ui-overlay')) return;
    const chat = $('#chat-panel');
    if (chat && !chat.hidden) {
      event.preventDefault(); event.stopPropagation();
      $('#chat-btn').click(); $('#chat-btn').focus();
    }
  }, true);
}
