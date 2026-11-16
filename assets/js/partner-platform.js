(() => {
  'use strict';
  document.querySelectorAll('[data-partner-platform]').forEach(root => {
    const ar = root.dataset.lang === 'ar';
    const q = s => root.querySelector(s);
    const all = s => [...root.querySelectorAll(s)];
    const text = (a, b) => ar ? a : b;
    const pressed = (s, button) => all(s).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    function choices(attr, callback) {
      all(`[${attr}]`).forEach(button => button.addEventListener('click', () => {
        pressed(`[${attr}]`, button);
        callback(Number(button.getAttribute(attr)), button);
      }));
    }
    function show(selector, attr, index) { all(selector).forEach(el => { el.hidden = Number(el.getAttribute(attr)) !== index; }); }
    const tabs = all('[data-pp-tab]');
    function selectTab(index, focus = false) {
      tabs.forEach((b, i) => {
        b.setAttribute('aria-selected', String(i === index));
        b.tabIndex = i === index ? 0 : -1;
        q(`#${b.getAttribute('aria-controls')}`).hidden = i !== index;
      });
      if (focus) tabs[index].focus({preventScroll:true});
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => selectTab(i));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (event.key === 'ArrowDown') next = (i + 1) % tabs.length;
        if (event.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') next = (i + (ar ? -1 : 1) + tabs.length) % tabs.length;
        if (event.key === 'ArrowLeft') next = (i + (ar ? 1 : -1) + tabs.length) % tabs.length;
        if (next !== undefined) { event.preventDefault(); selectTab(next, true); }
      });
    });
    if (root.dataset.kind === 'merchant') {
      q('[data-pp-search]').addEventListener('input', event => {
        const term = event.target.value.trim().toLowerCase();
        let count = 0;
        all('[data-pp-product]').forEach(card => {
          const matches = card.dataset.search.includes(term);
          card.hidden = !matches;
          if (matches) count++;
        });
        q('[data-pp-empty]').hidden = count !== 0;
      });
      choices('data-pp-variant', (_, button) => {
        const size = document.createElement('bdi');
        size.textContent = button.textContent;
        q('[data-pp-variant-result]').replaceChildren(document.createTextNode(text('الحجم المختار: ', 'Selected size: ')), size);
      });
      choices('data-pp-order-filter', index => {
        all('[data-pp-order]').forEach(row => { row.hidden = index !== 0 && Number(row.dataset.ppOrder) !== index; });
        const first = all('[data-pp-order]').find(row => !row.hidden);
        selectOrder(first);
      });
      function selectOrder(button) {
        pressed('[data-pp-order]', button);
        q('[data-pp-order-id]').textContent = button.querySelector('bdi').textContent;
        q('[data-pp-order-status]').textContent = button.dataset.ppOrderLabel;
        q('#pp-panel-1').dataset.ppOrderStage = button.dataset.ppOrder;
      }
      all('[data-pp-order]').forEach(button => button.addEventListener('click', () => selectOrder(button)));
      choices('data-pp-stock-filter', index => all('[data-pp-stock-row]').forEach(row => {
        row.hidden = index === 1 ? row.dataset.low !== 'true' : index === 2 ? row.dataset.low === 'true' : false;
      }));
      choices('data-pp-promotion', index => show('[data-pp-promo-card]', 'data-pp-promo-card', index));
      choices('data-pp-analytics', index => {
        q('[data-pp-chart]').dataset.ppChart = String(index);
        q('[data-pp-analytics-copy]').textContent = index === 0
          ? text('اتجاه شهري توضيحي؛ تحليل المنتج يشمل الإضافة للسلة والتحويل والإيراد.', 'Illustrative monthly trend; product analytics cover add-to-cart, conversion and revenue.')
          : text('اتجاه سنوي توضيحي؛ راجع أداء الفئات والمنتجات والعملاء الجدد والعائدين.', 'Illustrative yearly trend; review category, product, new-customer and repeat-customer performance.');
      });
      choices('data-pp-permission', index => show('[data-pp-scope]', 'data-pp-scope', index));
    } else {
      choices('data-pp-appointment', index => show('[data-pp-appointment-card]', 'data-pp-appointment-card', index));
      choices('data-pp-consult', index => {
        q('[data-pp-consult-title]').textContent = text(
          ['سياق العناية بجوار جلسة الفيديو', 'تقرير البشرة بجوار مسار الاستشارة الصوتية', 'الملاحظات والمتابعة بجوار المحادثة'][index],
          ['Care context beside the video session', 'Skin reports beside the audio pathway', 'Notes and follow-up beside the chat'][index]);
      });
      choices('data-pp-care-period', index => show('[data-pp-care-list]', 'data-pp-care-list', index));
      choices('data-pp-context', index => show('[data-pp-context-view]', 'data-pp-context-view', index));
      choices('data-pp-ledger', index => show('[data-pp-ledger-view]', 'data-pp-ledger-view', index));
      const days = Array.from({length: 3}, () => ({slots: new Set(), duration: '15', unavailable: false}));
      let day = 0;
      function renderAvailability() {
        const state = days[day];
        q('[data-pp-duration]').value = state.duration;
        q('[data-pp-unavailable]').checked = state.unavailable;
        all('[data-pp-slot]').forEach(button => {
          button.disabled = state.unavailable;
          button.setAttribute('aria-pressed', String(state.slots.has(button.dataset.ppSlot)));
        });
        q('[data-pp-slot-summary]').textContent = state.unavailable
          ? text('اليوم المحدد غير متاح في المعاينة.', 'This day is unavailable in the preview.')
          : text(`الفترات المختارة: ${state.slots.size} · مدة الموعد: ${state.duration} دقيقة.`, `Selected slots: ${state.slots.size} · Appointment duration: ${state.duration} min.`);
      }
      choices('data-pp-day', index => { day = index; renderAvailability(); });
      q('[data-pp-duration]').addEventListener('change', event => { days[day].duration = event.target.value; renderAvailability(); });
      q('[data-pp-unavailable]').addEventListener('change', event => { days[day].unavailable = event.target.checked; renderAvailability(); });
      all('[data-pp-slot]').forEach(button => button.addEventListener('click', () => {
        const slots = days[day].slots;
        if (slots.has(button.dataset.ppSlot)) slots.delete(button.dataset.ppSlot); else slots.add(button.dataset.ppSlot);
        renderAvailability();
      }));
    }
  });
})();
