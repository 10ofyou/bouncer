// Bouncer service worker. Its only job is the toolbar badge: green on a real
// sign-in page, red when a page was blocked, amber after a manual unlock.
// It makes no network requests.

const RANK = { none: 0, verified: 1, overridden: 2, blocked: 3 };
const LOOK = {
  verified: { text: 'OK', color: '#1e8e3e', title: (m) => `Bouncer: real ${m.brand} sign-in (${m.host})` },
  blocked: { text: '!', color: '#d93025', title: (m) => `Bouncer: blocked a fake ${m.brand} sign-in on ${m.host}` },
  overridden: { text: '!', color: '#f29900', title: (m) => `Bouncer: you unlocked ${m.host} by hand` },
};

const tabs = new Map(); // tabId -> worst status seen in this page load

function paint(tabId, status, msg) {
  const look = LOOK[status];
  if (!look) {
    chrome.action.setBadgeText({ tabId, text: '' });
    chrome.action.setTitle({ tabId, title: 'Bouncer' });
    return;
  }
  chrome.action.setBadgeBackgroundColor({ tabId, color: look.color });
  chrome.action.setBadgeText({ tabId, text: look.text });
  chrome.action.setTitle({ tabId, title: look.title(msg) });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'bouncer-status' || !sender.tab) return;
  const tabId = sender.tab.id;
  const prev = tabs.get(tabId);
  // An unlock replaces that tab's block; otherwise the worst status wins
  // across all frames in the tab.
  const replace = msg.status === 'overridden' || !prev || RANK[msg.status] > RANK[prev.status];
  if (!replace) return;
  tabs.set(tabId, msg);
  paint(tabId, msg.status, msg);
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    tabs.delete(tabId);
    paint(tabId, 'none');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => tabs.delete(tabId));
