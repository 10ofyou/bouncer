// Bouncer decision logic. Pure functions, no DOM, no network - content.js
// builds a plain "snapshot" of the page and hands it here, which keeps this
// file testable in Node (see test/matcher.test.mjs).
(function (root) {
  const { BRANDS, FEDERATED_PHRASE } =
    root.BouncerBrands || (typeof require === 'function' ? require('./brands.js') : {});

  const STRONG = 3;
  const WEAK_NEEDED = 3;

  // Is `hostname` one of the brand's real hosts?
  // Exact match, or a dot-bounded suffix: "x.accounts.google.com" passes,
  // "accounts.google.com.evil.com" and "evilaccounts.google.com"-style tricks
  // do not. Anything that is not plain lowercase ASCII fails outright, and
  // punycode ("xn--") hosts are compared as-is, so a look-alike domain can
  // never be folded back into the real one.
  function hostAllowed(hostname, allow) {
    if (typeof hostname !== 'string' || !hostname) return false;
    const host = hostname.toLowerCase().replace(/\.$/, '');
    if (!/^[a-z0-9.-]+$/.test(host)) return false;
    return allow.some((entry) => entry && (host === entry || host.endsWith('.' + entry)));
  }

  function brandForHost(hostname) {
    return BRANDS.find((b) => hostAllowed(hostname, b.allow)) || null;
  }

  function anyMatch(patterns, s) {
    return !!s && patterns.some((re) => re.test(s));
  }

  // Logo file names run words together ("googlelogo_color.png"), so asset
  // matching drops the word boundaries the text tokens use.
  const loose = (patterns) => patterns.map((re) => new RegExp(re.source.replace(/\\b/g, ''), 'i'));

  // Score each brand against the snapshot. Returns the best brand the page is
  // impersonating, or null.
  //   snapshot = { title, text, assets, hasPassword, hasCredential }
  //   text   - visible text, already trimmed to a sane length
  //   assets - alt/src/aria-label/title of logo-ish images and the favicon,
  //            excluding anything inside a link or button
  function detectBrand(snapshot) {
    // Collapse whitespace so wording split across lines ("Sign in\nwith your
    // Google Account") still matches the single-space phrases in brands.js.
    const squash = (s) => (s || '').replace(/\s+/g, ' ');
    const title = squash(snapshot.title);
    const text = squash(snapshot.text);
    const assets = snapshot.assets || '';
    const plainText = text.replace(FEDERATED_PHRASE, ' ');
    let best = null;

    for (const brand of BRANDS) {
      const reasons = [];
      let score = 0;
      if (anyMatch(brand.strongTitle, title)) { score += STRONG; reasons.push('title'); }
      if (anyMatch(brand.strongText, plainText)) { score += STRONG; reasons.push('sign-in wording'); }
      const strong = score >= STRONG;

      let weak = 0;
      if (anyMatch(brand.tokens, title)) { weak++; reasons.push('name in title'); }
      if (anyMatch(loose(brand.tokens), assets)) { weak++; reasons.push('logo/favicon'); }
      if (anyMatch(brand.tokens, plainText)) { weak++; reasons.push('name in text'); }
      score += weak;

      const pretending =
        (strong && snapshot.hasCredential) || (weak >= WEAK_NEEDED && snapshot.hasPassword);
      if (pretending && (!best || score > best.score)) best = { brand, score, reasons };
    }
    return best;
  }

  // The whole verdict for one page.
  //   none     - no credential field, or nothing claims to be a listed brand
  //   verified - credential field on a real listed host
  //   blocked  - claims to be a brand, host is not on that brand's list
  function decide(hostname, snapshot) {
    if (!snapshot.hasCredential) return { status: 'none' };
    const home = brandForHost(hostname);
    if (home) return { status: 'verified', brand: home.name, host: hostname };
    const hit = detectBrand(snapshot);
    if (!hit) return { status: 'none' };
    return { status: 'blocked', brand: hit.brand.name, host: hostname, reasons: hit.reasons };
  }

  const api = { hostAllowed, brandForHost, detectBrand, decide };
  root.BouncerMatcher = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
