const StoreService = require('../services/StoreService');
const { hasPermission } = require('../config/permissions');

// ensureStoreRegistered: يتأكد أن المتحدث (ctx.from.id) هو إما صاحب متجر مسجل أو عضو فريق مضاف
// من طرف صاحب متجر. يضبط ctx.state.store (وثيقة المتجر الحقيقية)، ctx.state.role ('owner' | 'staff')
// و ctx.state.permissions (مصفوفة الصلاحيات) لاستعمالها لاحقًا فـ requirePermission والـ controllers.
// ملاحظة مهمة: التسجيل الذاتي كصاحب متجر معطّل - فقط السوبر أدمن يضيف المتاجر. لكن صاحب متجر
// مسجل يقدر يضيف أعضاء فريق بنفسه من داخل بوت التاجر.
async function ensureStoreRegistered(ctx, next) {
  const telegramId = ctx.from.id;
  const actor = await StoreService.resolveActor(telegramId);
  if (!actor) {
    return ctx.reply(
      '🚫 هذا البوت مخصص فقط لأصحاب المتاجر المسجلين لدينا أو أعضاء الفريق المضافين من طرفهم.\n\nإذا كنت تريد فتح متجر، تواصل مع الإدارة. وإذا كنت تنتظر إضافتك كعضو فريق، تأكد من صاحب المتجر أنه أضاف معرف تيليغرام الصحيح.'
    );
  }
  ctx.state.store = actor.store;
  ctx.state.role = actor.role;
  ctx.state.permissions = actor.permissions;
  ctx.state.actorTelegramId = telegramId;
  return next();
}

// requirePermission: middleware factory - يستعمل بعد ensureStoreRegistered.
// إذا العضو ماعندوش الصلاحية المطلوبة (وماشي ALL)، نرفض بأدب بدل ما نكمل العملية.
function requirePermission(permission) {
  return async (ctx, next) => {
    const permissions = ctx.state.permissions || [];
    if (!hasPermission(permissions, permission)) {
      return ctx.reply('🚫 ماعندكش صلاحية لهاذ العملية. تواصل مع صاحب المتجر إذا تحتاجها.');
    }
    return next();
  };
}

// requireOwner: بعض العمليات الحساسة (مثل إدارة الفريق نفسه) مخصصة فقط لصاحب المتجر.
async function requireOwner(ctx, next) {
  if (ctx.state.role !== 'owner') {
    return ctx.reply('🚫 هذه العملية مخصصة فقط لصاحب المتجر.');
  }
  return next();
}

module.exports = { ensureStoreRegistered, requirePermission, requireOwner };
