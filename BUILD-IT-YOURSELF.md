# Build your own Bouncer

Bouncer is a small browser extension that stops you from typing your password into a fake
sign-in page. If a page looks like a Google or Microsoft login but is really on some other
website, Bouncer locks the boxes and tells you so.

You don't need to know how to code to build one. Copy the prompt below into an AI
assistant that can write code (ChatGPT, Claude, Gemini or similar), follow its steps, and
you'll have your own copy running in Chrome in about half an hour.

## How to use this

1. Copy everything inside the box below.
2. Paste it into your AI assistant as one message.
3. It will give you several files. Make a new folder on your computer called `bouncer` and
   save each file into it with exactly the name the AI gives it.
4. Install it, using the steps at the bottom of this page.
5. Try it out. If something does not work, tell the AI what you saw and ask it to fix it.

---

```text
Please build me a Chrome extension called "Bouncer" (Manifest V3). I am not a developer,
so give me every file in full, tell me exactly what to name each one, and then tell me
step by step how to load it into Chrome.

WHAT IT DOES
Bouncer stops me from typing my password into a fake sign-in page. If a page pretends to be
a sign-in page for Google, Microsoft, LinkedIn, Facebook, Apple or PayPal, Bouncer checks
the page's real domain. If that domain is not one of the brand's real sign-in domains, it
locks the email and password boxes and covers the page with a warning.

HOW IT SHOULD DECIDE
1. A content script runs on every page, from as early as possible.
2. It only acts when BOTH of these are true:
   a. The page has a credential field: an input of type password or email, or a text input
      whose autocomplete, name, id or placeholder says email, username or login.
   b. The page shows a strong sign of pretending to be one of the brands. Use wording that
      only a real sign-in page uses, for example "Use your Google Account", "Sign in with
      your Google Account", "to continue to Gmail", "Sign in to Outlook", "No account?
      Create one!", "Email, phone, or Skype", "Sign in to LinkedIn", "Log in to Facebook",
      or page titles such as "Sign in - Google Accounts". The brand's logo (image alt text,
      file name) and favicon can add weight, but logos alone are not enough.
   Collapse all whitespace before matching the wording, because real pages split phrases
   across lines.
3. Do NOT treat a "Sign in with Google" or "Continue with Microsoft" button on someone
   else's site as pretending. Remove phrases like "sign in with X" and "continue with X"
   before looking for brand names, and ignore logos that sit inside links or buttons.
4. Keep a hardcoded list of each brand's real sign-in hosts, for example:
   - Google: accounts.google.com, myaccount.google.com, accounts.youtube.com
   - Microsoft: login.microsoftonline.com, login.microsoft.com, login.live.com,
     account.live.com, account.microsoft.com
   - LinkedIn: linkedin.com
   - Facebook: facebook.com
   - Apple: appleid.apple.com, account.apple.com, idmsa.apple.com, icloud.com
   - PayPal: paypal.com
5. Compare the page's hostname with the list like this, and no other way:
   - Lowercase it and drop a trailing dot.
   - If it contains anything other than plain a-z, 0-9, dots and hyphens, it FAILS.
   - It PASSES only if it equals a listed host exactly, or ends with "." plus a listed host.
   - So "accounts.google.com.evil.com" FAILS, "g00gle.com" FAILS, "accounts-google.com"
     FAILS, and look-alike domains using foreign letters (which the browser shows starting
     with "xn--") FAIL. Never convert or "normalise" a look-alike domain toward the real
     brand. Never use fuzzy matching.
6. If the page is on the real host, do nothing. If it is pretending and the host fails:
   - Clear and disable every credential field.
   - Add capturing listeners on window for keydown, keypress, keyup, beforeinput, input,
     paste and drop that cancel the event and clear the value when the target is a
     credential field, so typing and pasting do nothing even if the page re-enables a field.
   - Cancel every form submit with a capturing listener.
   - Show a full-page overlay (fixed position, highest z-index, inside a shadow root so the
     page's styles can't break it) that says exactly:
       "Not on the list. This page says it's <Brand>, but it's really <actual hostname>."
     Include a "Get me out of here" button that goes back, or opens a blank page.
7. Many phishing kits add the form after the page loads, so use a MutationObserver to
   re-check when the page changes. Once a page is blocked, lock new fields immediately.
8. No casual bypass. Put the override behind a collapsed "I trust this site anyway"
   section where I must type the page's exact domain to unlock it for this visit only.
   Save each unlock (time, domain, brand) to chrome.storage.local, and show that list in
   the toolbar popup.
9. Toolbar badge, set per tab from a background service worker: green "OK" on a real
   sign-in page, red "!" when blocked, amber "!" after a manual unlock. Clear it when the
   tab starts loading a new page.

PRIVACY RULES (MUST FOLLOW)
- No network requests of any kind. No analytics, no telemetry, no remote config, no
  external fonts or scripts. Nothing I type may leave the browser.
- Add a content security policy for extension pages that includes connect-src 'none'.
- Only these permissions: the content script on <all_urls>, and "storage". Nothing else.
  Explain why each is needed.
- Do not put "Chrome" or "Google" in the extension's name.

ALSO GIVE ME
- Simple icons (16, 32, 48 and 128 pixels). A small script that draws them is fine, or tell
  me how to make them.
- A test page I can save and open: a fake "Sign in - Google Accounts" page with an email and
  password box, so I can see Bouncer block it. Tell me how to view it through a local
  address (for example `python3 -m http.server`), because extensions don't run on plain
  files unless I turn that on.
- Step-by-step install instructions: chrome://extensions, turn on Developer mode, click
  Load unpacked, and pick the folder.
- A short list of what this does NOT protect against.
```

---

## Install it

1. Put all the files in one folder, for example `bouncer`, with `manifest.json` directly
   inside it.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose your `bouncer` folder.
5. Click the puzzle-piece icon and pin Bouncer so you can see its badge.

Edge, Brave and Arc work the same way.

## Check it works

- Open your test page through the local address the AI gave you. You should see
  "Not on the list." and the boxes should refuse typing.
- Go to a normal site that has a "Sign in with Google" button. Nothing should happen.
- Go to `accounts.google.com`. The badge should show a green OK and nothing should be
  blocked. You don't need to sign in to check this.

## Good to know

- Bouncer only knows the brands on its list. Ask your AI to add more (your bank, your
  payroll site), giving it the exact domains you sign in on.
- Bouncer is a second pair of eyes, not a replacement for real security. Turn on
  **passkeys** and **two-factor authentication** for your important accounts. A passkey
  refuses to work on a fake domain at all, which makes it the strongest protection there is.
