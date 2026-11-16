(() => {
  'use strict';

  // One owner for document navigation, language handoff and layout anchoring.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const storageKey = 'nayvella-language-position';
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const instant = top => window.scrollTo({ top, left: 0, behavior: 'instant' });
  const headerHeight = () => document.querySelector('#site-header .header-inner')?.offsetHeight || 80;
  const visible = el => el.getClientRects().length > 0;
  const blocks = () => all('main [id], main section, main article, main details, main h1, main h2, main h3, main p, #site-footer');
  let customerState;
  let applyingState = false;
  let readingControl = null;
  document.addEventListener('focusin', event => {
    if (event.target.closest('main') && event.target.matches('summary, button, select, input')) readingControl = event.target;
  });
  window.nayvellaNavigation = {
    registerCustomerState(adapter) { customerState = adapter; }
  };

  function readingPosition() {
    const elements = blocks();
    const line = headerHeight() + 16;
    if (readingControl?.isConnected && visible(readingControl)) {
      const rect = readingControl.getBoundingClientRect();
      if (rect.top >= line && rect.bottom <= innerHeight) return { selector: pathOf(readingControl), offset: rect.top - line, top: window.scrollY };
    }
    const candidates = elements.filter(el => visible(el) && el.getBoundingClientRect().bottom > line);
    const el = candidates.reduce((best, el) => {
      const distance = Math.abs(el.getBoundingClientRect().top - line);
      return !best || distance < Math.abs(best.getBoundingClientRect().top - line) ? el : best;
    }, null);
    return { index: elements.indexOf(el), selector: el ? pathOf(el) : null, id: el?.id, offset: el ? el.getBoundingClientRect().top - line : 0, top: window.scrollY };
  }

  // Capture before any bubbling handler closes the mobile menu or changes layout.
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    if (link.id === 'lang-toggle') {
      const target = new URL(link.href, location.href);
      if (target.origin !== location.origin) return;
      const state = {
        target: target.pathname, time: Date.now(), position: readingPosition(),
        details: all('main details').map(el => el.open),
        tabs: all('[role="tab"][aria-selected="true"]').map(el => el.id).filter(Boolean),
        customer: customerState?.read()
      };
      try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Storage may be disabled. */ }
    }
  }, true);

  // Preserve the clicked control's viewport position across synchronous layout
  // changes. Resolving it again also covers controls replaced by preview renders.
  function pathOf(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    while (el && el !== document.body) {
      const siblings = [...el.parentElement.children].filter(item => item.tagName === el.tagName);
      parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(el) + 1})`);
      el = el.parentElement;
      if (el?.id) return `#${CSS.escape(el.id)} > ${parts.join(' > ')}`;
    }
    return `body > ${parts.join(' > ')}`;
  }
  function anchorInteraction(event) {
    if (applyingState) return;
    const control = event.target.closest('summary, button, select, input');
    if (!control || control.closest('#site-header') || control.matches('[type="submit"], .step-next, .step-back, [data-scroll-to], [data-action="session"], [data-action="close-session"], [data-action="go"], [data-action="build-routine"], [data-action="reset"]')) return;
    if (control.closest('main')) readingControl = control;
    const top = control.getBoundingClientRect().top;
    const path = pathOf(control);
    const focused = document.activeElement === control;
    requestAnimationFrame(() => {
      if (event.defaultPrevented && control.matches('summary')) return;
      const next = control.isConnected ? control : document.querySelector(path);
      if (!next || !visible(next)) return;
      if (readingControl === control) readingControl = next;
      if (focused && !control.isConnected) next.focus({ preventScroll: true });
      const delta = next.getBoundingClientRect().top - top;
      if (Math.abs(delta) > 1) instant(window.scrollY + delta);
    });
  }
  document.addEventListener('click', anchorInteraction, true);
  document.addEventListener('change', anchorInteraction, true);
  document.addEventListener('input', anchorInteraction, true);
  document.addEventListener('keydown', event => {
    if (event.target.matches('[role="tab"]') && /^(Arrow|Home|End)/.test(event.key)) anchorInteraction(event);
  }, true);

  let restored = false;
  async function restoreDocument() {
    if (restored) return;
    restored = true;
    let state;
    try {
      state = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      sessionStorage.removeItem(storageKey);
    } catch { /* Default navigation still works without storage. */ }
    const elapsed = Date.now() - state?.time;
    const languageChange = state?.target === location.pathname && elapsed >= 0 && elapsed < 30000
      && state.position && Number.isFinite(state.position.top) && Number.isFinite(state.position.offset);
    const findAnchor = saved => {
      let el;
      try { if (typeof saved.selector === 'string') el = document.querySelector(saved.selector); } catch { /* A removed or obsolete selector falls back to its block. */ }
      return el || (typeof saved.id === 'string' && document.getElementById(saved.id)) || blocks()[saved.index];
    };
    if (languageChange) {
      applyingState = true;
      if (state.customer) customerState?.restore(state.customer);
      for (const id of Array.isArray(state.tabs) ? state.tabs : []) {
        const tab = document.getElementById(id);
        if (tab?.getAttribute('aria-selected') === 'false') tab.click();
      }
      all('main details').forEach((el, index) => { el.open = Boolean(state.details?.[index]); });
      applyingState = false;
    }
    // Wait for fonts and images above the destination; avoid delayed jumps once
    // the visitor starts interacting with the newly opened document.
    let interrupted = false;
    const interrupt = () => { interrupted = true; };
    const events = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
    events.forEach(name => window.addEventListener(name, interrupt, { once: true, passive: true }));
    const position = () => {
      if (interrupted) return;
      if (languageChange) {
        const saved = state.position;
        const el = findAnchor(saved);
        instant(el && visible(el) ? window.scrollY + el.getBoundingClientRect().top - headerHeight() - 16 - saved.offset : saved.top);
      } else if (location.hash) {
        let target;
        try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* Invalid fragment. */ }
        if (target) instant(window.scrollY + target.getBoundingClientRect().top - headerHeight() - 16);
      } else instant(0);
    };
    position();
    await Promise.race([Promise.all([
      document.fonts?.ready,
      ...all('img').map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }))
    ]), new Promise(resolve => setTimeout(resolve, 1800))]);
    requestAnimationFrame(() => {
      position();
      events.forEach(name => window.removeEventListener(name, interrupt));
    });
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted) { instant(0); return; }
    restoreDocument();
  });
})();
