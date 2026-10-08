// Unit tests for the domain check and brand detection.
// Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { BRANDS } = require('../extension/src/brands.js');
const { hostAllowed, decide } = require('../extension/src/matcher.js');

const google = BRANDS.find((b) => b.id === 'google').allow;
const linkedin = BRANDS.find((b) => b.id === 'linkedin').allow;

test('real hosts pass', () => {
  for (const h of ['accounts.google.com', 'ACCOUNTS.GOOGLE.COM', 'accounts.google.com.']) {
    assert.equal(hostAllowed(h, google), true, h);
  }
  assert.equal(hostAllowed('www.linkedin.com', linkedin), true);
  assert.equal(hostAllowed('linkedin.com', linkedin), true);
});

test('look-alike hosts fail', () => {
  const fakes = [
    'accounts.google.com.evil.com', // real name as a prefix
    'accounts.sendhighgraph.com', // the live campaign
    'g00gle.com',
    'accounts.g00gle.com',
    'evilaccounts.google.com', // not dot-bounded
    'accounts-google.com',
    'google.com', // the brand's domain, but not a listed sign-in host
    'accounts.xn--ggle-55da.com', // Cyrillic "o" look-alike, as the browser reports it
    'accounts.gооgle.com', // the same look-alike, not yet punycoded
    'xn--accounts-google-com',
    'localhost',
    '127.0.0.1',
    '',
  ];
  for (const h of fakes) assert.equal(hostAllowed(h, google), false, h);
  assert.equal(hostAllowed('linkedin.com.evil.io', linkedin), false);
  assert.equal(hostAllowed('notlinkedin.com', linkedin), false);
});

const page = (o) => ({ title: '', text: '', assets: '', hasCredential: true, hasPassword: false, ...o });

test('fake Google sign-in is blocked', () => {
  const v = decide('accounts.sendhighgraph.com', page({ title: 'Sign in - Google Accounts', text: 'Sign in\nUse your Google Account\nEmail or phone' }));
  assert.equal(v.status, 'blocked');
  assert.equal(v.brand, 'Google');
});

test('fake Microsoft sign-in is blocked', () => {
  const v = decide('login.micros0ftonline.com', page({ title: 'Sign in to your account', text: 'Sign in\nEmail, phone, or Skype\nNo account? Create one!' }));
  assert.equal(v.status, 'blocked');
  assert.equal(v.brand, 'Microsoft');
});

test('same page on the real host is verified', () => {
  const v = decide('accounts.google.com', page({ title: 'Sign in - Google Accounts', text: 'Use your Google Account' }));
  assert.equal(v.status, 'verified');
});

test('brand signal without a credential field does nothing', () => {
  const v = decide('example.com', page({ hasCredential: false, title: 'Sign in - Google Accounts', text: 'Use your Google Account' }));
  assert.equal(v.status, 'none');
});

test('"Sign in with Google" button on a normal site is left alone', () => {
  const v = decide('shop.example.com', page({
    title: 'Example Shop - Log in',
    text: 'Log in to Example Shop\nEmail\nPassword\nor\nSign in with Google\nContinue with Microsoft\nContinue with Apple',
    assets: 'https://shop.example.com/logo.png',
    hasPassword: true,
  }));
  assert.equal(v.status, 'none');
});

test('weak signals alone need a password field and three sources', () => {
  const weak = { title: 'Google', text: 'Google\nSign in', assets: 'googlelogo_color_272x92dp.png' };
  assert.equal(decide('x.example', page({ ...weak, hasPassword: true })).status, 'blocked');
  assert.equal(decide('x.example', page({ ...weak, hasPassword: false })).status, 'none');
  assert.equal(decide('x.example', page({ ...weak, assets: '', hasPassword: true })).status, 'none');
});

test('a news article about Google with a newsletter box is left alone', () => {
  const v = decide('news.example', page({
    title: 'Google announces new Pixel phones',
    text: 'Google said on Tuesday... Subscribe to our newsletter',
    assets: 'google-pixel-hero.jpg',
    hasPassword: false,
  }));
  assert.equal(v.status, 'none');
});

test('wording split across lines still matches (copied real Google page)', () => {
  const v = decide('accounts.sendhighgraph.com', page({ title: 'Sign in - Google Accounts', text: 'Sign in\n\nwith your Google Account. This account will be available' }));
  assert.equal(v.status, 'blocked');
  const v2 = decide('accounts.sendhighgraph.com', page({ title: 'Welcome', text: 'Sign in\n\nwith your Google Account.' }));
  assert.equal(v2.status, 'blocked');
});
