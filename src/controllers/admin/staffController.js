const StoreService = require('../../services/StoreService');
const { PERMISSION_LABELS, PERMISSIONS } = require('../../config/permissions');
const { mainMenu } = require('../../ui/adminKeyboards');

function formatPermissions(permissions) {
  if (!permissions || permissions.length === 0) return '—';
  if (permissions.includes(PERMISSIONS.ALL)) return 'كل الصلاحيات';
  return permissions.map((p) => PERMISSION_LABELS[p] || p).join('، ');
}

async function startAddStaff(ctx) {
  return ctx.scene.enter('MANAGE_STAFF_SCENE', { storeId: ctx.state.store.id });
}

async function listStaff(ctx) {
  const storeId = ctx.state.store.id;
  const staff = await StoreService.listStaffMembers(storeId);
  if (staff.length === 0) {
    await ctx.reply('لا يوجد أعضاء فريق حتى الآن. اضغط "➕ إضافة عضو" لإضافة أول واحد.');
    return;
  }
  const list = staff
    .map((s, i) => `${i + 1}. 🆔 ${s.telegramId}${s.name ? ` — ${s.name}` : ''}\n   🔑 ${formatPermissions(s.permissions)}`)
    .join('\n\n');
  await ctx.reply(`👥 أعضاء فريقك:\n\n${list}\n\nلحذف عضو، اضغط "🗑 حذف عضو" ثم أرسل معرفه.`);
}

async function promptRemoveStaff(ctx) {
  const storeId = ctx.state.store.id;
  const staff = await StoreService.listStaffMembers(storeId);
  if (staff.length === 0) {
    await ctx.reply('لا يوجد أعضاء فريق لحذفهم.');
    return;
  }
  ctx.session.awaitingRemoveStaffId = true;
  const list = staff.map((s) => `🆔 ${s.telegramId}${s.name ? ` — ${s.name}` : ''}`).join('\n');
  await ctx.reply(`أرسل 🆔 العضو اللي تحب تحذفه:\n\n${list}`);
}

async function handleRemoveStaffId(ctx) {
  const storeId = ctx.state.store.id;
  const telegramId = ctx.message.text.trim();
  ctx.session.awaitingRemoveStaffId = false;
  await StoreService.removeStaffMember(storeId, telegramId);
  await ctx.reply('🗑 تم حذف العضو بنجاح.', mainMenu);
}

module.exports = { startAddStaff, listStaff, promptRemoveStaff, handleRemoveStaffId };
