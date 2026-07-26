let meData = null;

async function loadMe() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) { window.location.href = '/login.html'; return; }
    meData = await res.json();
    renderAll();
  } catch (e) {
    window.location.href = '/login.html';
  }
}

function renderAll() {
  const t = window.rbT;
  if (!meData) return;
  const { user, store, telegramLinked } = meData;

  document.getElementById('dashUserName').textContent = user.fullName || user.email;
  document.getElementById('dashUserEmail').textContent = user.email;
  const avatarEl = document.getElementById('dashAvatar');
  avatarEl.innerHTML = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="">`
    : (user.fullName ? user.fullName[0].toUpperCase() : '👤');

  renderStoreCard(store);
  renderFacebookCard(store);
  renderTelegramCard(telegramLinked);
}

function renderCreateStoreForm() {
  const t = window.rbT;
  const el = document.getElementById('storeCardBody');
  el.innerHTML = `
    <p style="color:var(--muted);font-size:.9rem;margin:0 0 12px">${t('createStoreDesc')}</p>
    <input type="text" id="newStoreNameInput" placeholder="${t('storeNamePlaceholder')}" class="dash-input" style="width:100%;box-sizing:border-box;margin-bottom:8px" />
    <input type="tel" id="newStorePhoneInput" placeholder="${t('phonePlaceholder')}" class="dash-input" style="width:100%;box-sizing:border-box;margin-bottom:12px" />
    <button class="btn btn-primary" id="createStoreBtn" style="width:100%">${t('createStoreBtn')}</button>
    <div id="createStoreMsg" style="margin-top:10px;font-size:.85rem"></div>
  `;
  document.getElementById('createStoreBtn').addEventListener('click', async () => {
    const btn = document.getElementById('createStoreBtn');
    const msgBox = document.getElementById('createStoreMsg');
    const storeName = document.getElementById('newStoreNameInput').value.trim();
    const contactPhone = document.getElementById('newStorePhoneInput').value.trim();
    msgBox.textContent = '';
    if (storeName.length < 2) {
      msgBox.innerHTML = `<span class="store-err">${t('storeNamePlaceholder')}</span>`;
      return;
    }
    btn.disabled = true;
    btn.textContent = t('creatingStore');
    try {
      const res = await fetch('/api/auth/store/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ storeName, contactPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        msgBox.innerHTML = `<span class="store-err">${data.error}</span>`;
        btn.disabled = false;
        btn.textContent = t('createStoreBtn');
        return;
      }
      await loadMe();
    } catch (e) {
      msgBox.innerHTML = `<span class="store-err">error</span>`;
      btn.disabled = false;
      btn.textContent = t('createStoreBtn');
    }
  });
}

function renderStoreCard(store) {
  const t = window.rbT;
  const el = document.getElementById('storeCardBody');
  if (!store) {
    renderCreateStoreForm();
    return;
  }
  const statusMap = { active: ['ok', t('statusActive')], trial: ['warn', t('statusTrial')], expired: ['off', t('statusExpired')] };
  const [cls, label] = statusMap[store.subscriptionStatus] || ['off', store.subscriptionStatus];
  const expires = store.subscriptionExpiresAt
    ? new Date(store.subscriptionExpiresAt._seconds ? store.subscriptionExpiresAt._seconds * 1000 : store.subscriptionExpiresAt).toLocaleDateString()
    : '-';
  const msg = store.messageLimit === null || store.messageLimit === undefined ? `${store.messageCount || 0}` : `${store.messageCount || 0} / ${store.messageLimit}`;
  el.innerHTML = `
    <div class="dash-row"><span>${store.storeName}</span><span class="dash-status ${cls}">${label}</span></div>
    <div class="dash-row"><span>${t('planLabel')}</span><span>${store.planName || '-'}</span></div>
    <div class="dash-row"><span>${t('messagesLabel')}</span><span>${msg}</span></div>
    <div class="dash-row"><span>${t('expiresLabel')}</span><span>${expires}</span></div>
  `;
}

function renderFacebookCard(store) {
  const t = window.rbT;
  const el = document.getElementById('fbCardBody');
  if (!store) {
    el.innerHTML = `<p style="color:var(--muted);font-size:.85rem">${t('fbNeedStoreFirst')}</p>`;
    return;
  }
  if (store.facebookConnected && store.facebookPageId) {
    el.innerHTML = `<span class="dash-status ok">${t('fbConnected')}</span>`;
    return;
  }
  el.innerHTML = `<button class="btn btn-primary" id="connectFbBtn">${t('connectFbBtn')}</button><div id="fbLinkResult" style="margin-top:10px"></div>`;
  document.getElementById('connectFbBtn').addEventListener('click', async () => {
    const box = document.getElementById('fbLinkResult');
    box.textContent = '...';
    try {
      const res = await fetch('/api/auth/connect-facebook', { method: 'POST', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) { box.innerHTML = `<span class="store-err">${data.error}</span>`; return; }
      box.innerHTML = `<a class="btn btn-ghost" href="${data.connectUrl}" target="_blank">${t('openFbLink')}</a>`;
    } catch (e) { box.innerHTML = `<span class="store-err">error</span>`; }
  });
}

function renderTelegramCard(telegramLinked) {
  const t = window.rbT;
  const el = document.getElementById('tgCardBody');
  if (telegramLinked) {
    el.innerHTML = `<span class="dash-status ok">${t('fbConnected')}</span>`;
    return;
  }
  el.innerHTML = `<button class="btn btn-primary" id="linkTgBtn">${t('linkTelegramBtn')}</button><div id="tgLinkResult" class="dash-link-box"></div>`;
  document.getElementById('linkTgBtn').addEventListener('click', async () => {
    const box = document.getElementById('tgLinkResult');
    box.textContent = '...';
    try {
      const res = await fetch('/api/auth/link-telegram', { method: 'POST', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) { box.innerHTML = `<span class="store-err">${data.error}</span>`; return; }
      box.innerHTML = `<a class="btn btn-primary" href="${data.telegramLink}" target="_blank">${t('openTelegramBtn')}</a>`;
    } catch (e) { box.innerHTML = `<span class="store-err">error</span>`; }
  });
}

document.getElementById('logoutLink').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/login.html';
});

window.rbOnLangChange = () => renderAll();
document.addEventListener('DOMContentLoaded', loadMe);
