/* Celestial edition: presentation and menu conveniences for the original game.
 * Existing nodes, labels, events, permissions, saves and combat remain authoritative. */
(() => {
  'use strict';
  const ART = Object.freeze({
    story: 'assets/rf555/mode-story.webp', story2: 'assets/rf562/japanese-corridor.webp',
    infinite: 'assets/rf555/mode-endless.webp', ranked: 'assets/rf562/western-cathedral.webp',
    cpu: 'assets/rf555/mode-duel.webp', duo: 'assets/rf555/mode-coop.webp',
    'online-vs': 'assets/rf562/ruins-moonlit.webp', 'online-coop': 'assets/rf562/cave-crystals.webp',
    event: 'assets/rf555/mode-event.webp', adventure: 'assets/celestial/cavern.webp',
    castle: 'assets/rf555/mode-castle.webp', forge: 'assets/rf562/cave-embers.webp',
    shop: 'assets/rf562/cave-crystals.webp', mail: 'assets/rf562/japanese-corridor.webp',
    settings: 'assets/rf562/japanese-palace.webp', records: 'assets/rf562/western-throne.webp'
  });
  const MODE_ICONS = Object.freeze({ story:'story', story2:'scroll', infinite:'tower', ranked:'crown', cpu:'training', duo:'allies', 'online-vs':'duel', 'online-coop':'coop', event:'event', adventure:'compass' });
  const ID_ICONS = Object.freeze({
    'press-start':'journey', 'btn-ranked':'crown', 'btn-adventure-mode':'compass', 'rf552-infinite-rank':'trophy',
    'btn-castle':'castle', 'btn-forge':'forge', 'btn-shop':'shop', 'btn-mailbox':'mail', 'btn-options':'settings',
    'btn-chief-mail':'crown', 'btn-evmaker':'event', 'btn-invade':'swords', 'btn-chief-character-editor':'user',
    'rf53-library-open':'star', 'rf53-favorite-manager':'star', 'rf558-model-refresh':'refresh',
    'opt-mute':'sound', 'opt-diff':'training', 'rf45-edit-layout':'controls', 'rf45-reset-layout':'refresh',
    'chief-issue':'key', 'chief-mail-center':'mail', 'sync-push':'upload', 'sync-pull':'download',
    'btn-world':'allies', 'chat-btn':'chat', 'btn-join':'flame', 'ranked-choose':'user', 'ranked-join':'search',
    'ranked-sync':'save', 'ranked-refresh':'refresh', 'ranked-back':'back', 'ranked-retry':'retry',
    'ranked-cancel':'close', 'ranked-leave':'back', 'btn-retry':'retry', 'btn-next':'forward',
    'btn-resume':'play', 'btn-quit':'back', 'btn-pause':'pause', 'story-back':'back', 'story-skip':'forward',
    'world-close':'close', 'world-req-yes':'check', 'world-req-no':'close', 'rift-floating-back':'back',
    'select-back':'back', 'result-back':'back', 'party-go':'journey', 'party-nohero':'user',
    'party-picker-close':'close', 'classic-chat-close':'close', 'castle-back':'back'
  });
  const LEGACY = Object.freeze({start:'journey',adventure:'compass',sword:'sword',edit:'settings',profile:'user',dispatch:'mail',sync:'refresh',next:'forward',guide:'help'});
  const ACTIONS = Object.freeze({attack:'sword',skill:'skill',skill2:'skill2',over:'ultimate',guard:'shield',jump:'jump',heal:'heal'});
  const MEANINGS = [
    [/閉じる|取消|取り消|キャンセル|断る|削除|外す|解除|中止|^×$|^✕$/u,'close'],
    [/戻る|分かれ道|前の|退出|退室/u,'back'],[/次へ|先へ|進む|続き|飛ばす/u,'forward'],
    [/お気に入り|^☆$|^★$/u,'star'],[/検索|探す|絞り込/u,'search'],[/保存|セーブ/u,'save'],
    [/音楽|BGM/u,'music'],[/ボイス|声/u,'voice'],[/音量|ミュート|鳴らす|効果音|音：/u,'sound'],
    [/チャット|会話|掲示板|メッセージ|発言/u,'chat'],[/メール|受信|通知/u,'mail'],
    [/贈り物|プレゼント|受取|受け取/u,'gift'],[/発行|認証|鍵/u,'key'],
    [/同期|再読み込|再試行|更新|復元|初期化|読み直|リセット/u,'refresh'],[/再挑戦|もう一度/u,'retry'],
    [/操作|ボタン配置|ゲームパッド/u,'gamepad'],[/色変更|色合い|テーマ/u,'palette'],
    [/設定|画質|表示|変更|編集|作成/u,'settings'],[/ガイド|ルール|説明|遊び方|ヘルプ/u,'help'],
    [/防衛|攻城|築城|拠点|領国/u,'castle'],[/無限天守/u,'tower'],[/ランク|順位|戦績|記録/u,'trophy'],
    [/アドベンチャー|探索|旅立/u,'compass'],[/イベント|催し/u,'event'],[/協力|共闘|仲間|フレンド/u,'allies'],
    [/戦士|キャラクター|プロフィール|ニックネーム|呼び名/u,'user'],[/鍛錬|強化|限界突破|工房/u,'forge'],
    [/購入|商店|売却/u,'shop'],[/灯晶|コイン/u,'crystal'],[/装備|剣|斬|攻撃/u,'sword'],
    [/選択|決定|承認|受ける|適用|有効|^はい$/u,'check'],[/対戦|出撃|決闘|戦闘/u,'duel'],
    [/地図|舞台|マップ|世界/u,'map'],[/物語|章|旅路/u,'story'],[/始める|開始|トップ|メニュー/u,'journey'],
    [/最近|履歴/u,'clock'],[/すべて/u,'filter'],[/休|停止/u,'pause']
  ];
  const CONTROL = 'button,a[href],summary,[role="button"],[role="tab"]';
  const SKIP = '.brand-button,#story-box,.celestial-icon,.celestial-settings-nav';
  const LABELS = '.rf25-settings-group h2,.rf556-setting > label,.audio-volume-control > span,.classic-mode-search > label,.select-search-label';
  const start = () => {
    if (!document.getElementById('scr-title') || !window.ArcheiaIcons || document.body.classList.contains('celestial-ui')) return;
    document.body.classList.add('celestial-ui');
    const createIcon = name => window.ArcheiaIcons.create(name);
    const iconName = el => {
      if (el.dataset.act && ACTIONS[el.dataset.act]) return ACTIONS[el.dataset.act];
      if (ID_ICONS[el.id]) return ID_ICONS[el.id];
      if (el.classList.contains('back')) return 'back';
      if (el.dataset.go && MODE_ICONS[el.dataset.go]) return MODE_ICONS[el.dataset.go];
      if (el.dataset.view) return el.dataset.view === 'auto' ? 'camera' : el.dataset.view === 'left' ? 'back' : 'forward';
      if (el.dataset.modeFilter) return el.dataset.modeFilter === 'multi' ? 'network' : el.dataset.modeFilter === 'solo' ? 'user' : 'filter';
      if (el.dataset.portalJump) return ({'portal-play':'swords','portal-world':'map','portal-services':'settings'})[el.dataset.portalJump] || 'compass';
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
      const meaning = MEANINGS.find(([pattern]) => pattern.test(label));
      if (meaning) return meaning[1];
      const old = el.dataset.rf25Icon;
      if (old) return LEGACY[old] || old;
      return el.matches('a') ? 'external' : 'check';
    };
    function decorate(el, name, holder = el) {
      if (!el || el.matches(SKIP) || el.closest('svg')) return;
      const existing = holder.querySelector(':scope > .celestial-icon');
      name ||= iconName(el);
      if (existing?.dataset.celestialIcon === name) { el.dataset.celestialIcon = name; return; }
      existing?.remove();
      const icon = createIcon(name);
      if (!icon) return;
      holder.prepend(icon);
      el.dataset.celestialIcon = name;
      el.classList.add('celestial-has-icon');
    }
    function artwork(el, key, imageClass = 'celestial-service-art') {
      const src = ART[key];
      if (!el || !src || el.dataset.celestialArt === key) return;
      el.dataset.celestialArt = key;
      let img = el.querySelector(':scope > .' + imageClass);
      if (!img) {
        img = document.createElement('img');
        img.className = imageClass;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 640;
        img.height = 360;
        el.prepend(img);
      }
      img.src = src;
    }
    function enhanceControl(el) {
      if (el.matches(SKIP) || el.closest('svg')) return;
      // Legacy utilities prefix labels with pictographs. Keep the Japanese text
      // while replacing only those decorative marks with the original SVGs.
      if (el.matches('#rift-utility button,#chat-btn,#rift-floating-back')) {
        for (const node of el.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue;
          const clean = node.data.replace(/^\s*(?:🎁|⌕|▦|✦|↑|‹|💬)\s*/u, '');
          if (clean !== node.data) node.data = clean;
        }
      }
      if (el.matches('.remake-mode')) {
        const key = el.dataset.go || (el.id === 'btn-ranked' ? 'ranked' : 'adventure');
        el.dataset.celestialArt = key;
        const img = el.querySelector('.mode-art img');
        if (img && ART[key] && !img.dataset.celestialImage) { img.src = ART[key]; img.dataset.celestialImage = key; }
        const top = el.querySelector('.mode-topline > span');
        if (top) decorate(el, MODE_ICONS[key], top);
      } else if (el.matches('.classic-quick-button')) {
        const index = [...el.parentElement.children].indexOf(el);
        const keys = ['story','cpu','infinite','adventure','castle','settings'];
        const key = keys[index];
        const glyph = el.querySelector('.classic-quick-glyph');
        if (glyph && !glyph.querySelector('.celestial-icon')) { glyph.textContent = ''; decorate(el, MODE_ICONS[key] || key, glyph); }
        artwork(el, key, 'celestial-quick-art');
      } else if (el.matches('.portal-services > button')) {
        const key = ({'rf552-infinite-rank':'records','btn-castle':'castle','btn-forge':'forge','btn-shop':'shop','btn-mailbox':'mail','btn-options':'settings','btn-chief-mail':'mail','btn-evmaker':'event','btn-invade':'ranked','btn-chief-character-editor':'settings','rf53-library-open':'records'})[el.id]
          || ({forge:'forge',shop:'shop',crystal:'shop',mail:'mail',gift:'mail',castle:'castle',tower:'infinite',trophy:'records',star:'records',user:'records',event:'event',compass:'adventure'})[iconName(el)]
          || 'settings';
        artwork(el, key);
        const holder = el.querySelector('.service-number') || el;
        if (holder !== el && !holder.querySelector('.celestial-icon')) holder.textContent = '';
        decorate(el, ID_ICONS[el.id], holder);
      } else if (el.matches('.card,.party-picker-choice,.rf53-card') || el.querySelector(':scope > img.face')) {
        const title = el.querySelector('b,strong');
        if (!title) decorate(el);
        else decorate(el, el.classList.contains('locked') || el.disabled ? 'lock' : el.matches('.stage-tile') ? 'map' : 'user', title);
      } else {
        decorate(el);
      }
    }
    function enhanceFragment(root) {
      if (!(root instanceof Element) || root.closest('svg')) return;
      if (root.matches(CONTROL)) enhanceControl(root);
      root.querySelectorAll(CONTROL).forEach(enhanceControl);
      if (root.matches(LABELS)) decorate(root, iconName(root));
      root.querySelectorAll(LABELS).forEach(el => decorate(el, iconName(el)));
      if (root.matches('.shards')) decorate(root, 'crystal');
      root.querySelectorAll('.shards').forEach(el => decorate(el, 'crystal'));
      root.querySelectorAll('.tile-arrow,.button-arrow,.classic-quick-button > i,.portal-services > button > i').forEach(el => {
        if (el.querySelector('.celestial-icon')) return;
        el.textContent = '';
        el.append(createIcon('forward'));
      });
    }
    enhanceFragment(document.body);
    // New screens, shop items, server-backed dialogs and changed button labels
    // receive the same icons. No attributes or per-frame game state are observed.
    const pending = new Set();
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      for (const node of pending) if (node.isConnected) enhanceFragment(node);
      pending.clear();
    };
    new MutationObserver(records => {
      for (const {target, addedNodes} of records) {
        if (target instanceof Element && target.closest('svg')) continue;
        const control = target instanceof Element ? target.closest(CONTROL) : target.parentElement?.closest(CONTROL);
        if (control) pending.add(control);
        if (target instanceof Element && target.matches(LABELS + ',.shards')) pending.add(target);
        for (const node of addedNodes) if (node instanceof Element && !node.matches('svg,.celestial-icon') && !node.closest('svg')) pending.add(node);
      }
      if (pending.size && !scheduled) { scheduled = true; requestAnimationFrame(flush); }
    }).observe(document.body, { childList:true, subtree:true });

    // A small local contents row makes long settings easy to navigate on phones.
    const options = document.getElementById('scr-options');
    const groups = [...options?.querySelectorAll('.rf25-settings-group') || []];
    if (groups.length && !options.querySelector('.celestial-settings-nav')) {
      const nav = document.createElement('nav');
      nav.className = 'celestial-settings-nav';
      nav.setAttribute('aria-label', '設定の項目へ移動');
      const names = ['音と音楽','表示と操作','運営の認証','記録の同期'];
      const icons = ['music','gamepad','key','save'];
      groups.forEach((group, i) => {
        const heading = group.querySelector('h2');
        if (!heading) return;
        group.classList.add('celestial-settings-section');
        group.dataset.celestialSection = icons[i] || 'settings';
        heading.tabIndex = -1;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.celestialSection = heading.id;
        button.append(createIcon(icons[i] || 'settings'), document.createTextNode(names[i] || heading.textContent));
        button.dataset.celestialIcon = icons[i] || 'settings';
        button.addEventListener('click', () => {
          heading.focus({preventScroll:true});
          group.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
        });
        nav.append(button);
      });
      options.querySelector('.label')?.insertAdjacentElement('afterend', nav);
    }
    const fillRange = input => {
      const min = Number(input.min || 0), max = Number(input.max || 100);
      const percentage = Math.min(100,Math.max(0,100 * (Number(input.value)-min)/(max-min || 1)));
      input.style.setProperty('--celestial-range', percentage + '%');
    };
    document.querySelectorAll('#scr-options input[type="range"]').forEach(fillRange);
    document.addEventListener('input', event => {
      if (event.target.matches('#scr-options input[type="range"]')) fillRange(event.target);
    });
    document.addEventListener('keydown', event => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      const screen = document.querySelector('.screen.on');
      const search = screen?.querySelector('#classic-mode-search,#select-search');
      if (!search) return;
      event.preventDefault();
      search.focus({preventScroll:true});
      search.scrollIntoView({block:'center',behavior:'smooth'});
    });
    window.ArcheiaCelestialUI = Object.freeze({
      version:'56.3', art:ART,
      audit() {
        const controls = [...document.querySelectorAll(CONTROL)].filter(el => !el.matches(SKIP) && !el.closest('svg'));
        return { controls:controls.length, decorated:controls.filter(el => el.dataset.celestialIcon).length,
          missing:controls.filter(el => !el.dataset.celestialIcon).map(el => el.id || el.textContent.trim().slice(0,32)),
          modes:document.querySelectorAll('.remake-mode[data-celestial-art]').length,
          services:document.querySelectorAll('.portal-services > button[data-celestial-art]').length,
          images:document.querySelectorAll('[data-celestial-art] img').length,
          iconNames:[...new Set([...document.querySelectorAll('[data-celestial-icon]')].map(el => el.dataset.celestialIcon))] };
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
