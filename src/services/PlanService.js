const { db, FieldValue } = require('../database/firestore');
const { PLANS, PLAN_ORDER, PAID_PLAN_ORDER } = require('../config/plans');
const logger = require('../utils/logger');

// PlanService: يسمح للسوبر أدمن بتعديل أسعار/حدود/مميزات الباقات العامة (starter, growth, pro, business...)
// من بوت التيليغرام مباشرة، بدل ما يكون التعديل الوحيد الممكن هو تغيير ملف الكود config/plans.js.
//
// الفكرة: config/plans.js يبقى "القيم الافتراضية" (المرجع عند أول تشغيل أو لو ما فيه أي تعديل).
// أي تعديل يسويه السوبر أدمن يتخزن كـ "override" في وثيقة واحدة settings/plans، ويُدمج فوق
// القيم الافتراضية عند القراءة. هذا يخلي كل الموقع (صفحة الأسعار، الدفع، الفوترة) يعكس آخر تعديل
// فورًا بلا الحاجة لإعادة نشر الكود.

const PLANS_DOC = () => db.collection('settings').doc('plans');

async function getOverrides() {
  const snap = await PLANS_DOC().get();
  return snap.exists ? snap.data() || {} : {};
}

function mergePlan(base, override) {
  if (!base) return null;
  if (!override) return { ...base };
  return {
    ...base,
    price: override.price !== undefined ? override.price : base.price,
    messageLimit: override.messageLimit !== undefined ? override.messageLimit : base.messageLimit,
    productLimit: override.productLimit !== undefined ? override.productLimit : base.productLimit,
    durationDays: override.durationDays !== undefined ? override.durationDays : base.durationDays,
    features: { ...base.features, ...(override.features || {}) },
  };
}

// يرجع باقة واحدة (بالسعر/الحدود الفعلية الحالية، بعد دمج أي تعديل من السوبر أدمن)
async function getEffectivePlan(planId) {
  const base = PLANS[planId];
  if (!base) return null;
  const overrides = await getOverrides();
  return mergePlan(base, overrides[planId]);
}

// يرجع كل الباقات بالترتيب المعروض فـ الموقع، بعد دمج أي تعديلات
async function getAllEffectivePlans() {
  const overrides = await getOverrides();
  return PLAN_ORDER.map((id) => mergePlan(PLANS[id], overrides[id]));
}

// يعدّل باقة عامة معينة. fields يمكن يحتوي: price, messageLimit, productLimit (null = غير محدود), features (كائن جزئي)
async function setPlanOverride(planId, fields) {
  if (!PLANS[planId]) throw new Error(`باقة غير معروفة: ${planId}`);
  const current = await getOverrides();
  const merged = { ...(current[planId] || {}), ...fields };
  await PLANS_DOC().set({ [planId]: merged }, { merge: true });
  logger.info('تم تعديل باقة عامة من بوت السوبر أدمن', { planId, fields });
  return mergePlan(PLANS[planId], merged);
}

// يرجّع باقة معينة للقيم الافتراضية (يلغي كل تعديل سابق عليها)
async function resetPlanOverride(planId) {
  if (!PLANS[planId]) throw new Error(`باقة غير معروفة: ${planId}`);
  await PLANS_DOC().set({ [planId]: FieldValue.delete() }, { merge: true });
  logger.info('تم إرجاع باقة عامة للقيم الافتراضية', { planId });
  return { ...PLANS[planId] };
}

// يرجع فقط الباقات المدفوعة (Starter/Growth/Pro/Enterprise) بالترتيب المعروض فـ صفحة الاشتراك -
// الباقة المجانية لا تُعرض هناك لأنها تُمنح تلقائيًا ولا تُباع.
async function getPaidEffectivePlans() {
  const overrides = await getOverrides();
  return PAID_PLAN_ORDER.map((id) => mergePlan(PLANS[id], overrides[id]));
}

module.exports = {
  getEffectivePlan,
  getAllEffectivePlans,
  getPaidEffectivePlans,
  setPlanOverride,
  resetPlanOverride,
};
