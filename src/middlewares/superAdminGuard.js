const { env } = require('../config/env');

// superAdminGuard: يقبل فقط صاحب SUPER_ADMIN_TELEGRAM_ID. أي شخص آخر يُتجاهل تمامًا
// (بدون رد، حتى ما نأكدش لأشخاص آخرين وجود هذا البوت أو صلاحياته).
async function superAdminGuard(ctx, next) {
  const userId = String(ctx.from?.id || '');
  if (!env.superAdminTelegramId || userId !== String(env.superAdminTelegramId)) {
    return; // تجاهل صامت
  }
  return next();
}

module.exports = superAdminGuard;
