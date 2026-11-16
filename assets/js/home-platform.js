(() => {
  'use strict';
  const root = document.querySelector('[data-home-platform]');
  if (!root) return;
  const all = (selector, scope = root) => [...scope.querySelectorAll(selector)];
  const pressed = (selector, active) => all(selector).forEach(button => button.setAttribute('aria-pressed', String(button === active)));
  const tabs = all('[data-hp-tab]');
  function selectTab(tab, focus = false) {
    tabs.forEach(button => {
      const active = button === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      root.querySelector(`#${button.getAttribute('aria-controls')}`).hidden = !active;
    });
    if (focus) tab.focus({preventScroll:true});
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      const rtl = document.documentElement.dir === 'rtl';
      let next;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (event.key === 'ArrowRight') next = (index + (rtl ? -1 : 1) + tabs.length) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + (rtl ? 1 : -1) + tabs.length) % tabs.length;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });
  all('[data-hp-zone]').forEach(button => button.addEventListener('click', () => {
    pressed('[data-hp-zone]', button);
    const marker = root.querySelector('.hp-skin-preview [data-hp-zone-marker]');
    marker.setAttribute('cx', button.dataset.hpX);
    marker.setAttribute('cy', button.dataset.hpY);
    root.querySelector('[data-hp-zone-name]').textContent = button.textContent;
    root.querySelector('[data-hp-zone-context]').textContent = button.dataset.hpContext;
  }));
  const look = root.querySelector('.hp-look-preview');
  all('[data-hp-mode]').forEach(button => button.addEventListener('click', () => {
    pressed('[data-hp-mode]', button); look.dataset.lookMode = button.dataset.hpMode;
  }));
  all('[data-hp-shade]').forEach(button => button.addEventListener('click', () => {
    pressed('[data-hp-shade]', button); look.dataset.lookShade = button.dataset.hpShade;
  }));
  root.querySelector('[data-hp-compare]').addEventListener('input', event => {
    const x = 286 * Number(event.target.value) / 100;
    root.querySelector('[data-hp-clip]').setAttribute('x', String(x));
    const line = root.querySelector('[data-hp-compare-line]');
    line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x));
  });
  all('[data-hp-category]').forEach(button => button.addEventListener('click', () => {
    pressed('[data-hp-category]', button);
    const template = root.querySelector(`[data-hp-category-template="${button.dataset.hpCategory}"]`);
    root.querySelector('[data-hp-discovery-result]').replaceChildren(template.content.cloneNode(true));
  }));
  const count = () => {
    const active = root.querySelector('[data-hp-routine]:not([hidden])');
    root.querySelector('[data-hp-routine-count]').textContent = active.querySelectorAll('input:checked').length;
  };
  all('[data-hp-period]').forEach(button => button.addEventListener('click', () => {
    pressed('[data-hp-period]', button);
    all('[data-hp-routine]').forEach(list => { list.hidden = list.dataset.hpRoutine !== button.dataset.hpPeriod; });
    count();
  }));
  all('[data-hp-step]').forEach(input => input.addEventListener('change', count));
  all('[data-hp-consult]').forEach(button => button.addEventListener('click', () => {
    pressed('[data-hp-consult]', button);
    root.querySelector('[data-hp-consult-description]').textContent = button.dataset.hpDescription;
  }));
})();
