// Bouncer content script. Runs in every page and frame from document_start.
// It watches for credential fields, asks matcher.js whether the page is
// pretending to be a listed brand on the wrong domain, and if so locks the
// fields and covers the page. It makes no network requests.
(function () {
  if (window.__bouncerLoaded) return;
  window.__bouncerLoaded = true;

  const { decide } = globalThis.BouncerMatcher;
  const TEXT_LIMIT = 40000;
  const HOST_ID = 'bouncer-overlay-host';

  const state = {
    verdict: { status: 'none' },
    blocked: null, // the blocking verdict, once one exists
    overridden: false,
    reported: '',
    overlayHost: null,
    timer: 0,
  };
  const saved = new WeakMap(); // field -> { disabled, readOnly }

  // ---- what counts as a credential field ---------------------------------

  const ID_HINT = /e-?mail|user(name)?|login|identifier|loginfmt|account|phone|passw|passwd/i;

  function isCredentialField(el) {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (type === 'password' || type === 'email') return true;
    if (!['text', 'tel', ''].includes(type)) return false;
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (/\b(username|email|current-password|webauthn)\b/.test(ac)) return true;
    const hints = [el.name, el.id, el.getAttribute('placeholder'), el.getAttribute('aria-label')].join(' ');
    return ID_HINT.test(hints);
  }

  function credentialFields() {
    return Array.from(document.querySelectorAll('input')).filter(isCredentialField);
  }

  // ---- page snapshot for matcher.js ---------------------------------------

  function insideControl(el) {
    return !!el.closest('a, button, [role="button"], [role="link"]');
  }

  function snapshot(fields) {
    const body = document.body;
    let text = '';
    if (body) text = (body.innerText || body.textContent || '').slice(0, TEXT_LIMIT);
    // Labels that live only in attributes still count as visible wording.
    for (const f of fields) text += ' ' + (f.getAttribute('placeholder') || '') + ' ' + (f.getAttribute('aria-label') || '');

    const assets = [];
    for (const el of document.querySelectorAll('img, svg, [role="img"], image')) {
      if (insideControl(el)) continue;
      assets.push(el.getAttribute('alt'), el.getAttribute('aria-label'), el.getAttribute('title'));
      const src = el.getAttribute('src') || el.getAttribute('href') || '';
      if (src && !src.startsWith('data:')) assets.push(src);
      const t = el.querySelector && el.querySelector('title');
      if (t) assets.push(t.textContent);
    }
    for (const link of document.querySelectorAll('link[rel~="icon"]')) {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('data:')) assets.push(href);
    }
    const site = document.querySelector('meta[property="og:site_name"]');
    if (site) assets.push(site.getAttribute('content'));

    return {
      title: document.title || '',
      text,
      assets: assets.filter(Boolean).join(' '),
      hasCredential: fields.length > 0,
      hasPassword: fields.some((f) => (f.getAttribute('type') || '').toLowerCase() === 'password'),
    };
  }

  // ---- locking ------------------------------------------------------------

  function lock(field) {
    if (!saved.has(field)) saved.set(field, { disabled: field.disabled, readOnly: field.readOnly });
    field.value = '';
    field.disabled = true;
    field.readOnly = true;
    field.setAttribute('data-bouncer-locked', '');
    if (document.activeElement === field) field.blur();
  }

  function lockAll() {
    for (const f of credentialFields()) lock(f);
  }

  function unlockAll() {
    for (const f of document.querySelectorAll('[data-bouncer-locked]')) {
      const s = saved.get(f) || { disabled: false, readOnly: false };
      f.disabled = s.disabled;
      f.readOnly = s.readOnly;
      f.removeAttribute('data-bouncer-locked');
    }
  }

  const active = () => state.blocked && !state.overridden;

  function isGuarded(target) {
    return target instanceof HTMLInputElement && (target.hasAttribute('data-bouncer-locked') || isCredentialField(target));
  }

  // Capture-phase guards on window run before any page handler.
  function swallow(e) {
    if (!active() || !isGuarded(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.target.value) e.target.value = '';
  }
  for (const type of ['keydown', 'keypress', 'keyup', 'beforeinput', 'input', 'paste', 'drop', 'focusin']) {
    window.addEventListener(type, swallow, true);
  }
  window.addEventListener('focusin', (e) => { if (active() && isGuarded(e.target)) e.target.blur(); }, true);
  window.addEventListener('submit', (e) => {
    if (!active()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  // ---- overlay ------------------------------------------------------------

  const OVERLAY_CSS = `
    :host { all: initial; }
    .wrap { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center;
      justify-content: center; padding: 16px; background: rgba(20, 8, 8, 0.94);
      font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff; }
    .card { max-width: 560px; width: 100%; background: #2a0f0f; border: 2px solid #d93025;
      border-radius: 14px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
    h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.2; color: #ff6b5e; }
    p { margin: 0 0 14px; }
    .domain { font-family: ui-monospace, Menlo, Consolas, monospace; background: #000; padding: 1px 6px;
      border-radius: 4px; word-break: break-all; }
    .small { font-size: 13px; color: #e8c9c6; }
    button { font: inherit; cursor: pointer; border-radius: 8px; padding: 10px 16px; border: 0; }
    .leave { background: #fff; color: #2a0f0f; font-weight: 600; }
    details { margin-top: 18px; }
    summary { cursor: pointer; font-size: 13px; color: #e8c9c6; }
    input { font: inherit; width: 100%; box-sizing: border-box; margin: 8px 0; padding: 8px 10px;
      border-radius: 6px; border: 1px solid #888; background: #111; color: #fff; }
    .unlock { background: transparent; color: #e8c9c6; border: 1px solid #e8c9c6; font-size: 13px; }
    .err { color: #ff9b91; font-size: 13px; min-height: 1em; }
  `;

  function buildOverlay(v) {
    const host = document.createElement('div');
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.setAttribute('role', 'alertdialog');
    wrap.setAttribute('aria-label', 'Bouncer blocked this page');

    const card = document.createElement('div');
    card.className = 'card';
    const h1 = document.createElement('h1');
    h1.textContent = 'Not on the list.';
    const p = document.createElement('p');
    p.setAttribute('data-bouncer-message', '');
    p.append(`This page says it's ${v.brand}, but it's really `);
    const d = document.createElement('span');
    d.className = 'domain';
    d.textContent = v.host;
    p.append(d, '.');
    const p2 = document.createElement('p');
    p2.className = 'small';
    p2.textContent = `Bouncer locked the email and password boxes so nothing you type reaches this site. A real ${v.brand} sign-in never lives on this domain.`;

    const leave = document.createElement('button');
    leave.className = 'leave';
    leave.textContent = 'Get me out of here';
    leave.addEventListener('click', () => {
      if (history.length > 1) history.back();
      else location.replace('about:blank');
    });

    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'I trust this site anyway';
    const help = document.createElement('p');
    help.className = 'small';
    help.textContent = `To unlock this page once, type its domain exactly: ${v.host}`;
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Type the domain to unlock');
    input.autocomplete = 'off';
    input.spellcheck = false;
    const err = document.createElement('div');
    err.className = 'err';
    const unlock = document.createElement('button');
    unlock.className = 'unlock';
    unlock.textContent = 'Unlock this page';
    const tryUnlock = () => {
      if (input.value.trim().toLowerCase() === v.host.toLowerCase()) override(v);
      else err.textContent = 'That does not match the domain shown above.';
    };
    unlock.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
    det.append(sum, help, input, err, unlock);

    card.append(h1, p, p2, leave, det);
    wrap.append(card);
    root.append(style, wrap);
    return host;
  }

  function showOverlay() {
    if (!state.overlayHost) state.overlayHost = buildOverlay(state.blocked);
    if (!state.overlayHost.isConnected) document.documentElement.appendChild(state.overlayHost);
  }

  function override(v) {
    state.overridden = true;
    unlockAll();
    if (state.overlayHost) state.overlayHost.remove();
    report({ status: 'overridden', brand: v.brand, host: v.host });
    const entry = { at: new Date().toISOString(), host: v.host, brand: v.brand, page: location.origin + location.pathname };
    try {
      chrome.storage.local.get({ overrides: [] }, (r) => {
        const list = (r.overrides || []).concat(entry).slice(-200);
        chrome.storage.local.set({ overrides: list });
      });
    } catch (_) { /* extension reloaded; nothing to log to */ }
  }

  // ---- main loop ----------------------------------------------------------

  function report(v) {
    const key = v.status + '|' + (v.brand || '');
    if (key === state.reported) return;
    state.reported = key;
    try {
      chrome.runtime.sendMessage({ type: 'bouncer-status', status: v.status, brand: v.brand, host: v.host });
    } catch (_) { /* extension reloaded */ }
  }

  function evaluate() {
    state.timer = 0;
    if (state.blocked || state.verdict.status === 'verified') return;
    const fields = credentialFields();
    if (!fields.length) return;
    const v = decide(location.hostname, snapshot(fields));
    state.verdict = v;
    if (v.status === 'blocked') {
      state.blocked = v;
      lockAll();
      showOverlay();
    }
    if (v.status !== 'none') report(v);
  }

  function schedule() {
    if (active()) {
      // Already blocked: lock new fields right away, no debounce.
      lockAll();
      showOverlay();
      return;
    }
    if (state.overridden || state.verdict.status === 'verified') return;
    if (!state.timer) state.timer = setTimeout(evaluate, 120);
  }

  new MutationObserver(schedule).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['type', 'autocomplete', 'name', 'placeholder'],
  });
  document.addEventListener('DOMContentLoaded', evaluate);
  window.addEventListener('load', evaluate);
  schedule();
})();
