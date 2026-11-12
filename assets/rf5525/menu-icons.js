(() => {
  const controls = 'button, a[href], summary, [role="button"], [role="tab"]';
  const menus = [
    '#ui .screen', '#pause', '#world-panel', '#world-req', '#btn-world', '#btn-pause',
    '#chat-btn', '#chat-panel', '#rift-utility', '#rift-floating-back', '#rf557-mobile-nav',
    '#gaizorg-adventure-ui', '#rf552-infinite-board', '#arkeia-stage-loading', '#arkeia-model-error',
    '#net-fail-note', '#rf-battle-v9-error',
    '#rf-chief-character-editor', '#rf-ce-battle-slots', '#rf45-layout-editor',
    '.rf552-choice-backdrop', '.rf53-modal', '.rf53-picker', '.rift-gift-dialog',
    'dialog', '[role="dialog"]', '[role="alertdialog"]'
  ].join(',');
  const byId = new Map(Object.entries({
    'btn-chief-character-editor':'edit', 'rf53-library-open':'star',
    'rf53-favorite-manager':'star', 'rf558-model-refresh':'sync',
    'opt-mute':'sound', 'opt-diff':'settings', 'rf45-edit-layout':'gamepad',
    'rf45-reset-layout':'sync', 'chief-issue':'dispatch', 'chief-mail-center':'dispatch',
    'sync-push':'sync', 'sync-pull':'sync', 'btn-world':'coop', 'chat-btn':'chat',
    'btn-join':'duel', 'ranked-choose':'profile', 'ranked-join':'search',
    'ranked-sync':'sync', 'ranked-refresh':'sync', 'ranked-back':'back',
    'ranked-retry':'sync', 'ranked-cancel':'close', 'ranked-leave':'close',
    'btn-retry':'sync', 'btn-next':'next', 'btn-resume':'sword', 'btn-quit':'back',
    'btn-pause':'settings', 'story-back':'back', 'story-skip':'next',
    'world-close':'close', 'world-req-yes':'check', 'world-req-no':'close',
    'rift-floating-back':'back'
  }));
  const phone = new Map([['トップ','start'], ['モード','sword'], ['旅支度','settings'], ['攻城戦','castle']]);
  const utility = new Map([['gift','mail'], ['search','search'], ['density','guide'], ['theme','settings'], ['top','start']]);
  const meanings = [
    [/閉じる|キャンセル|取り消|退出|退室|断る|削除|リタイア|解除|中止|^×$|^✕$/u, 'close'],
    [/戻る|分かれ道|前へ|前の/u, 'back'],
    [/次へ|先へ|進む|続き|飛ばす/u, 'next'],
    [/お気に入り|人気|^☆$|^★$/u, 'star'],
    [/検索|探す|絞り込/u, 'search'],
    [/音量|音楽|ミュート|BGM|音を|鳴らす|効果音/u, 'sound'],
    [/チャット|会話|掲示板|メッセージ|発言/u, 'chat'],
    [/メール|受信|贈り物|プレゼント|通知|受取|受け取/u, 'mail'],
    [/発行|招待|配信|送信/u, 'dispatch'],
    [/同期|再読み込|再挑戦|再試行|更新|復元|初期化|読み直|リセット/u, 'sync'],
    [/操作|ボタン配置|ゲームパッド/u, 'gamepad'],
    [/設定|画質|表示|色変更|確認事項/u, 'settings'],
    [/ガイド|ルール|説明|遊び方|操作表/u, 'guide'],
    [/防衛|攻城|築城|拠点|領国/u, 'castle'],
    [/無限天守/u, 'tower'],
    [/ランク|順位|戦績|記録/u, 'trophy'],
    [/アドベンチャー|探索|旅立/u, 'adventure'],
    [/イベント|催し/u, 'event'],
    [/協力|共闘|仲間|フレンド|ギルド/u, 'coop'],
    [/戦士|キャラクター|プロフィール|ニックネーム|認証|鍵を/u, 'profile'],
    [/鍛錬|強化|限界突破|工房|装備/u, 'forge'],
    [/購入|商店|灯晶/u, 'shop'],
    [/編集|追加|作成|公開|変更/u, 'edit'],
    [/選択|決定|保存|承認|受ける|適用|有効|^はい$/u, 'check'],
    [/対戦|出撃|決闘|戦闘|攻撃/u, 'duel'],
    [/地図|舞台|マップ/u, 'map'],
    [/物語|章|旅路/u, 'story'],
    [/始める|開始|トップ|メニュー/u, 'start'],
    [/ヘルプ|質問/u, 'help']
  ];
  const managed = new WeakSet();
  const observers = new Map();

  function kindOf(element) {
    const label = (element.getAttribute('aria-label') || element.textContent || '').trim();
    if (element.matches('.rf53-star,.rift-card-favorite,.rf53-starbtn')) return 'star';
    if (element.matches('#rf557-mobile-nav button')) return phone.get(label) || 'start';
    if (element.dataset.rf561Theme) return element.dataset.rf561Theme === 'japanese' ? 'tower' : 'castle';
    if (element.id === 'btn-pause' && label === '退出') return 'close';
    if (element.classList.contains('rf51-close')) return 'close';
    if (element.classList.contains('back') && element.id !== 'story-skip') return 'back';
    return byId.get(element.id) || utility.get(element.dataset.uiAct) ||
      meanings.find(([pattern]) => pattern.test(label))?.[1] || 'guide';
  }

  function decorate(element) {
    if (element.matches('#story-box,.brand-button') || element.querySelector(':scope > .rf25-image-icon')) return;
    const legacy = element.querySelector(':scope > .service-icon, :scope > .mode-icon');
    if (legacy) {
      legacy.classList.add('rf25-image-icon');
      legacy.dataset.rf25Icon = kindOf(element);
      legacy.setAttribute('aria-hidden', 'true');
      return;
    }
    if (element.matches('.mode-tile') || element.querySelector('img,.sthumb')) {
      if (managed.has(element)) delete element.dataset.rf25Icon;
      return;
    }
    if (element.dataset.rf25Icon && !managed.has(element)) return;
    if (element.matches('#rift-floating-back,#chat-btn,#rift-utility button')) {
      const first = element.firstChild;
      if (first?.nodeType === Node.TEXT_NODE) {
        const label = first.data.replace(/^\s*(?:🎁|⌕|▦|✦|↑|‹|💬)\s*/u, '');
        if (label !== first.data) first.data = label;
      }
    }
    const icon = kindOf(element);
    if (element.dataset.rf25Icon !== icon) element.dataset.rf25Icon = icon;
    managed.add(element);
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(controls)) decorate(root);
    root.querySelectorAll(controls).forEach(decorate);
  }

  function watch(root) {
    if (observers.has(root)) return;
    scan(root);
    const observer = new MutationObserver(records => {
      for (const {target,addedNodes} of records) {
        const control = target.closest(controls);
        if (control && root.contains(control)) decorate(control);
        for (const node of addedNodes) scan(node);
      }
    });
    observer.observe(root,{childList:true,subtree:true});
    observers.set(root,observer);
  }

  function observeOverlay(node) {
    if (!(node instanceof Element) || node.id === 'ui') return;
    if (node.matches(menus) || node.querySelector(menus) || node.querySelector('button.btn')) watch(node);
  }

  for (const root of document.querySelectorAll('#ui .screen,#pause,#world-panel,#world-req,#btn-world,#btn-pause')) watch(root);
  for (const node of document.body.children) observeOverlay(node);
  const overlays = new MutationObserver(records => {
    for (const {addedNodes,removedNodes} of records) {
      for (const node of removedNodes) {
        observers.get(node)?.disconnect();
        observers.delete(node);
      }
      for (const node of addedNodes) observeOverlay(node);
    }
  });
  overlays.observe(document.body,{childList:true});
})();
