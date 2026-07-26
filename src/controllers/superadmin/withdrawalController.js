const ReferralService = require('../../services/ReferralService');
const { toUserMessage } = require('../../middlewares/errorHandler');
const {
  mainMenu,
  formatWithdrawalRequest,
  withdrawalListInline,
  withdrawalDecisionInline,
} = require('../../ui/superAdminKeyboards');

async function listPending(ctx) {
  const requests = await ReferralService.adminListPendingWithdrawals();
  if (requests.length === 0) {
    return ctx.reply('✅ لا توجد طلبات سحب قيد الانتظار حاليًا.', mainMenu);
  }
  return ctx.reply(`💸 طلبات السحب قيد الانتظار: ${requests.length}\n\nاختر طلبًا لعرض التفاصيل:`, withdrawalListInline(requests));
}

async function listPendingAction(ctx) {
  await ctx.answerCbQuery();
  const requests = await ReferralService.adminListPendingWithdrawals();
  if (requests.length === 0) {
    return ctx.editMessageText('✅ لا توجد طلبات سحب قيد الانتظار حاليًا.');
  }
  return ctx.editMessageText(`💸 طلبات السحب قيد الانتظار: ${requests.length}\n\nاختر طلبًا لعرض التفاصيل:`, withdrawalListInline(requests));
}

async function viewAction(ctx) {
  await ctx.answerCbQuery();
  const requestId = ctx.match[1];
  const requests = await ReferralService.adminListPendingWithdrawals();
  const request = requests.find((r) => r.id === requestId);
  if (!request) return ctx.editMessageText('⚠️ هذا الطلب لم يعد قيد الانتظار (تمت معالجته من قبل).');
  return ctx.editMessageText(
    formatWithdrawalRequest(request) +
      '\n\n⚠️ تذكير: حوّل المبلغ يدويًا للتاجر (CCP/BaridiMob) قبل ما تضغط "موافقة".',
    withdrawalDecisionInline(request.id)
  );
}

async function approveAction(ctx) {
  try {
    const requestId = ctx.match[1];
    await ReferralService.adminApproveWithdrawal(requestId);
    await ctx.answerCbQuery('✅ تمت الموافقة');
    return ctx.editMessageText('✅ تمت الموافقة على طلب السحب.', mainMenu);
  } catch (err) {
    return ctx.answerCbQuery(toUserMessage(err), { show_alert: true });
  }
}

async function rejectAction(ctx) {
  try {
    const requestId = ctx.match[1];
    await ReferralService.adminRejectWithdrawal(requestId);
    await ctx.answerCbQuery('❌ تم الرفض وإرجاع الرصيد');
    return ctx.editMessageText('❌ تم رفض طلب السحب، وتم إرجاع الرصيد للتاجر تلقائيًا.', mainMenu);
  } catch (err) {
    return ctx.answerCbQuery(toUserMessage(err), { show_alert: true });
  }
}

module.exports = { listPending, listPendingAction, viewAction, approveAction, rejectAction };
