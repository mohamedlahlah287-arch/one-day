let plansData = null;

async function loadPlans() {
  try {
    const res = await fetch('/api/plans');
    plansData = await res.json();
    renderPlans();
  } catch (e) { console.error('plans load failed', e); }
}

function renderPlans() {
  if (!plansData) return;
  const t = window.rbT;
  const currentLang = window.rbLang();
  const pct = plansData.firstPurchaseDiscountPercent;
  const banner = document.getElementById('discountBanner');
  banner.style.display = 'block';
  banner.textContent = t('discountText').replace('%PCT%', pct);

  const grid = document.getElementById('plansGrid');
  grid.innerHTML = plansData.plans
    .map((plan) => {
      const featured = plan.id === 'growth';
      const isFree = plan.price === 0;
      const discounted = !isFree ? Math.round(plan.price * (1 - pct / 100)) : 0;
      const msgLimit = plan.messageLimit === null ? t('unlimited') : plan.messageLimit;
      const prodLimit = plan.productLimit === null ? t('unlimited') : plan.productLimit;
      return `
      <div class="plan-card ${featured ? 'featured' : ''}">
        ${featured ? `<span class="plan-badge">${t('mostPopular')}</span>` : ''}
        <div class="plan-name">${plan.name}</div>
        <div class="plan-tagline">${plan.tagline || ''}</div>
        <div class="plan-price">
          ${isFree ? t('free') : `${discounted.toLocaleString()} <small>DZD ${t('perMonth')}</small>${pct > 0 ? `<span class="old-price">${plan.price.toLocaleString()} DZD</span>` : ''}`}
        </div>
        <ul class="plan-list">
          <li>💬 ${msgLimit} ${t('msgLimit')}</li>
          <li>📦 ${prodLimit} ${t('productLimit')}</li>
          <li class="${plan.features.textReply ? '' : 'off'}">${plan.features.textReply ? '✅' : '✖️'} ${t('textReply')}</li>
          <li class="${plan.features.imageRecognition ? '' : 'off'}">${plan.features.imageRecognition ? '✅' : '✖️'} ${t('imgAnalysis')}</li>
          <li class="${plan.features.voiceReply ? '' : 'off'}">${plan.features.voiceReply ? '✅' : '✖️'} ${t('voiceReply')}</li>
          <li class="${plan.features.abandonedCartRecovery ? '' : 'off'}">${plan.features.abandonedCartRecovery ? '✅' : '✖️'} ${t('cartRecovery')}</li>
          <li class="${plan.features.staffAccounts ? '' : 'off'}">${plan.features.staffAccounts ? '✅' : '✖️'} ${t('staffAccounts')}</li>
          <li class="${plan.features.fullAnalytics ? '' : 'off'}">${plan.features.fullAnalytics ? '✅' : '✖️'} ${t('fullAnalytics')}</li>
          <li class="${plan.features.merchantVoiceNotes ? '' : 'off'}">${plan.features.merchantVoiceNotes ? '✅' : '✖️'} ${t('merchantVoiceNotes')}</li>
        </ul>
        <a href="/signup.html" class="plan-btn" data-plan="${plan.id}">${t('choose')}</a>
      </div>`;
    })
    .join('');
}

// اختيار باقة من صفحة الأسعار (بلا تسجيل دخول بعد) يوجّه مباشرة لإنشاء الحساب، ثم يختار المستخدم
// باقته فعليًا من داخل لوحة التحكم (billing.html) بعد الدخول - بلا حاجة لأي معرف تيليغرام.

window.rbOnLangChange = () => renderPlans();
document.addEventListener('DOMContentLoaded', loadPlans);
