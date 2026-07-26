// ============================================================================
// dashboard-app.js — الهيكل المشترك (Shell) للوحة تحكم SaaS الجديدة.
// كل صفحة داخل /dashboard/*.html تستدعي RB_APP.initShell('pageKey') فقط،
// وهذا الملف يبني الـ Sidebar + الحماية (تسجيل دخول / وجود متجر) + القائمة العلوية.
// ============================================================================

const RB_APP_ICONS = {
  overview: '<path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h6v6h-6z"/>',
  products: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  orders: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  customers: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="18" cy="9" r="2.4"/><path d="M15.5 20c.3-2.7 2-4.6 4-5.2"/>',
  coupons: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z"/><path d="M9 7v14" stroke-dasharray="2 2"/>',
  ratings: '<path d="m12 3 2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.4-4.2 6-.7Z"/>',
  carts: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.6a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6"/>',
  voice: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  staff: '<circle cx="8" cy="8" r="3.2"/><path d="M2 20c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8"/><path d="M18 8v5M15.5 10.5h5"/>',
  analytics: '<path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2 20h20"/>',
  ai: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.2"/>',
  facebook: '<path d="M8 21v-8H5v-4h3V7a5 5 0 0 1 5-5h3v4h-2a1.5 1.5 0 0 0-1.5 1.5V9h3.5l-.5 4H12.5v8"/>',
  notifications: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  billing: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>',
  storeSettings: '<path d="M3 9 12 3l9 6v2H3Z"/><path d="M5 11v8h14v-8"/><path d="M10 19v-5h4v5"/>',
  account: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/>',
  empty: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  warning: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>',
  check: '<path d="m4 12.5 5.5 5.5L20 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.3 12.5 2.6 2.6L16 9.8"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="3.2"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  building: '<path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M15 10h5v11"/><path d="M8 7h2M8 11h2M8 15h2"/><path d="M4 21h16"/>',
  crown: '<path d="m3 8 4 3 5-6 5 6 4-3-2 11H5Z"/>',
  referral: '<circle cx="6" cy="7" r="2.6"/><circle cx="18" cy="7" r="2.6"/><circle cx="12" cy="18" r="2.6"/><path d="M8 8.6 10.5 16M16 8.6 13.5 16"/>',
};

function rbSvg(key, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${RB_APP_ICONS[key] || ''}</svg>`;
}

// كل قسم في الخطة (بند 3) - href, الأيقونة، وهل الصفحة جاهزة فعليًا أو "قيد الإنشاء"
const RB_APP_NAV = [
  { group: null, items: [
    { key: 'overview', href: '/dashboard/overview.html', label: 'نظرة عامة', icon: 'overview', ready: true },
  ]},
  { group: 'المتجر', items: [
    { key: 'products', href: '/dashboard/products.html', label: 'المنتجات', icon: 'products', ready: true },
    { key: 'orders', href: '/dashboard/orders.html', label: 'الطلبات', icon: 'orders', ready: true },
    { key: 'customers', href: '/dashboard/customers.html', label: 'العملاء', icon: 'customers', ready: true },
    { key: 'coupons', href: '/dashboard/coupons.html', label: 'الكوبونات', icon: 'coupons', ready: true },
    { key: 'ratings', href: '/dashboard/ratings.html', label: 'التقييمات', icon: 'ratings', ready: true },
    { key: 'carts', href: '/dashboard/abandoned-carts.html', label: 'السلات المتروكة', icon: 'carts', ready: true, plan: 'Growth+' },
    { key: 'deliveryProviders', href: '/dashboard/delivery-providers.html', label: 'شركات التوصيل', icon: 'building', ready: true },
  ]},
  { group: 'الفريق والذكاء الاصطناعي', items: [
    { key: 'voice', href: '/dashboard/voice-notes.html', label: 'الرسائل الصوتية', icon: 'voice', ready: true, plan: 'Pro+' },
    { key: 'staff', href: '/dashboard/staff.html', label: 'الموظفون', icon: 'staff', ready: true, plan: 'Pro+' },
    { key: 'analytics', href: '/dashboard/analytics.html', label: 'التحليلات الكاملة', icon: 'analytics', ready: true, plan: 'Pro+' },
    { key: 'ai', href: '/dashboard/ai-learning.html', label: 'الذكاء الاصطناعي والتعلّم', icon: 'ai', ready: true },
    { key: 'aiAssistant', href: '/dashboard/ai-assistant.html', label: 'المساعد الذكي والرد الصوتي', icon: 'spark', ready: true },
  ]},
  { group: 'التسويق', items: [
    { key: 'broadcast', href: '/dashboard/broadcast.html', label: 'البث الجماعي', icon: 'notifications', ready: true, plan: 'Pro+' },
  ]},
  { group: 'الأرباح', items: [
    { key: 'referral', href: '/dashboard/referral.html', label: 'برنامج الإحالة', icon: 'referral', ready: true },
  ]},
  { group: 'الإعدادات', items: [
    { key: 'facebook', href: '/dashboard/facebook.html', label: 'ربط فيسبوك ماسنجر', icon: 'facebook', ready: true },
    { key: 'notifications', href: '/dashboard/notifications.html', label: 'الإشعارات', icon: 'notifications', ready: true },
    { key: 'billing', href: '/dashboard/billing.html', label: 'الاشتراك والفوترة', icon: 'billing', ready: true },
    { key: 'storeSettings', href: '/dashboard/store-settings.html', label: 'إعدادات المتجر', icon: 'storeSettings', ready: true },
    { key: 'account', href: '/dashboard/account-settings.html', label: 'إعدادات الحساب', icon: 'account', ready: true },
  ]},
];

const RB_APP = {
  currentUser: null,
  currentStore: null,

  // للصفحات المستقلة بلا Sidebar (مثل create-store.html): تحقق فقط من الجلسة والمتجر
  async checkAuth(opts = {}) {
    let me;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('unauthenticated');
      me = await res.json();
    } catch (e) {
      window.location.href = '/login.html';
      return null;
    }
    this.currentUser = me.user;
    this.currentStore = me.store;

    if (!me.store && !opts.allowNoStore) {
      window.location.href = '/create-store.html';
      return null;
    }
    if (me.store && opts.allowNoStore) {
      window.location.href = '/dashboard/overview.html';
      return null;
    }
    return me;
  },

  // للصفحات الداخلية للوحة التحكم: يبني Sidebar/Topbar كاملين ثم يتحقق من الجلسة
  async initShell(activeKey, opts = {}) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
    this._applyTheme(localStorage.getItem('rb_app_theme') || 'dark');
    this._renderShellSkeleton(activeKey);

    const me = await this.checkAuth(opts);
    if (!me) return null;

    this._wireChrome();
    return me;
  },

  _renderShellSkeleton(activeKey) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    root.innerHTML = `
      <div class="app-shell">
        <aside class="app-sidebar" id="appSidebar">
          <a href="/dashboard/overview.html" class="app-sidebar-brand">
            <img src="/assets/img/logo.svg" alt="" />
            <span>RedonBot</span>
          </a>
          <nav class="app-nav" id="appNav"></nav>
          <div class="app-sidebar-social" id="appSidebarSocial"></div>
          <div class="app-sidebar-foot">
            <a href="/"> ${rbSvg('home')} الرجوع للموقع العام</a>
            <button id="appThemeToggle">${rbSvg(this._isDark() ? 'sun' : 'moon')} <span id="appThemeLabel">${this._isDark() ? 'الوضع النهاري' : 'الوضع الليلي'}</span></button>
            <button id="appLogoutBtn">${rbSvg('logout')} تسجيل الخروج</button>
          </div>
        </aside>
        <div class="app-sidebar-overlay" id="appSidebarOverlay"></div>
        <div class="app-main">
          <header class="app-topbar">
            <div style="display:flex;align-items:center;gap:10px">
              <button class="app-burger" id="appBurger">${rbSvg('menu')}</button>
              <div class="app-topbar-title" id="appPageTitle"></div>
            </div>
            <div class="app-topbar-right" id="appTopbarRight"></div>
          </header>
          <main class="app-page" id="appPageContent"></main>
        </div>
      </div>
    `;

    const navEl = document.getElementById('appNav');
    navEl.innerHTML = RB_APP_NAV.map((section) => `
      <div class="app-nav-group">
        ${section.group ? `<div class="app-nav-label">${section.group}</div>` : ''}
        ${section.items.map((item) => `
          <a href="${item.href}" data-key="${item.key}" class="${item.key === activeKey ? 'active' : ''}">
            ${rbSvg(item.icon)}<span>${item.label}</span>
            ${!item.ready ? '<span class="badge-soon">قريبًا</span>' : ''}
          </a>
        `).join('')}
      </div>
    `).join('');

    const activeItem = RB_APP_NAV.flatMap((s) => s.items).find((i) => i.key === activeKey);
    const titleEl = document.getElementById('appPageTitle');
    if (titleEl && activeItem) titleEl.textContent = activeItem.label;
  },

  _wireChrome() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('appSidebarOverlay');
    const burger = document.getElementById('appBurger');
    if (burger) burger.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('open'); });
    if (overlay) overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });

    const themeBtn = document.getElementById('appThemeToggle');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      const next = this._isDark() ? 'light' : 'dark';
      this._applyTheme(next);
      themeBtn.innerHTML = `${rbSvg(next === 'dark' ? 'sun' : 'moon')} <span id="appThemeLabel">${next === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>`;
    });

    const logoutBtn = document.getElementById('appLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* ignore */ }
      window.location.href = '/login.html';
    });

    this._loadSocialLinks();
  },

  // تابعنا: نفس مصدر البيانات المستعمل فـ الموقع العام (/api/config)، بس بتصميم مصغّر
  // يناسب أسفل الشريط الجانبي للوحة التحكم.
  async _loadSocialLinks() {
    const wrap = document.getElementById('appSidebarSocial');
    if (!wrap) return;
    try {
      const res = await fetch('/api/config');
      const configData = await res.json();
      const links = [
        ['facebook', 'Facebook'],
        ['instagram', 'Instagram'],
        ['tiktok', 'TikTok'],
        ['whatsapp', 'WhatsApp'],
      ].filter(([key]) => configData.social && configData.social[key]);
      if (!links.length) return;
      wrap.innerHTML = `
        <div class="app-nav-label">تابعنا</div>
        <div class="app-social-row">
          ${links.map(([key, label]) => `<a href="${configData.social[key]}" target="_blank" rel="noopener">${label}</a>`).join('')}
        </div>
      `;
    } catch (e) { /* تابعنا ميزة ثانوية - فشلها ما يوقفش باقي لوحة التحكم */ }
  },

  _isDark() {
    return document.getElementById('appRoot').getAttribute('data-app-theme') !== 'light';
  },

  _applyTheme(theme) {
    const root = document.getElementById('appRoot');
    if (root) root.setAttribute('data-app-theme', theme);
    localStorage.setItem('rb_app_theme', theme);
  },

  // بطاقة حالة فارغة موحّدة لكل الصفحات "قيد الإنشاء" (المرحلة القادمة من الخطة)
  renderComingSoon(title, desc) {
    const content = document.getElementById('appPageContent');
    if (!content) return;
    content.innerHTML = `
      <div class="app-empty">
        ${rbSvg('empty')}
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    `;
  },

  svg: rbSvg,

  // ===== Toast notifications (بدل التنقلات/الرسائل المزعجة) =====
  _ensureToastHost() {
    let host = document.getElementById('appToastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'appToastHost';
      host.className = 'app-toast-host';
      document.body.appendChild(host);
    }
    return host;
  },

  toast(message, { type = 'info', duration = 4200 } = {}) {
    const host = this._ensureToastHost();
    const el = document.createElement('div');
    el.className = `app-toast app-toast-${type}`;
    const icon = type === 'success' ? 'checkCircle' : type === 'error' ? 'warning' : 'spark';
    el.innerHTML = `${rbSvg(icon)}<span>${message}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const remove = () => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    };
    el.addEventListener('click', remove);
    setTimeout(remove, duration);
  },

  // ===== نافذة تأكيد عامة (تستبدل confirm() الافتراضي وتستعمل لكل عمليات الحذف/التغيير الحساسة) =====
  // opts: { title, body (HTML), confirmLabel, cancelLabel, danger }
  // ترجع Promise<boolean> - true إذا ضغط المستخدم زر التأكيد
  confirmDialog(opts = {}) {
    const {
      title = '',
      body = '',
      confirmLabel = 'متابعة',
      cancelLabel = 'إلغاء',
      danger = false,
    } = opts;
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'app-modal-overlay';
      overlay.innerHTML = `
        <div class="app-modal" role="dialog" aria-modal="true">
          <div class="app-modal-head">
            <h3>${title}</h3>
            <button class="app-modal-close" aria-label="إغلاق">${rbSvg('close')}</button>
          </div>
          <div class="app-modal-body">${body}</div>
          <div class="app-modal-actions">
            <button class="app-btn app-btn-ghost" data-act="cancel">${cancelLabel}</button>
            <button class="app-btn ${danger ? 'app-btn-danger' : 'app-btn-primary'}" data-act="confirm">${confirmLabel}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));

      const finish = (result) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 150);
        resolve(result);
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(false);
      });
      overlay.querySelector('.app-modal-close').addEventListener('click', () => finish(false));
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(false));
      overlay.querySelector('[data-act="confirm"]').addEventListener('click', () => finish(true));
    });
  },

  // ===== رسالة خطأ احترافية دائمًا (لا تُظهر أبدًا نصوص تقنية خام مثل "Unexpected token" أو
  // "Failed to fetch" للمستخدم). كل أخطاء السيرفر عندنا مكتوبة بالعربية عمدًا، فأي رسالة بلا
  // حروف عربية هي تقنيًا خطأ JS/شبكة/تحليل استجابة - نستبدلها برسالة عامة واضحة. =====
  friendlyError(err, fallback) {
    const generic = fallback || 'حدث خطأ غير متوقع من جهتنا. حاول مرة أخرى بعد قليل.';
    const msg = (err && err.message) || '';
    if (!msg) return generic;
    if (/[\u0600-\u06FF]/.test(msg)) return msg;
    return generic;
  },
};

window.RB_APP = RB_APP;
