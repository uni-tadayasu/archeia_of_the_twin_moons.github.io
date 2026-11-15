/* The portal only controls presentation. Game navigation keeps its original handlers. */
(() => {
  'use strict';
  const root = document.querySelector('#scr-title');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-opening-jump]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.dataset.openingJump);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      target.focus({ preventScroll: true });
    });
  });
  const filters = [...document.querySelectorAll('[data-mode-filter]')];
  const modes = [...document.querySelectorAll('.remake-mode[data-mode-type]')];
  filters.forEach(button => button.addEventListener('click', () => {
    const filter = button.dataset.modeFilter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    modes.forEach(mode => { mode.hidden = filter !== 'all' && !mode.dataset.modeType.split(/\s+/).includes(filter); });
    const count = modes.filter(mode => !mode.hidden).length;
    const status = document.getElementById('mode-filter-status');
    if (status) status.textContent = `${count}件のモードを表示`;
  }));
  if (root && 'IntersectionObserver' in window) {
    const links = [...root.querySelectorAll('[data-portal-jump]')];
    const sections = links.map(link => document.getElementById(link.dataset.portalJump)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => {
        if (link.dataset.portalJump === visible.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { root, rootMargin: '-85px 0px -45% 0px', threshold: [0, 0.1, 0.3] });
    sections.forEach(section => observer.observe(section));
  }
})();
