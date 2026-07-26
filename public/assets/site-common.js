// ===== اللغات المتاحة في المنصة (10 لغات) — كل صفحة يمكنها إضافة قاموسها الخاص عبر window.RB_EXTRA_I18N =====
const RB_LANGS = [
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'en', label: 'English', rtl: false },
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'es', label: 'Español', rtl: false },
  { code: 'de', label: 'Deutsch', rtl: false },
  { code: 'it', label: 'Italiano', rtl: false },
  { code: 'pt', label: 'Português', rtl: false },
  { code: 'tr', label: 'Türkçe', rtl: false },
  { code: 'ru', label: 'Русский', rtl: false },
  { code: 'zh', label: '中文', rtl: false },
];
window.RB_LANGS = RB_LANGS;

// ===== قاموس مشترك بين كل صفحات الموقع =====
const RB_COMMON_I18N = {
  ar: {
    brandName: 'RedonBot',
    navHome: 'الرئيسية', navAbout: 'عن المنصة', navFeatures: 'المميزات', navPricing: 'الأسعار',
    navLogin: 'تسجيل الدخول', navSignup: 'إنشاء حساب', navDashboard: 'لوحة التحكم', navLogout: 'تسجيل الخروج',
    followUs: 'تابعنا', darkMode: 'الوضع الليلي', lightMode: 'الوضع النهاري', ctaSubscribe: 'اشترك الآن',
    footerTag: 'منصة ذكاء اصطناعي للتجارة عبر المحادثات',
    genericError: 'حدث خطأ، حاول مرة أخرى.',
  },
  en: {
    brandName: 'RedonBot',
    navHome: 'Home', navAbout: 'About', navFeatures: 'Features', navPricing: 'Pricing',
    navLogin: 'Log in', navSignup: 'Sign up', navDashboard: 'Dashboard', navLogout: 'Log out',
    followUs: 'Follow us', darkMode: 'Dark mode', lightMode: 'Light mode', ctaSubscribe: 'Get started',
    footerTag: 'The AI platform for conversational commerce',
    genericError: 'Something went wrong, please try again.',
  },
  fr: {
    brandName: 'RedonBot',
    navHome: 'Accueil', navAbout: 'La plateforme', navFeatures: 'Fonctionnalités', navPricing: 'Tarifs',
    navLogin: 'Connexion', navSignup: 'Créer un compte', navDashboard: 'Tableau de bord', navLogout: 'Déconnexion',
    followUs: 'Suivez-nous', darkMode: 'Mode sombre', lightMode: 'Mode clair', ctaSubscribe: "Commencer",
    footerTag: "La plateforme IA du commerce conversationnel",
    genericError: "Une erreur s'est produite, veuillez réessayer.",
  },
  es: {
    brandName: 'RedonBot',
    navHome: 'Inicio', navAbout: 'La plataforma', navFeatures: 'Funciones', navPricing: 'Precios',
    navLogin: 'Iniciar sesión', navSignup: 'Crear cuenta', navDashboard: 'Panel', navLogout: 'Cerrar sesión',
    followUs: 'Síguenos', darkMode: 'Modo oscuro', lightMode: 'Modo claro', ctaSubscribe: 'Empezar',
    footerTag: 'La plataforma de IA para el comercio conversacional',
    genericError: 'Ocurrió un error, inténtalo de nuevo.',
  },
  de: {
    brandName: 'RedonBot',
    navHome: 'Start', navAbout: 'Über uns', navFeatures: 'Funktionen', navPricing: 'Preise',
    navLogin: 'Anmelden', navSignup: 'Registrieren', navDashboard: 'Dashboard', navLogout: 'Abmelden',
    followUs: 'Folgen Sie uns', darkMode: 'Dunkelmodus', lightMode: 'Hellmodus', ctaSubscribe: 'Jetzt starten',
    footerTag: 'Die KI-Plattform für konversationellen Handel',
    genericError: 'Etwas ist schiefgelaufen, bitte versuchen Sie es erneut.',
  },
  it: {
    brandName: 'RedonBot',
    navHome: 'Home', navAbout: 'La piattaforma', navFeatures: 'Funzionalità', navPricing: 'Prezzi',
    navLogin: 'Accedi', navSignup: 'Registrati', navDashboard: 'Pannello', navLogout: 'Esci',
    followUs: 'Seguici', darkMode: 'Modalità scura', lightMode: 'Modalità chiara', ctaSubscribe: 'Inizia ora',
    footerTag: 'La piattaforma IA per il commercio conversazionale',
    genericError: 'Si è verificato un errore, riprova.',
  },
  pt: {
    brandName: 'RedonBot',
    navHome: 'Início', navAbout: 'A plataforma', navFeatures: 'Recursos', navPricing: 'Preços',
    navLogin: 'Entrar', navSignup: 'Criar conta', navDashboard: 'Painel', navLogout: 'Sair',
    followUs: 'Siga-nos', darkMode: 'Modo escuro', lightMode: 'Modo claro', ctaSubscribe: 'Começar',
    footerTag: 'A plataforma de IA para comércio conversacional',
    genericError: 'Ocorreu um erro, tente novamente.',
  },
  tr: {
    brandName: 'RedonBot',
    navHome: 'Ana Sayfa', navAbout: 'Platform', navFeatures: 'Özellikler', navPricing: 'Fiyatlandırma',
    navLogin: 'Giriş yap', navSignup: 'Kaydol', navDashboard: 'Panel', navLogout: 'Çıkış yap',
    followUs: 'Bizi takip edin', darkMode: 'Karanlık mod', lightMode: 'Aydınlık mod', ctaSubscribe: 'Hemen başla',
    footerTag: 'Konuşmaya dayalı ticaret için yapay zeka platformu',
    genericError: 'Bir hata oluştu, lütfen tekrar deneyin.',
  },
  ru: {
    brandName: 'RedonBot',
    navHome: 'Главная', navAbout: 'О платформе', navFeatures: 'Возможности', navPricing: 'Тарифы',
    navLogin: 'Войти', navSignup: 'Регистрация', navDashboard: 'Кабинет', navLogout: 'Выйти',
    followUs: 'Мы в соцсетях', darkMode: 'Тёмная тема', lightMode: 'Светлая тема', ctaSubscribe: 'Начать',
    footerTag: 'ИИ-платформа для торговли через мессенджеры',
    genericError: 'Произошла ошибка, попробуйте ещё раз.',
  },
  zh: {
    brandName: 'RedonBot',
    navHome: '首页', navAbout: '关于平台', navFeatures: '功能', navPricing: '价格',
    navLogin: '登录', navSignup: '注册', navDashboard: '控制台', navLogout: '退出登录',
    followUs: '关注我们', darkMode: '深色模式', lightMode: '浅色模式', ctaSubscribe: '立即开始',
    footerTag: '对话式电商的人工智能平台',
    genericError: '出错了,请重试。',
  },
};

// دمج قاموس الصفحة الخاص (إذا وُجد) مع القاموس المشترك
const I18N = (function merge() {
  const extra = window.RB_EXTRA_I18N || {};
  const out = {};
  RB_LANGS.forEach(({ code }) => {
    out[code] = { ...(RB_COMMON_I18N[code] || {}), ...(extra[code] || {}) };
  });
  return out;
})();

const RB_LANG_CODES = RB_LANGS.map((l) => l.code);
let currentLang = localStorage.getItem('rb_lang') || 'ar';
if (!RB_LANG_CODES.includes(currentLang)) currentLang = 'ar';

function t(key) { return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en && I18N.en[key]) || key; }
window.rbT = t;
window.rbLang = () => currentLang;

function isRtl(lang) {
  const entry = RB_LANGS.find((l) => l.code === lang);
  return !!(entry && entry.rtl);
}

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('rb_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.querySelectorAll('.lang-switch select').forEach((sel) => { sel.value = lang; });
  const themeIsDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const themeLabelEl = document.getElementById('themeLabel');
  if (themeLabelEl) themeLabelEl.textContent = themeIsDark ? t('lightMode') : t('darkMode');
  if (window.rbOnLangChange) window.rbOnLangChange(lang);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('rb_theme', theme);
  const iconEl = document.getElementById('themeIcon');
  const labelEl = document.getElementById('themeLabel');
  if (iconEl) iconEl.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (labelEl) labelEl.textContent = theme === 'dark' ? t('lightMode') : t('darkMode');
}

function buildLangSwitchers() {
  document.querySelectorAll('.lang-switch').forEach((wrap) => {
    if (wrap.querySelector('select')) return;
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Language');
    RB_LANGS.forEach(({ code, label }) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      select.appendChild(opt);
    });
    select.value = currentLang;
    select.addEventListener('change', () => applyLang(select.value));
    wrap.appendChild(select);
  });
}

function initChrome() {
  buildLangSwitchers();

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const burgerBtn = document.getElementById('burgerBtn');
  const closeBtn = document.getElementById('sidebarClose');
  if (burgerBtn) burgerBtn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('open'); });
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
  document.querySelectorAll('.sidebar-nav a').forEach((a) => a.addEventListener('click', closeSidebar));

  const savedTheme = localStorage.getItem('rb_theme') || 'dark';
  applyTheme(savedTheme);
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  loadConfig();
  loadAuthState();
  applyLang(currentLang);
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const configData = await res.json();
    window.rbConfigData = configData;
    const wrap = document.getElementById('socialLinks');
    if (!wrap) return;
    const links = [
      ['facebook', '📘 Facebook'],
      ['instagram', '📸 Instagram'],
      ['tiktok', '🎵 TikTok'],
      ['whatsapp', '💬 WhatsApp'],
    ];
    wrap.innerHTML = links
      .filter(([key]) => configData.social && configData.social[key])
      .map(([key, label]) => `<a href="${configData.social[key]}" target="_blank" rel="noopener">${label}</a>`)
      .join('');
  } catch (e) { console.error('config load failed', e); }
}

// يتحقق هل المستخدم مسجل دخول (عبر كوكي الجلسة) ويحدّث رابط "تسجيل الدخول/لوحة التحكم" في الشريط الجانبي
async function loadAuthState() {
  const authNavEl = document.getElementById('authNavLink');
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      window.rbCurrentUser = data.user;
      if (authNavEl) { authNavEl.textContent = t('navDashboard'); authNavEl.href = '/dashboard/overview.html'; }
      if (window.rbOnAuthLoaded) window.rbOnAuthLoaded(data);
      return;
    }
  } catch (e) { /* غير مسجل دخول */ }
  window.rbCurrentUser = null;
  if (authNavEl) { authNavEl.textContent = t('navLogin'); authNavEl.href = '/login.html'; }
  if (window.rbOnAuthLoaded) window.rbOnAuthLoaded(null);
}

document.addEventListener('DOMContentLoaded', initChrome);
