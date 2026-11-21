(() => {
  'use strict';

  // One owner for document navigation, language handoff and layout anchoring.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const storageKey = 'nayvella-language-position';
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const instant = top => window.scrollTo({ top, left: 0, behavior: 'instant' });
  const readingLine = () => (document.querySelector('#site-header')?.offsetHeight ?? 0) + 16;
  const fragmentTarget = (hash = location.hash) => {
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
  };
  const scrollToFragment = (target, focus = false) => {
    if (focus) {
      if (!target.matches('[tabindex], a[href], button, input, select, textarea, summary')) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    instant(window.scrollY + target.getBoundingClientRect().top - readingLine());
  };
  const clickedLink = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    const link = event.target.closest('a[href]');
    return link && !link.hasAttribute('download') && (!link.target || link.target === '_self') ? link : null;
  };
  const visible = el => el.getClientRects().length > 0;
  const blocks = () => all('main [id], main section, main article, main details, main h1, main h2, main h3, main p, main li, main summary, #site-footer');
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
    const top = Math.max(0, window.scrollY);
    const line = readingLine();
    // The first viewport can have different text alignment at the same scroll
    // position. Keep its opening offset even if the copy wraps differently.
    if (top <= line) return { top: top <= 1 ? 0 : top, offset: 0, atStart: true };
    const save = (el, rect) => ({
      id: el.id, selector: pathOf(el), offset: rect.top - line, top,
      // A line inside wrapped copy should stay at the same point in that block.
      progress: rect.top < line && rect.bottom > line ? (line - rect.top) / rect.height : null
    });
    if (readingControl?.isConnected && visible(readingControl)) {
      const rect = readingControl.getBoundingClientRect();
      if (rect.top >= line && rect.bottom <= innerHeight) return save(readingControl, rect);
    }
    const candidates = blocks().filter(visible).map(el => ({ el, rect: el.getBoundingClientRect() }));
    const textAtLine = candidates.filter(({ el, rect }) =>
      el.matches('h1, h2, h3, p, li, summary') && rect.top <= line && rect.bottom > line);
    const nearest = (best, candidate) => !best || Math.abs(candidate.rect.top - line) < Math.abs(best.rect.top - line) ? candidate : best;
    const anchor = textAtLine.reduce(nearest, null) ||
      candidates.filter(({ rect }) => rect.bottom > line && rect.top < innerHeight).reduce(nearest, null);
    return anchor ? save(anchor.el, anchor.rect) : { top, offset: 0 };
  }

  // Capture before any bubbling handler closes the mobile menu or changes layout.
  document.addEventListener('click', event => {
    const link = clickedLink(event);
    if (link?.id !== 'lang-toggle') return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin) return;
    const position = readingPosition();
    const fragment = position.top && fragmentTarget();
    if (fragment) {
      target.hash = location.hash;
      // Prefer the explicit destination when the reader is still at its start.
      // Small fractional/rounded scroll differences can vary by browser.
      if (Math.abs(fragment.getBoundingClientRect().top - readingLine()) <= 4) {
        position.fragment = fragment.id;
      }
    }
    const preserveFragment = target.hash && target.href !== link.href;
    const state = {
      target: target.pathname, time: Date.now(), position,
      details: all('main details').map(el => el.open),
      tabs: all('[role="tab"][aria-selected="true"]').map(el => el.id).filter(Boolean),
      customer: customerState?.read()
    };
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Storage may be disabled. */ }
    if (preserveFragment) {
      event.preventDefault();
      location.assign(target.href);
    }
  }, true);

  // Ordinary cross-page links still use native navigation. Handle links within
  // this document after the mobile menu has handled its own link click.
  document.addEventListener('click', event => {
    const link = clickedLink(event);
    if (!link || link.id === 'lang-toggle') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
    const target = fragmentTarget(url.hash);
    if (!target && (url.hash || !link.closest('#site-header'))) return;
    event.preventDefault();
    if (url.href !== location.href) history.pushState(null, '', url.href);
    if (target) scrollToFragment(target, true);
    else instant(0);
  });

  window.addEventListener('hashchange', () => {
    const target = fragmentTarget();
    if (target) scrollToFragment(target);
    else if (!location.hash) instant(0);
  });

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
    // Some Guide translations have a different set of headings. Remove a
    // carried fragment that has no destination in this translation.
    const missingFragment = languageChange && location.hash && !fragmentTarget();
    if (missingFragment) history.replaceState(history.state, '', location.pathname + location.search);
    const findAnchor = saved => {
      const byId = typeof saved.id === 'string' && document.getElementById(saved.id);
      if (byId && visible(byId)) return byId;
      try {
        const el = typeof saved.selector === 'string' && document.querySelector(saved.selector);
        if (el && visible(el)) return el;
      } catch { /* A removed or obsolete selector falls back to the fragment or scroll position. */ }
      return null;
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
        if (saved.top === 0 || saved.atStart) { instant(saved.top); return; }
        const fragment = fragmentTarget();
        if (fragment && fragment.id === saved.fragment) {
          scrollToFragment(fragment);
          return;
        }
        const el = findAnchor(saved);
        if (el) {
          const rect = el.getBoundingClientRect();
          const offset = Number.isFinite(saved.progress) ? -rect.height * saved.progress : saved.offset;
          instant(window.scrollY + rect.top - readingLine() - offset);
        } else {
          const target = fragmentTarget();
          if (target) scrollToFragment(target);
          else if (missingFragment) {
            const article = document.querySelector('.guide-article-body');
            if (article) scrollToFragment(article);
            else instant(0);
          } else instant(saved.top);
        }
      } else {
        const target = fragmentTarget();
        if (target) scrollToFragment(target);
        else if (!location.hash) instant(0);
      }
    };
    position();
    await Promise.race([Promise.all([
      document.fonts?.ready,
      ...all('img:not([loading="lazy"])').map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
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
    if (event.persisted) {
      const target = fragmentTarget();
      if (target) scrollToFragment(target);
      else instant(0);
      return;
    }
    restoreDocument();
  });
})();
