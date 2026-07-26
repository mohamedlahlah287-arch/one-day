(function () {
  const createSection = document.getElementById('createSection');
  const lookupSection = document.getElementById('lookupSection');
  const panelSection = document.getElementById('panelSection');

  let currentStoreId = localStorage.getItem('rb_storeId') || null;

  function showCreate() {
    createSection.classList.remove('hidden');
    lookupSection.classList.add('hidden');
    panelSection.style.display = 'none';
  }
  function showLookup() {
    lookupSection.classList.remove('hidden');
    createSection.classList.add('hidden');
    panelSection.style.display = 'none';
  }
  function showPanel() {
    createSection.classList.add('hidden');
    lookupSection.classList.add('hidden');
    panelSection.style.display = 'block';
  }

  document.getElementById('goToLookup').addEventListener('click', showLookup);
  document.getElementById('goToCreate').addEventListener('click', showCreate);
  document.getElementById('logoutPanel').addEventListener('click', () => {
    localStorage.removeItem('rb_storeId');
    currentStoreId = null;
    showLookup();
  });

  // ===== إنشاء متجر جديد =====
  document.getElementById('createBtn').addEventListener('click', async () => {
    const storeName = document.getElementById('newStoreName').value.trim();
    const telegramId = document.getElementById('newTelegramId').value.trim();
    const errBox = document.getElementById('createErr');
    const msgBox = document.getElementById('createMsg');
    const linkBox = document.getElementById('telegramLinkBox');
    errBox.textContent = '';
    msgBox.textContent = '';
    linkBox.innerHTML = '';

    if (storeName.length < 2) {
      errBox.textContent = 'أدخل اسم متجر صحيح (حرفين على الأقل).';
      return;
    }

    try {
      const res = await fetch('/api/store/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, telegramId }),
      });
      const data = await res.json();
      if (!res.ok) {
        errBox.textContent = data.error || 'حدث خطأ، حاول مرة أخرى.';
        return;
      }
      if (data.alreadyExists) {
        localStorage.setItem('rb_storeId', data.storeId);
        currentStoreId = data.storeId;
        msgBox.textContent = 'عندك متجر مسجل بهذا المعرف بالفعل - جاري فتح لوحة التحكم...';
        return loadPanel(data.storeId);
      }
      if (data.telegramLink) {
        msgBox.textContent = '✅ خطوة أخيرة: افتح الرابط تحت وفعّل "ابدأ" فـ تيليغرام لتأكيد هويتك.';
        linkBox.innerHTML = `<a class="btn" href="${data.telegramLink}" target="_blank">فتح تيليغرام لتأكيد الهوية ✅</a>`;
      } else {
        msgBox.textContent = 'تم إنشاء طلب التسجيل، لكن تعذّر توليد رابط تيليغرام تلقائيًا. تواصل مع الإدارة.';
      }
    } catch (err) {
      errBox.textContent = 'تعذر الاتصال بالخادم، حاول مرة أخرى.';
    }
  });

  // ===== الدخول لمتجر موجود =====
  document.getElementById('lookupBtn').addEventListener('click', async () => {
    const storeId = document.getElementById('lookupStoreId').value.trim();
    const errBox = document.getElementById('lookupErr');
    errBox.textContent = '';
    if (!storeId) return;
    localStorage.setItem('rb_storeId', storeId);
    currentStoreId = storeId;
    const ok = await loadPanel(storeId);
    if (!ok) errBox.textContent = 'لم نجد متجرًا بهذا المعرف.';
  });

  async function loadPanel(storeId) {
    try {
      const res = await fetch('/api/store/' + encodeURIComponent(storeId));
      if (!res.ok) return false;
      const store = await res.json();
      renderPanel(store);
      showPanel();
      return true;
    } catch (err) {
      return false;
    }
  }

  function renderPanel(store) {
    document.getElementById('panelStoreName').textContent = '🏪 ' + (store.storeName || '—');
    const statusMap = {
      active: ['ok', 'نشط'],
      trial: ['warn', 'تجريبي'],
      expired: ['off', 'منتهي'],
    };
    const [cls, label] = statusMap[store.subscriptionStatus] || ['off', store.subscriptionStatus || '—'];
    const statusEl = document.getElementById('panelStatus');
    statusEl.textContent = label;
    statusEl.className = 'status ' + cls;
    document.getElementById('panelPlan').textContent = store.planName || '—';
    const expires = store.subscriptionExpiresAt
      ? new Date(store.subscriptionExpiresAt._seconds ? store.subscriptionExpiresAt._seconds * 1000 : store.subscriptionExpiresAt).toLocaleDateString('ar')
      : '-';
    document.getElementById('panelExpires').textContent = expires;

    renderChannel(store.notificationChannel || 'telegram', store.id);
  }

  function renderChannel(channel, storeId) {
    const tgBtn = document.getElementById('channelTelegram');
    const webBtn = document.getElementById('channelWeb');
    tgBtn.classList.toggle('active', channel === 'telegram');
    webBtn.classList.toggle('active', channel === 'web');
    document.getElementById('notifCard').style.display = channel === 'web' ? 'block' : 'none';
    if (channel === 'web') loadNotifications(storeId);

    tgBtn.onclick = () => updateChannel(storeId, 'telegram');
    webBtn.onclick = () => updateChannel(storeId, 'web');
  }

  async function updateChannel(storeId, channel) {
    const errBox = document.getElementById('settingsErr');
    const msgBox = document.getElementById('settingsMsg');
    errBox.textContent = '';
    msgBox.textContent = '';
    try {
      const res = await fetch('/api/store/' + encodeURIComponent(storeId) + '/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationChannel: channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        errBox.textContent = data.error || 'تعذر تحديث الإعدادات.';
        return;
      }
      renderChannel(data.notificationChannel, storeId);
      msgBox.textContent = '✅ تم الحفظ.';
    } catch (err) {
      errBox.textContent = 'تعذر الاتصال بالخادم.';
    }
  }

  async function loadNotifications(storeId) {
    const list = document.getElementById('notifList');
    list.innerHTML = '<p class="muted">جاري التحميل...</p>';
    try {
      const res = await fetch('/api/store/' + encodeURIComponent(storeId) + '/notifications');
      const data = await res.json();
      const notifications = data.notifications || [];
      if (notifications.length === 0) {
        list.innerHTML = '<p class="muted">لا توجد إشعارات بعد.</p>';
        return;
      }
      list.innerHTML = notifications.map((n) => `<div class="notif-item">${escapeHtml(n.message || '')}</div>`).join('');
    } catch (err) {
      list.innerHTML = '<p class="muted">تعذر تحميل الإشعارات.</p>';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== نقطة الانطلاق =====
  if (currentStoreId) {
    loadPanel(currentStoreId).then((ok) => {
      if (!ok) showCreate();
    });
  } else {
    showCreate();
  }
})();
