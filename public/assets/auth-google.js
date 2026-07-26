// تهيئة زر "تسجيل الدخول بـ Google" (Google Identity Services) - مشترك بين login.html و signup.html
// يجلب أولًا googleClientId من السيرفر (عمومي، ماشي سري)، ثم يهيئ الزر إذا كانت الميزة مفعّلة.
async function rbInitGoogle({ buttonEl, onCredential }) {
  const noteEl = document.getElementById('googleDisabledNote');
  const areaEl = document.getElementById('googleAuthArea');
  try {
    const res = await fetch('/api/auth/config');
    const cfg = await res.json();
    if (!cfg.googleEnabled || !cfg.googleClientId) {
      if (areaEl) areaEl.style.display = 'none';
      if (noteEl) noteEl.style.display = 'block';
      return;
    }

    function tryInit() {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        setTimeout(tryInit, 150);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(document.getElementById(buttonEl), {
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
      });
    }
    tryInit();
  } catch (e) {
    console.error('تعذّر تحميل إعدادات Google', e);
    if (areaEl) areaEl.style.display = 'none';
    if (noteEl) noteEl.style.display = 'block';
  }
}

window.rbInitGoogle = rbInitGoogle;
