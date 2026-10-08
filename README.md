# Bouncer

A Chrome extension that stops you from typing your password into a fake sign-in page.

If a page claims to be a Google, Microsoft, LinkedIn, Facebook, Apple or PayPal sign-in,
Bouncer checks the page's real domain. If the domain is not on that brand's list, the email
and password boxes are locked and the page is covered with:

> **Not on the list.** This page says it's Google, but it's really accounts.sendhighgraph.com.

It was built for a live phishing campaign that sends Google Calendar invites titled
"New Message" with a fake voicemail link. The link opens a pixel-perfect Google sign-in page
on `accounts.sendhighgraph.com`. Bouncer blocks that page.

## Install

1. Download `dist/bouncer.zip` and unzip it somewhere you will keep it. Chrome loads it from
   that folder, so do not delete the folder afterwards.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder, the one with `manifest.json` in it.
4. Optional: pin Bouncer from the puzzle-piece menu so you can see its badge.

This works in any Chromium browser: Chrome, Edge, Brave and Arc.

## What you will see

| Badge | Meaning |
|---|---|
| green **OK** | You are on a real sign-in page for a listed brand |
| red **!** | Bouncer blocked a fake sign-in page on this tab |
| amber **!** | You unlocked a blocked page by hand |
| no badge | Nothing to check on this page |

The overlay has a **Get me out of here** button. There is no one-click way past it. If you
really do trust the site, open **I trust this site anyway** and type the page's domain
exactly. That unlocks the page for that one visit only, and the unlock is written to a log
inside your browser. Click the Bouncer icon to see the log.

## How it decides

1. **Is there a credential field?** This means an email, username or password box. If there
   is none, Bouncer does nothing.
2. **Is the page pretending to be a brand?** Bouncer looks for wording only a real sign-in
   page uses ("Use your Google Account", "Sign in to Outlook", "No account? Create one!"),
   page titles such as "Sign in - Google Accounts", and the brand's logo and favicon. A
   "Sign in with Google" button on someone else's site does not count, so ordinary login
   pages are left alone.
3. **Is the domain on the list?** The page's host must be exactly a listed host, such as
   `accounts.google.com`, or a real subdomain of one. That means:
   - `accounts.google.com.evil.com` fails. The real name is only a prefix there.
   - `g00gle.com` and `accounts-google.com` fail.
   - Look-alike domains spelled with foreign letters, such as `goоgle.com` with a Cyrillic
     "о" (which the browser shows as `xn--ggle-55da.com`), fail. Bouncer never treats them as
     "close enough".
4. On a mismatch, Bouncer disables the fields, swallows typing and pasting into them, blocks
   form submission, and shows the overlay. Many phishing kits draw the form a moment after
   the page loads, so Bouncer keeps watching and locks fields that appear later.

The brand list lives in `extension/src/brands.js`.

## Privacy and permissions

**Bouncer makes no network requests of any kind.** It has no analytics, no telemetry, no
remote config and no update checks of its own. Nothing you type leaves your browser. The
extension's own pages run under a content security policy with `connect-src 'none'`, so the
popup and the background worker cannot make network requests even by accident.

| Permission | Why |
|---|---|
| Content script on all sites (`<all_urls>`) | A fake sign-in page can live on any domain, so Bouncer has to look at every page to find one. It reads the page's title, text, logos and form fields locally and sends them nowhere. |
| `storage` | Keeps the log of pages you unlocked by hand on your own computer (`chrome.storage.local`). Nothing else is stored. |

Bouncer asks for nothing else: no `tabs`, no `webRequest`, no history, no cookies.

## What Bouncer does NOT protect against

- **Brands that are not on its list.** It knows Google, Microsoft, LinkedIn, Facebook,
  Apple and PayPal. A fake bank or payroll login gets no warning.
- **Pages that ask for a password without imitating a sign-in page.** For example, a plain
  survey form on any site that says "enter your email password to continue" carries none
  of a brand's sign-in wording, so Bouncer has nothing to recognise.
- **Pages that are just a picture.** A page that draws its form on a canvas, or uses fields
  that are not real inputs, may slip past.
- **Company single sign-on pages** (Okta, ADFS and similar), which carry your employer's
  branding, not a listed brand's.
- **Other ways in.** Bouncer does not stop malware, fake phone calls, MFA-fatigue prompts or
  session-cookie theft.

**Bouncer does not replace passkeys or two-factor authentication.** Passkeys are the real
fix, because a passkey refuses to work on the wrong domain at all. Turn them on wherever you
can, and treat Bouncer as a second pair of eyes.

## For developers

```
extension/            the unpacked extension (load this folder)
  manifest.json
  src/brands.js       brand list: real hosts, sign-in wording, brand names
  src/matcher.js      the decision logic (pure functions, no DOM)
  src/content.js      runs in every page: finds fields, locks them, draws the overlay
  src/background.js   toolbar badge
  popup.html, src/popup.js
test/
  matcher.test.mjs    unit tests for the domain check and detection
  e2e.mjs             Playwright: loads the extension, drives the fixture pages
  fixtures/           fake Google, fake Microsoft, subdomain trick, normal site
scripts/
  build_zip.py        builds dist/bouncer.zip
  make_icons.py       draws the icons
```

```bash
npm install            # Playwright, for the end-to-end test only
npm test               # unit tests
npm run e2e            # end-to-end; add -- --skip-real to skip loading accounts.google.com
npm run build          # dist/bouncer.zip
```

The end-to-end test serves the fake pages on look-alike host names, such as
`accounts.google.com.evil.test`, which are mapped to 127.0.0.1 inside the test browser only.
It also loads the real `accounts.google.com` to confirm it is not blocked. It never types
anything into that page.

## How much of this has been tested

- **Google:** tested against local fake pages and against the real `accounts.google.com`,
  which loads with no warning and a green badge.
- **Microsoft, LinkedIn, Facebook, Apple, PayPal:** checked against local test pages and
  unit tests only. Their real sign-in pages have **not** been loaded live with Bouncer yet.
  A real page can differ from a test page; the live Google run is what caught a wording
  difference that the fixtures had missed. If Bouncer ever blocks a genuine sign-in page,
  please open an issue with the page's domain.
- Tested in headless Chromium. Not yet tried by hand in every browser listed above.

## Status

Not on the Chrome Web Store. Install it with Load unpacked, as described above.
