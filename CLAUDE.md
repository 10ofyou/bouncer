# Bouncer - notes for AI coding assistants

A Manifest V3 Chrome extension that locks credential fields on pages pretending to be a
Google, Microsoft, LinkedIn, Facebook, Apple or PayPal sign-in on the wrong domain. It covers
those pages with "Not on the list. This page says it's <Brand>, but it's really <domain>."
It was written in response to a phishing campaign that sends calendar invites titled
"New Message" with a fake voicemail link to a Google look-alike on
`accounts.sendhighgraph.com`.

## Files

| Path | What |
|---|---|
| `extension/` | The unpacked extension. This folder is what gets loaded and zipped |
| `extension/src/brands.js` | Brand list: `allow` hosts, `strongText`/`strongTitle` sign-in wording, weak `tokens` |
| `extension/src/matcher.js` | Pure decision logic (`hostAllowed`, `detectBrand`, `decide`); also loads in Node |
| `extension/src/content.js` | Page snapshot, field locking, keystroke/submit guards, overlay, MutationObserver |
| `extension/src/background.js` | Per-tab badge only |
| `test/matcher.test.mjs` | Unit tests (`npm test`) |
| `test/e2e.mjs` | Playwright with the extension loaded (`npm run e2e`) |
| `dist/bouncer.zip` | Committed handout build (`npm run build`) |
| `BUILD-IT-YOURSELF.md` | Prompt for non-developers to build an equivalent extension with their own AI |

## Hard rules

- **No network calls of any kind** from extension code. No analytics, fetch, remote config
  or external assets. The CSP has `connect-src 'none'`. Keep it that way.
- Permissions stay at `<all_urls>` content script + `storage`. Any new permission needs a
  README justification row.
- Host matching is exact or dot-bounded suffix, ASCII only. Never normalize punycode or
  homoglyphs toward a brand, and never fuzzy-match.
- Act only on brand signal AND credential field. A weak-only match also requires a password field.
- The name stays "Bouncer". No "Chrome" or "Google" in the name.
- Test fixtures use reserved `.test` host names and generic content only.

## Testing

- `npm install` once (pins Playwright; run `npx playwright install chromium` if no browser is cached).
- `npm run e2e` maps the fake hosts (`*.test`) to 127.0.0.1 with `--host-resolver-rules`, inside the
  test browser only. It loads the real `accounts.google.com` but never types into it.
  `npm run e2e -- --skip-real` skips that check when offline.
- Screenshots go to `test-results/` (gitignored).
- After changing anything in `extension/`, run `npm run build` and commit the new `dist/bouncer.zip`.
- When adding or changing a brand, load that brand's real sign-in page live, as the Google check does.
  Real pages differ from fixtures; the live Google run caught wording split across lines.

No em dashes or en dashes in docs.
