const { Markup } = require('telegraf');
const { PLANS, PLAN_ORDER } = require('../config/plans');

const mainMenu = Markup.keyboard([
  ['➕ إضافة متجر جديد'],
  ['📋 كل المتاجر'],
  ['📊 إحصائيات المنصة'],
  ['💳 تعديل الخطط العامة'],
  ['🎟️ إنشاء كود عرض'],
  ['💸 طلبات السحب (الإحالة)'],
]).resize();

// قائمة الباقات القابلة للتعديل (السعر/الحدود/المميزات) مع القيم الفعلية الحالية
function globalPlansInline(effectivePlans) {
  const rows = effectivePlans.map((plan) => {
    const priceLabel = plan.price === 0 ? 'مجانية' : `${plan.price} د.ج`;
    return [Markup.button.callback(`${plan.name} — ${priceLabel}`, `editplan_${plan.id}`)];
  });
  return Markup.inlineKeyboard(rows);
}

const cancelKeyboard = Markup.keyboard([['❌ إلغاء']]).resize();

// أزرار اختيار الباقة. context: 'create_<ownerTelegramId>' أو 'change_<storeId>'
function planChoiceInline(context) {
  const rows = PLAN_ORDER.map((planId) => {
    const plan = PLANS[planId];
    const label = plan.messageLimit === null ? `${plan.name} (غير محدود)` : `${plan.name} (${plan.messageLimit} رسالة)`;
    return [Markup.button.callback(label, `plan_${context}_${planId}`)];
  });
  rows.push([Markup.button.callback('⚙️ باقة مخصصة', `plan_${context}_custom`)]);
  return Markup.inlineKeyboard(rows);
}

function storeManageInline(storeId, store) {
  const rows = [
    [Markup.button.callback('🔄 تجديد الاشتراك (نفس الباقة)', `store_renew_${storeId}`)],
    [Markup.button.callback('🔁 تغيير الباقة', `store_changeplan_${storeId}`)],
  ];
  if (store.active) {
    rows.push([Markup.button.callback('⏸️ إيقاف مؤقت', `store_pause_${storeId}`)]);
  } else if (store.subscriptionStatus !== 'expired') {
    rows.push([Markup.button.callback('▶️ إعادة تفعيل', `store_unpause_${storeId}`)]);
  }
  rows.push([Markup.button.callback('🗑 حذف المتجر نهائيًا', `store_delete_${storeId}`)]);
  rows.push([Markup.button.callback('⬅️ رجوع للقائمة', 'store_list')]);
  return Markup.inlineKeyboard(rows);
}

function confirmDeleteInline(storeId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ نعم، احذف نهائيًا', `store_delete_confirm_${storeId}`),
      Markup.button.callback('❌ تراجع', `store_manage_${storeId}`),
    ],
  ]);
}

function storeListInline(stores) {
  const rows = stores.map((s) => {
    const statusIcon = s.active ? '🟢' : s.subscriptionStatus === 'expired' ? '🔴' : '⏸️';
    return [Markup.button.callback(`${statusIcon} ${s.storeName}`, `store_manage_${s.id}`)];
  });
  return Markup.inlineKeyboard(rows);
}

function formatStoreDetails(store) {
  const usage =
    store.messageLimit === null || store.messageLimit === undefined
      ? 'غير محدود'
      : `${store.messageCount || 0} / ${store.messageLimit}`;
  const products = store.productLimit === null || store.productLimit === undefined ? 'غير محدود' : store.productLimit;
  const expires = store.subscriptionExpiresAt?.toDate
    ? store.subscriptionExpiresAt.toDate().toLocaleDateString('ar-DZ')
    : store.subscriptionExpiresAt
    ? new Date(store.subscriptionExpiresAt).toLocaleDateString('ar-DZ')
    : '—';
  const statusLabel = store.active ? '🟢 نشط' : store.subscriptionStatus === 'expired' ? '🔴 منتهي' : '⏸️ متوقف يدويًا';

  const features = store.features || {};
  const featuresList = [
    'رد نصي ✅',
    features.imageRecognition ? 'تعرف على الصور ✅' : 'تعرف على الصور ❌',
    features.voiceReply ? 'رد صوتي ✅' : 'رد صوتي ❌',
    features.fullAnalytics ? 'إحصائيات كاملة ✅' : 'إحصائيات كاملة ❌',
  ].join('\n');

  return (
    `🏪 ${store.storeName}\n` +
    `🆔 ${store.id}\n` +
    `الحالة: ${statusLabel}\n` +
    `الباقة: ${store.planName || '—'}\n` +
    `تنتهي في: ${expires}\n` +
    `الرسائل: ${usage}\n` +
    `حد المنتجات: ${products}\n\n` +
    `المميزات:\n${featuresList}`
  );
}

// ===== طلبات السحب (برنامج الإحالة) =====

const WITHDRAWAL_METHOD_LABELS = { ccp: 'CCP', baridimob: 'BaridiMob' };

function formatWithdrawalRequest(request) {
  const createdAt = request.createdAt?.toDate
    ? request.createdAt.toDate().toLocaleString('ar-DZ')
    : '—';
  return (
    `💸 طلب سحب #${request.id}\n` +
    `🏪 المتجر: ${request.storeId}\n` +
    `💰 المبلغ: ${request.amount} دج\n` +
    `🏦 الطريقة: ${WITHDRAWAL_METHOD_LABELS[request.method] || request.method}\n` +
    `🔢 رقم الحساب: ${request.accountNumber}\n` +
    `📞 الهاتف: ${request.phone}\n` +
    `🗓 التاريخ: ${createdAt}`
  );
}

function withdrawalListInline(requests) {
  const rows = requests.map((r) => [
    Markup.button.callback(`💸 ${r.storeId} — ${r.amount} دج`, `wd_view_${r.id}`),
  ]);
  return Markup.inlineKeyboard(rows);
}

function withdrawalDecisionInline(requestId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ موافقة (حوّلت الفلوس)', `wd_approve_${requestId}`),
      Markup.button.callback('❌ رفض', `wd_reject_${requestId}`),
    ],
    [Markup.button.callback('⬅️ رجوع للقائمة', 'wd_list')],
  ]);
}

module.exports = {
  mainMenu,
  cancelKeyboard,
  planChoiceInline,
  globalPlansInline,
  storeManageInline,
  confirmDeleteInline,
  storeListInline,
  formatStoreDetails,
  formatWithdrawalRequest,
  withdrawalListInline,
  withdrawalDecisionInline,
};
