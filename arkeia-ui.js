/* 双月のアルケイア — 操作の実在するメニューだけを表示する */
(() => {
  function jumpTo(id) {
    const section = document.getElementById(id);
    if (!section) return;
    const scroller = document.getElementById('scr-title');
    if (scroller && scroller.classList.contains('on')) {
      scroller.scrollTo({ top: section.offsetTop - 74, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-portal-jump]');
    if (button) jumpTo(button.dataset.portalJump);
  });
  // 外部の3Dライブラリ取得に失敗した場合、開始画面が無反応にならないよう回復手段を提供。
  const bootStatus = document.getElementById('loading');
  const bootRetry = () => {
    if (window.__arkeiaBootOk || !bootStatus || document.getElementById('arkeia-boot-retry')) return;
    bootStatus.textContent = '起動を確認できません。通信状況をご確認ください。';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.id = 'arkeia-boot-retry';
    retry.className = 'back';
    retry.textContent = '再読み込み';
    retry.addEventListener('click', (e) => { e.stopPropagation(); location.reload(); });
    bootStatus.insertAdjacentElement('afterend', retry);
  };
  setTimeout(bootRetry, 12000);
  window.addEventListener('arkeia-boot-ready', () => {
    document.getElementById('arkeia-boot-retry')?.remove();
  });
  const input = document.getElementById('select-search');
  const grid = document.getElementById('select-grid');
  const count = document.getElementById('select-counter');
  const empty = document.getElementById('select-empty');
  if (input && grid && count && empty) {
    let queued = false;
    const filter = () => {
      queued = false;
      const q = input.value.trim().normalize('NFKC').toLocaleLowerCase('ja');
      const cards = Array.from(grid.querySelectorAll('button.card'));
      let shown = 0;
      for (const card of cards) {
        const text = (card.dataset.search || card.textContent || '').normalize('NFKC').toLocaleLowerCase('ja');
        card.hidden = !!q && !text.includes(q);
        shown += !card.hidden ? 1 : 0;
      }
      count.textContent = `${shown} / ${cards.length} 件`;
      empty.hidden = shown > 0 || cards.length === 0;
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(filter);
    };
    input.addEventListener('input', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(grid, { childList: true, subtree: false });
    document.getElementById('select-back')?.addEventListener('click', () => { input.value = ''; });
    schedule();
  }
})();
