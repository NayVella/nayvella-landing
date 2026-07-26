(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const lang = document.documentElement.lang.startsWith('ar') ? 'ar' : 'en';
  const text = {
    ar: {
      network: 'تعذر إرسال الطلب حالياً. حاول مرة أخرى.',
      duplicate: 'سبق تسجيل هذا البريد لهذه الفئة خلال آخر 24 ساعة.',
      rate: 'تم تجاوز عدد المحاولات المسموح. حاول لاحقاً.',
      turnstile: 'أكمل التحقق الأمني ثم أعد المحاولة.',
      invalid: 'يرجى مراجعة البيانات المطلوبة.',
      sending: 'جارٍ إرسال الطلب بأمان…'
    },
    en: {
      network: 'The request could not be submitted. Please try again.',
      duplicate: 'This email has already been registered for this category within the last 24 hours.',
      rate: 'Too many attempts. Please try again later.',
      turnstile: 'Complete the security check and try again.',
      invalid: 'Please review the required information.',
      sending: 'Submitting securely…'
    }
  }[lang];

  const utm = {};
  const search = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach((key) => {
    const value = search.get(key);
    if (value) utm[key] = value.slice(0, 180);
  });

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function setVisible(element, visible, display = 'block') {
    if (!element) return;
    element.classList.remove('js-hide', 'js-show-block', 'js-show-flex');
    element.classList.add(visible ? (display === 'flex' ? 'js-show-flex' : 'js-show-block') : 'js-hide');
  }

  // Mobile navigation.
  const burger = $('#burger-btn');
  const mobileMenu = $('#mobile-menu');
  function setMenu(open) {
    if (!mobileMenu || !burger) return;
    setVisible(mobileMenu, open, 'flex');
    burger.setAttribute('aria-expanded', String(open));
  }
  if (burger && mobileMenu) {
    burger.setAttribute('aria-controls', 'mobile-menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('js-show-flex')));
    $$('#mobile-menu a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  }

  // Same-page anchor control retained for the home partner path.
  $$('[data-scroll-to]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      const target = document.getElementById(control.dataset.scrollTo || '');
      if (!target) return;
      const headerHeight = $('#site-header')?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // Static reveal delays avoid runtime style attributes under a strict CSP.
  $$('[class*="reveal"]').forEach((element, index) => {
    element.classList.add(`reveal-delay-${Math.min(index, 6)}`);
  });

  // FAQ accordion.
  $$('.faq-q').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const answer = item?.querySelector('.faq-a');
      if (!item || !answer) return;
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      $$('.faq-item').forEach((other) => {
        if (other === item) return;
        const q = other.querySelector('.faq-q');
        const a = other.querySelector('.faq-a');
        q?.setAttribute('aria-expanded', 'false');
        setVisible(a, false);
      });
      button.setAttribute('aria-expanded', String(!isOpen));
      setVisible(answer, !isOpen);
    });
  });

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
  const isValidMobile = (value) => /^(05\d{8}|\+9665\d{8})$/.test((value || '').replace(/[\s-]/g, ''));

  function showErrors(selector, visible, display = 'block') {
    $$(selector).forEach((error) => setVisible(error, visible, display));
  }

  function wireLiveValidation(inputId, errorClass, validator) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => {
      const show = input.value.length > 0 && !validator(input.value);
      showErrors(`.${errorClass}`, show);
    });
  }
  wireLiveValidation('customer-email', 'customer-email-err', isValidEmail);
  wireLiveValidation('merchant-email', 'merchant-email-err', isValidEmail);
  wireLiveValidation('merchant-mobile', 'merchant-mobile-err', isValidMobile);
  wireLiveValidation('clinic-email', 'clinic-email-err', isValidEmail);
  wireLiveValidation('clinic-mobile', 'clinic-mobile-err', isValidMobile);
  wireLiveValidation('expert-email', 'expert-email-err', isValidEmail);
  wireLiveValidation('expert-mobile', 'expert-mobile-err', isValidMobile);

  // Yes/no groups.
  $$('.yn-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.dataset.ynGroup;
      const value = button.dataset.ynVal;
      if (!group) return;
      $$(`.yn-btn[data-yn-group="${CSS.escape(group)}"]`).forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const hidden = document.getElementById(group);
      if (hidden) hidden.value = value || '';
    });
  });

  // Expert location multi-select.
  const selectedLocations = new Set();
  $$('.loc-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.loc || button.textContent.trim();
      if (selectedLocations.has(value)) {
        selectedLocations.delete(value);
        button.classList.remove('active');
      } else {
        selectedLocations.add(value);
        button.classList.add('active');
      }
      const hidden = $('#expert-locations');
      if (hidden) hidden.value = Array.from(selectedLocations).join(', ');
    });
  });

  // Two-step partner forms.
  function wireSteppedForm(formName, fields) {
    const form = document.getElementById(`form-${formName}`);
    if (!form) return;
    const next = form.querySelector(`.step-next[data-form="${formName}"]`);
    const back = form.querySelector(`.step-back[data-form="${formName}"]`);
    const step1 = form.querySelector(`.step[data-form="${formName}"][data-step="1"]`);
    const step2 = form.querySelector(`.step[data-form="${formName}"][data-step="2"]`);
    const progress = document.querySelector(`.progress-bar[data-form="${formName}"]`);
    const label = document.querySelector(`.step-label[data-form="${formName}"]`);
    if (!step1 || !step2) return;

    const updateLabel = (step) => {
      if (label) label.textContent = lang === 'ar' ? `الخطوة ${step} من 2` : `Step ${step} of 2`;
    };
    const validateFirstStep = () => {
      const requiredOk = fields.required.every((id) => document.getElementById(id)?.value.trim());
      const email = document.getElementById(fields.email);
      const mobile = document.getElementById(fields.mobile);
      return Boolean(requiredOk && email && mobile && isValidEmail(email.value) && isValidMobile(mobile.value));
    };
    next?.addEventListener('click', () => {
      if (!validateFirstStep()) {
        const email = document.getElementById(fields.email);
        const mobile = document.getElementById(fields.mobile);
        showErrors(`.${formName}-email-err`, Boolean(email && !isValidEmail(email.value)));
        showErrors(`.${formName}-mobile-err`, Boolean(mobile && !isValidMobile(mobile.value)));
        const formStatus = form.querySelector('.form-status');
        if (formStatus) formStatus.textContent = text.invalid;
        return;
      }
      setVisible(step1, false);
      setVisible(step2, true);
      progress?.classList.add('is-complete');
      updateLabel(2);
      const top = form.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    back?.addEventListener('click', () => {
      setVisible(step2, false);
      setVisible(step1, true);
      progress?.classList.remove('is-complete');
      updateLabel(1);
    });
    updateLabel(1);
  }
  wireSteppedForm('merchant', { required: ['merchant-brand', 'merchant-contact'], email: 'merchant-email', mobile: 'merchant-mobile' });
  wireSteppedForm('clinic', { required: ['clinic-name', 'clinic-contact'], email: 'clinic-email', mobile: 'clinic-mobile' });

  // Cloudflare Turnstile public configuration is injected by a same-origin endpoint.
  const turnstileTokens = new WeakMap();
  const turnstileWidgetIds = new WeakMap();
  let turnstileConfigured = false;

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-turnstile-loader]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileLoader = 'true';
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  async function initializeTurnstile() {
    const slots = $$('.turnstile-slot');
    if (!slots.length) return;
    const response = await fetch('/api/public-config', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    });
    if (!response.ok) return;
    const config = await response.json();
    const siteKey = String(config.turnstileSiteKey || '').trim();
    if (!siteKey) return;
    turnstileConfigured = true;
    await loadTurnstileScript();
    slots.forEach((slot) => {
      const form = slot.closest('form');
      if (!form || !window.turnstile) return;
      const widgetId = window.turnstile.render(slot, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => {
          turnstileTokens.set(form, token);
          const status = form.querySelector('.form-status');
          if (status?.textContent === text.turnstile) status.textContent = '';
        },
        'expired-callback': () => turnstileTokens.delete(form),
        'error-callback': () => turnstileTokens.delete(form)
      });
      turnstileWidgetIds.set(form, widgetId);
    });
  }

  const turnstileInitialization = initializeTurnstile().catch(() => undefined);

  const segmentMap = {
    customer: 'customer_lead',
    merchant: 'merchant_lead',
    clinic: 'clinic_lead',
    expert: 'specialist_lead'
  };

  function buildPayload(formName, form) {
    const prefix = `${formName}-`;
    const payload = {
      segment: segmentMap[formName],
      partial: false,
      hp: '',
      consent: false,
      utm,
      turnstileToken: turnstileTokens.get(form) || ''
    };
    $$('input, select, textarea', form).forEach((field) => {
      if (!field.id) return;
      const key = field.id.startsWith(prefix) ? field.id.slice(prefix.length) : field.id;
      if (key === 'hp') payload.hp = field.value;
      else if (key === 'consent') payload.consent = Boolean(field.checked);
      else payload[key] = field.type === 'checkbox' ? Boolean(field.checked) : field.value;
    });
    if (payload.consent) payload.consentAt = new Date().toISOString();
    return payload;
  }

  async function submitLead(payload) {
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      return { ok: response.ok && Boolean(body.ok), status: response.status, error: body.error };
    } catch {
      return { ok: false, status: 0, error: 'network_error' };
    }
  }

  function errorMessage(error) {
    if (error === 'duplicate_submission') return text.duplicate;
    if (error === 'rate_limited') return text.rate;
    if (error === 'turnstile_failed') return text.turnstile;
    return text.network;
  }

  function resetTurnstile(form) {
    turnstileTokens.delete(form);
    const widgetId = turnstileWidgetIds.get(form);
    if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
  }

  function wireForm(formName, options) {
    const form = document.getElementById(`form-${formName}`);
    if (!form) return;
    const status = form.querySelector('.form-status');
    const consent = document.getElementById(`${formName}-consent`);
    consent?.addEventListener('change', () => {
      if (consent.checked) showErrors(`.${formName}-consent-err`, false);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const honeypot = document.getElementById(`${formName}-hp`);
      if (honeypot?.value) return;
      const email = options.email ? document.getElementById(options.email) : null;
      const mobile = options.mobile ? document.getElementById(options.mobile) : null;
      const requiredOk = (options.required || []).every((id) => document.getElementById(id)?.value.trim());
      const valid = Boolean(
        consent?.checked && requiredOk &&
        (!email || isValidEmail(email.value)) &&
        (!mobile || isValidMobile(mobile.value))
      );
      showErrors(`.${formName}-consent-err`, !consent?.checked, 'flex');
      showErrors(`.${formName}-email-err`, Boolean(email && !isValidEmail(email.value)));
      showErrors(`.${formName}-mobile-err`, Boolean(mobile && !isValidMobile(mobile.value)));
      if (!valid) {
        if (status) status.textContent = text.invalid;
        return;
      }

      await turnstileInitialization;
      if (turnstileConfigured && !turnstileTokens.get(form)) {
        if (status) status.textContent = text.turnstile;
        return;
      }

      const submit = form.querySelector('.primary-btn[type="submit"], button[type="submit"]');
      if (submit) submit.disabled = true;
      form.setAttribute('aria-busy', 'true');
      if (status) status.textContent = text.sending;
      showErrors(`.${formName}-submit-err`, false);
      const result = await submitLead(buildPayload(formName, form));
      if (submit) submit.disabled = false;
      form.removeAttribute('aria-busy');
      if (result.ok) {
        setVisible(form, false);
        const success = form.parentElement?.querySelector('.success-state');
        setVisible(success, true, 'flex');
      } else {
        if (status) status.textContent = '';
        const submitError = form.querySelector(`.${formName}-submit-err`);
        if (submitError) {
          const messageNode = submitError.querySelector('span:last-child') || submitError;
          messageNode.textContent = errorMessage(result.error);
        }
        showErrors(`.${formName}-submit-err`, true, 'flex');
        if (result.error === 'turnstile_failed') resetTurnstile(form);
      }
    });
  }

  wireForm('customer', { email: 'customer-email' });
  wireForm('merchant', { email: 'merchant-email', mobile: 'merchant-mobile', required: ['merchant-brand', 'merchant-contact'] });
  wireForm('clinic', { email: 'clinic-email', mobile: 'clinic-mobile', required: ['clinic-name', 'clinic-contact'] });
  wireForm('expert', { email: 'expert-email', mobile: 'expert-mobile', required: ['expert-name'] });
})();
