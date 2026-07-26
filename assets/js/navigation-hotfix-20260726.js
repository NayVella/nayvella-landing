(() => {
  'use strict';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const resetDocumentScroll = () => {
    if (location.hash) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  };

  resetDocumentScroll();
  window.addEventListener('pageshow', resetDocumentScroll);
})();
