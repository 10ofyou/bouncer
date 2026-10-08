// End-to-end test: loads the unpacked extension in Chromium with Playwright,
// serves the fixtures on look-alike host names (mapped to 127.0.0.1 inside
// the browser only), and checks what Bouncer does on each.
//
// Run: npm run e2e        (add --skip-real to skip the live accounts.google.com check)
//
// No credentials are ever typed into the real Google page; it is only loaded
// and inspected.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'extension');
const SHOTS = path.join(ROOT, 'test-results');
const SKIP_REAL = process.argv.includes('--skip-real');
mkdirSync(SHOTS, { recursive: true });

const FAKE_HOSTS = [
  'accounts.sendhighgraph.test', // stand-in for the live campaign's host
  'login.micros0ftonline.test',
  'accounts.google.com.evil.test', // real host name used as a prefix
  'accounts.xn--ggle-55da.test', // punycode look-alike ("goоgle" with a Cyrillic o)
  'shop.example.test',
];

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures++;
}

const { server, port, hits } = await startServer();
const rules = FAKE_HOSTS.map((h) => `MAP ${h} 127.0.0.1`).join(', ');
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--host-resolver-rules=${rules}`],
});

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const page = ctx.pages()[0] || (await ctx.newPage());

const badge = () => sw.evaluate(async () => {
  const [tab] = await chrome.tabs.query({});
  return chrome.action.getBadgeText({ tabId: tab.id });
});
const overlayText = () => page.evaluate(() => {
  const host = document.getElementById('bouncer-overlay-host');
  if (!host || !host.isConnected || !host.shadowRoot) return null;
  return host.shadowRoot.querySelector('[data-bouncer-message]').textContent;
});
const settle = () => page.waitForTimeout(1200);

async function expectBlocked(label, url, brand, host) {
  await page.goto(url);
  await settle();
  const text = await overlayText();
  const want = `This page says it's ${brand}, but it's really ${host}.`;
  check(`${label}: overlay shown`, text === want, text === null ? 'no overlay' : JSON.stringify(text));
  const fields = await page.$$eval('input[type=email], input[type=password]', (els) => els.map((e) => e.disabled));
  check(`${label}: credential fields disabled`, fields.length > 0 && fields.every(Boolean), `${fields.length} fields`);

  // A kit could re-enable its own fields; keystrokes must still be swallowed.
  await page.evaluate(() => document.querySelectorAll('input').forEach((i) => { i.disabled = false; i.readOnly = false; }));
  const sel = (await page.$('input[type=email]')) ? 'input[type=email]' : 'input[type=password]';
  await page.focus(sel).catch(() => {});
  await page.keyboard.type('victim@example.com');
  await page.keyboard.insertText('pasted-secret'); // the input path a paste takes
  const value = await page.$eval(sel, (e) => e.value);
  check(`${label}: typing and inserted text swallowed`, value === '', JSON.stringify(value));

  const before = hits.length;
  await page.evaluate(() => { const f = document.querySelector('form'); if (f) f.requestSubmit(); });
  await page.waitForTimeout(500);
  check(`${label}: form submission blocked`, hits.length === before && page.url() === url, `${hits.length - before} POSTs`);
  check(`${label}: badge red "!"`, (await badge()) === '!', JSON.stringify(await badge()));
  await page.screenshot({ path: path.join(SHOTS, `${label.replace(/\W+/g, '-')}.png`) });
}

try {
  const base = (h) => `http://${h}:${port}`;

  // 1. The campaign: fake Google page, form injected 700 ms after load.
  await expectBlocked('fake Google (late form)', `${base('accounts.sendhighgraph.test')}/fake-google.html`, 'Google', 'accounts.sendhighgraph.test');
  // 2. Fake Microsoft.
  await expectBlocked('fake Microsoft', `${base('login.micros0ftonline.test')}/fake-microsoft.html`, 'Microsoft', 'login.micros0ftonline.test');
  // 3. Subdomain trick.
  await expectBlocked('subdomain trick', `${base('accounts.google.com.evil.test')}/subdomain-trick.html`, 'Google', 'accounts.google.com.evil.test');
  // 4. Punycode look-alike.
  await expectBlocked('punycode look-alike', `${base('accounts.xn--ggle-55da.test')}/fake-google.html`, 'Google', 'accounts.xn--ggle-55da.test');

  // 5. Normal site with "Sign in with Google": untouched.
  await page.goto(`${base('shop.example.test')}/normal-signin-with-google.html`);
  await settle();
  check('normal page: no overlay', (await overlayText()) === null);
  await page.fill('input[type=email]', 'me@example.com');
  check('normal page: typing works', (await page.inputValue('input[type=email]')) === 'me@example.com');
  check('normal page: no badge', (await badge()) === '', JSON.stringify(await badge()));

  // 6. Deliberate unlock: wrong domain refused, exact domain accepted and logged.
  const fakeUrl = `${base('accounts.sendhighgraph.test')}/fake-google.html`;
  await page.goto(fakeUrl);
  await settle();
  const unlock = (text) => page.evaluate((t) => {
    const r = document.getElementById('bouncer-overlay-host').shadowRoot;
    r.querySelector('details').open = true;
    r.querySelector('details input').value = t;
    r.querySelector('.unlock').click();
  }, text);
  await unlock('accounts.google.com');
  check('unlock: wrong domain refused', (await overlayText()) !== null);
  await unlock('accounts.sendhighgraph.test');
  await page.waitForTimeout(300);
  check('unlock: exact domain accepted', (await overlayText()) === null);
  check('unlock: fields re-enabled', await page.$eval('input[type=email]', (e) => !e.disabled));
  const log = await sw.evaluate(() => chrome.storage.local.get('overrides'));
  const last = (log.overrides || []).at(-1);
  check('unlock: logged locally', !!last && last.host === 'accounts.sendhighgraph.test', JSON.stringify(last));
  check('unlock: badge amber "!"', (await badge()) === '!');

  // 7. The real Google sign-in must not be blocked. Load and look only.
  if (SKIP_REAL) {
    results.push('SKIP  real accounts.google.com (--skip-real)');
  } else {
    await page.goto('https://accounts.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const field = '#identifierId, input[type=email]';
    await page.waitForSelector(field, { timeout: 20000 });
    await settle();
    const host = new URL(page.url()).hostname;
    check('real Google: landed on accounts.google.com', host === 'accounts.google.com', host);
    check('real Google: no overlay', (await overlayText()) === null);
    check('real Google: email field usable', await page.$eval(field, (e) => !e.disabled));
    check('real Google: badge green "OK"', (await badge()) === 'OK', JSON.stringify(await badge()));
    await page.screenshot({ path: path.join(SHOTS, 'real-google.png') });
  }

  check('no POST ever reached the fixture server', hits.length === 0, `${hits.length} POSTs`);
} catch (e) {
  check('test run completed', false, e.message.split('\n')[0]);
} finally {
  await ctx.close();
  server.close();
}

console.log(results.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
