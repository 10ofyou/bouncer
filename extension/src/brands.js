// Bouncer brand list. Each brand says where its real sign-in pages live and
// what a page looks like when it is pretending to be that brand's sign-in.
//
// allow:  real hosts. A page is "on the list" when its hostname equals an
//         entry or ends with "." + entry. Nothing else matches - no fuzzy
//         matching, no Unicode normalization, no "close enough".
// strong: phrases or titles that only a sign-in page for this brand uses.
//         One strong hit plus any credential field is enough to act.
// tokens: the brand's plain names. Weak evidence, only counted when the page
//         also has a password field (see matcher.js).
(function (root) {
  const BRANDS = [
    {
      id: 'google',
      name: 'Google',
      allow: [
        'accounts.google.com',
        'myaccount.google.com',
        'accounts.youtube.com',
        'gds.google.com',
      ],
      strongText: [
        /use your google account/i,
        /sign in with your google account/i,
        /(sign in )?to continue to (gmail|google|google drive|google calendar|google docs|youtube|google voice)\b/i,
        /forgot email\?[\s\S]{0,200}create account/i,
      ],
      strongTitle: [
        /sign in\s*[-\u2013\u2014|:]\s*google accounts/i,
        /^\s*google accounts\s*$/i,
        /^\s*gmail\s*$/i,
        /^\s*sign in\s*[-\u2013\u2014|:]\s*google\s*$/i,
      ],
      tokens: [/\bgoogle\b/i, /\bgmail\b/i],
    },
    {
      id: 'microsoft',
      name: 'Microsoft',
      allow: [
        'login.microsoftonline.com',
        'login.microsoft.com',
        'login.live.com',
        'account.live.com',
        'account.microsoft.com',
        'login.windows.net',
        'login.microsoftonline.us',
      ],
      strongText: [
        /sign in to (outlook|office|office 365|microsoft 365|onedrive|teams|your microsoft account|microsoft)\b/i,
        /use your microsoft account/i,
        /no account\? create one/i,
        /email, phone, or skype/i,
      ],
      strongTitle: [
        /sign in to (outlook|your microsoft account|microsoft|office)/i,
        /^\s*microsoft account\s*$/i,
      ],
      tokens: [/\bmicrosoft\b/i, /\boutlook\b/i, /\boffice ?365\b/i, /\bonedrive\b/i, /\bsharepoint\b/i],
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      allow: ['linkedin.com'],
      strongText: [
        /sign in to linkedin/i,
        /stay updated on your professional world/i,
        /new to linkedin\?/i,
      ],
      strongTitle: [/linkedin login/i, /sign in\s*\|\s*linkedin/i],
      tokens: [/\blinkedin\b/i],
    },
    {
      id: 'facebook',
      name: 'Facebook',
      allow: ['facebook.com', 'messenger.com'],
      strongText: [
        /log ?in(to| to) facebook/i,
        /connect with friends and the world around you on facebook/i,
      ],
      strongTitle: [/facebook\s*[-\u2013\u2014|]\s*log ?in/i, /log ?in(to| to) facebook/i],
      tokens: [/\bfacebook\b/i],
    },
    {
      id: 'apple',
      name: 'Apple',
      allow: ['appleid.apple.com', 'account.apple.com', 'idmsa.apple.com', 'icloud.com'],
      strongText: [
        /sign in with your apple (id|account)/i,
        /sign in to (icloud|apple account|your apple account)/i,
        /manage your apple (id|account)/i,
      ],
      strongTitle: [/^\s*(sign in\s*[-\u2013\u2014|]\s*)?(apple id|apple account|icloud)\s*$/i],
      tokens: [/\bapple id\b/i, /\bicloud\b/i, /\bapple account\b/i],
    },
    {
      id: 'paypal',
      name: 'PayPal',
      allow: ['paypal.com'],
      strongText: [/log in to your paypal account/i],
      strongTitle: [/log in to your paypal account/i],
      tokens: [/\bpaypal\b/i],
    },
  ];

  // "Sign in with Google" style buttons on third-party sites name a brand
  // without pretending to be it. This text is removed before weak-token
  // counting so those pages are left alone.
  const FEDERATED_PHRASE =
    /\b(sign ?(in|up)|log ?in|continue|connect|register|join|login)\s+(with|using|via|through)\s+(google|microsoft|apple|facebook|linkedin|paypal|outlook)\b/gi;

  const api = { BRANDS, FEDERATED_PHRASE };
  root.BouncerBrands = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
