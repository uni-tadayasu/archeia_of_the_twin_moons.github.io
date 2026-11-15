/* UI conveniences for the original game. All actions use its existing controls. */
(() => {
  'use strict';
  const start = () => {
    const menu = document.getElementById('scr-title');
    if (!menu || document.getElementById('classic-quick-access')) return;
    document.body.classList.add('classic-polish');
    const choices = [
      { id: 'story', name: '物語', hint: '仲間と旅立つ', selector: '.portal-modes [data-go="story"]', glyph: '旅' },
      { id: 'cpu', name: 'ひとりで対戦', hint: '好きな戦士と舞台', selector: '.portal-modes [data-go="cpu"]', glyph: '剣' },
      { id: 'infinite', name: '無限天守', hint: '果てなき挑戦へ', selector: '.portal-modes [data-go="infinite"]', glyph: '城' },
      { id: 'adventure', name: 'アドベンチャー', hint: '十の試練を巡る', selector: '#btn-adventure-mode', glyph: '道' },
      { id: 'castle', name: '双月領国・拠点', hint: '築城と攻城戦', selector: '#btn-castle', glyph: '領' },
      { id: 'options', name: '旅支度・設定', hint: '音量・操作・同期', selector: '#btn-options', glyph: '灯' }
    ];
    const preferenceKey = 'arkeia.classic.last-menu.v1';
    const quick = document.createElement('section');
    quick.id = 'classic-quick-access';
    quick.className = 'classic-quick-access remake-contained';
    quick.setAttribute('aria-labelledby', 'classic-quick-title');
    const heading = document.createElement('div');
    heading.className = 'classic-quick-heading';
    heading.innerHTML = '<div><p>QUICK ACCESS</p><h2 id="classic-quick-title">次の冒険へ、すぐに。</h2></div>';
    const recent = document.createElement('button');
    recent.type = 'button';
    recent.className = 'classic-recent';
    recent.hidden = true;
    heading.append(recent);
    const grid = document.createElement('nav');
    grid.className = 'classic-quick-grid';
    grid.setAttribute('aria-label', 'よく使う出撃先と設定');
    let last = '';
    try { last = localStorage.getItem(preferenceKey) || ''; } catch { /* Optional preference. */ }
    function activate(choice) {
      const target = menu.querySelector(choice.selector);
      if (target && !target.disabled) target.click();
    }
    function updateRecent() {
      const choice = choices.find(item => item.id === last);
      recent.hidden = !choice;
      if (!choice) return;
      recent.textContent = `前回選んだ入口：${choice.name} ↗`;
      recent.onclick = () => activate(choice);
    }
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'classic-quick-button';
      button.innerHTML = `<span class="classic-quick-glyph" aria-hidden="true">${choice.glyph}</span><span><b>${choice.name}</b><small>${choice.hint}</small></span><i aria-hidden="true">↗</i>`;
      button.addEventListener('click', () => activate(choice));
      grid.append(button);
    }
    quick.append(heading, grid);
    const hero = menu.querySelector('.portal-hero');
    if (hero) hero.insertAdjacentElement('afterend', quick);
    else menu.querySelector('.portal-wrap')?.prepend(quick);

    // Keep the existing social controls and their handlers. They belong in the
    // menu flow here, but return to their original positions for every other view.
    const community = document.createElement('section');
    community.className = 'classic-community-bar remake-contained';
    community.setAttribute('aria-label', 'お知らせと交流');
    community.hidden = true;
    const communityLabel = document.createElement('span');
    communityLabel.className = 'classic-community-label';
    communityLabel.textContent = '旅人の広場';
    community.append(communityLabel);
    quick.insertAdjacentElement('afterend', community);
    const socialSlots = new Map();
    const enhancedChatButtons = new WeakSet();
    const syncCommunity = () => {
      const docked = menu.classList.contains('on');
      for (const id of ['ticker', 'chat-btn']) {
        const node = document.getElementById(id);
        const slot = socialSlots.get(id);
        if (docked && node && node.parentElement !== community) {
          slot?.marker.remove();
          const marker = document.createComment(`classic original ${id}`);
          node.before(marker);
          socialSlots.set(id, { node, marker });
          community.append(node);
        } else if (!docked && slot) {
          if (slot.node.isConnected && slot.node.parentElement === community) {
            if (slot.marker.isConnected) slot.marker.replaceWith(slot.node);
            else document.body.append(slot.node);
          } else slot.marker.remove();
          socialSlots.delete(id);
        }
      }
      community.hidden = !docked || !community.querySelector('#ticker, #chat-btn');
      const chat = document.getElementById('chat-panel');
      const trigger = document.getElementById('chat-btn');
      if (chat && trigger && !enhancedChatButtons.has(trigger)) {
        enhancedChatButtons.add(trigger);
        trigger.setAttribute('aria-controls', 'chat-panel');
        let close = chat.querySelector('#classic-chat-close');
        if (!close) {
          const heading = document.createElement('div');
          heading.className = 'classic-chat-heading';
          const title = document.createElement('strong');
          title.textContent = '旅人のチャット';
          close = document.createElement('button');
          close.id = 'classic-chat-close';
          close.type = 'button';
          close.className = 'classic-chat-close';
          close.textContent = '閉じる ×';
          close.setAttribute('aria-label', 'チャットを閉じる');
          close.addEventListener('click', () => {
            if (!chat.hidden) document.getElementById('chat-btn')?.click();
          });
          heading.append(title, close);
          chat.prepend(heading);
        }
        trigger.addEventListener('click', () => {
          if (!chat.hidden) close.focus({ preventScroll: true });
          else if (trigger.getClientRects().length) trigger.focus({ preventScroll: true });
        });
      }
    };
    new MutationObserver(syncCommunity).observe(menu, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(syncCommunity).observe(document.body, { childList: true });
    syncCommunity();

    menu.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      const choice = choices.find(item => button.matches(item.selector));
      if (!choice) return;
      last = choice.id;
      try { localStorage.setItem(preferenceKey, last); } catch { /* Gameplay remains available. */ }
      updateRecent();
    });
    updateRecent();

    const toolbar = menu.querySelector('.mode-toolbar');
    const cards = [...menu.querySelectorAll('.remake-mode[data-mode-type]')];
    if (toolbar && cards.length) {
      const search = document.createElement('div');
      search.className = 'classic-mode-search';
      const label = document.createElement('label');
      label.htmlFor = 'classic-mode-search';
      label.textContent = '遊びたいモードを探す';
      const input = document.createElement('input');
      input.id = 'classic-mode-search';
      input.type = 'search';
      input.autocomplete = 'off';
      input.placeholder = '例：物語、対戦、協力、天守';
      const modeList = menu.querySelector('.portal-modes');
      if (modeList) {
        if (!modeList.id) modeList.id = 'classic-mode-list';
        input.setAttribute('aria-controls', modeList.id);
      }
      const output = document.createElement('span');
      output.id = 'classic-mode-results';
      output.setAttribute('role', 'status');
      output.setAttribute('aria-live', 'polite');
      search.append(label, input, output);
      toolbar.insertAdjacentElement('afterend', search);
      const empty = document.createElement('p');
      empty.className = 'classic-mode-empty';
      empty.textContent = '一致するモードがありません。検索文字や「ひとりで／オンライン」の絞り込みを変えてください。';
      empty.hidden = true;
      menu.querySelector('.portal-modes')?.insertAdjacentElement('afterend', empty);
      const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja');
      const applySearch = () => {
        const query = normalize(input.value.trim());
        const category = menu.querySelector('[data-mode-filter][aria-pressed="true"]')?.dataset.modeFilter || 'all';
        let count = 0;
        for (const card of cards) {
          const categoryMatch = category === 'all' || card.dataset.modeType.split(/\s+/).includes(category);
          card.hidden = !categoryMatch || (Boolean(query) && !normalize(card.textContent).includes(query));
          if (!card.hidden) count++;
        }
        output.textContent = `${count} / ${cards.length} モード`;
        empty.hidden = count > 0;
      };
      input.addEventListener('input', applySearch);
      input.addEventListener('keydown', event => {
        if (event.key === 'Escape' && input.value) {
          event.stopPropagation(); input.value = ''; applySearch();
        }
      });
      menu.querySelectorAll('[data-mode-filter]').forEach(button => button.addEventListener('click', () => queueMicrotask(applySearch)));
      applySearch();
    }

    const pause = document.getElementById('pause');
    if (pause) {
      const guide = document.createElement('details');
      guide.className = 'classic-control-guide';
      guide.innerHTML = '<summary>戦いの操作を確認する</summary><div class="classic-control-keys"><span><kbd>WASD / 矢印</kbd><b>移動</b></span><span><kbd>J / 左クリック</kbd><b>通常攻撃</b></span><span><kbd>K / 右クリック</kbd><b>技A</b></span><span><kbd>U</kbd><b>技B</b></span><span><kbd>L</kbd><b>奥義</b></span><span><kbd>H</kbd><b>回復</b></span><span><kbd>Shift</kbd><b>防御</b></span><span><kbd>Space</kbd><b>ジャンプ</b></span></div><p>スマートフォンは左スティックで移動し、右側のアクションボタンで戦います。技は立ち止まった時と移動中で変化します。</p>';
      pause.querySelector('.menu')?.insertAdjacentElement('beforebegin', guide);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
