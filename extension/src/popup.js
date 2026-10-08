// Toolbar popup: lists the brands Bouncer knows and the local unlock log.
const brandList = document.getElementById('brands');
for (const b of globalThis.BouncerBrands.BRANDS) {
  const li = document.createElement('li');
  li.textContent = `${b.name}: ${b.allow.join(', ')}`;
  brandList.append(li);
}

const log = document.getElementById('log');
const clear = document.getElementById('clear');

function render(entries) {
  if (!entries.length) return;
  log.textContent = '';
  for (const e of entries.slice().reverse().slice(0, 20)) {
    const li = document.createElement('li');
    const when = new Date(e.at).toLocaleString();
    li.innerHTML = '<span class="mono"></span> <span class="muted"></span>';
    li.children[0].textContent = e.host;
    li.children[1].textContent = `(said ${e.brand}, ${when})`;
    log.append(li);
  }
  clear.hidden = false;
}

chrome.storage.local.get({ overrides: [] }, (r) => render(r.overrides || []));
clear.addEventListener('click', () => {
  chrome.storage.local.set({ overrides: [] }, () => {
    log.innerHTML = '<li class="muted">None.</li>';
    clear.hidden = true;
  });
});
