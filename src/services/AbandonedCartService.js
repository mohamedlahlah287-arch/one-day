const FacebookSessionRepository = require('../repositories/FacebookSessionRepository');
const ProductService = require('./ProductService');
const FacebookMessengerService = require('../services/FacebookMessengerService');
const logger = require('../utils/logger');

const STAGE1_AFTER_MIN = 60; // بعد ساعة: تذكير لطيف
const STAGE2_AFTER_MIN = 24 * 60; // بعد يوم: نبضة أخيرة

function minutesSince(timestamp) {
  if (!timestamp) return Infinity;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return (Date.now() - date.getTime()) / 60000;
}

// يتابع الزبائن اللي بداو طلب (اسم/هاتف/عنوان...) بصح ما أكملوهش ولا لغاوه - يذكرهم برسالة
// لطيفة بلا ما يكون مزعج (مرة واحدة بعد ساعة، ومرة ثانية بعد يوم فقط).
class AbandonedCartService {
  async runFollowUps() {
    const candidates = await FacebookSessionRepository.findAbandonedCandidates();
    let stage1Sent = 0;
    let stage2Sent = 0;

    for (const session of candidates) {
      const elapsed = minutesSince(session.updatedAt);
      const stage = session.abandonedReminderStage || 0;
      const draft = session.orderDraft || {};
      if (!draft.productName || !session.storeId) continue;

      try {
        if (stage < 1 && elapsed >= STAGE1_AFTER_MIN) {
          await FacebookMessengerService.sendText(
            session.storeId,
            session.psid,
            `👋 لاحظنا أنك ما كملتيش طلب "${draft.productName}". إذا حاب تكمل، فقط أرسل أي رسالة وأنا نكمل معك من وين وقفنا 🙂`
          );
          await FacebookSessionRepository.markReminderSent(session.psid, 1);
          stage1Sent += 1;
        } else if (stage < 2 && elapsed >= STAGE2_AFTER_MIN) {
          const stillAvailable = await ProductService.getProduct(session.storeId, draft.productId).catch(() => null);
          if (stillAvailable) {
            await FacebookMessengerService.sendText(
              session.storeId,
              session.psid,
              `🙂 "${draft.productName}" لازال متوفر وفي انتظارك! إذا عندك أي سؤال، أنا هنا للمساعدة. أرسل "نعم" باش نكمل طلبك.`
            );
          }
          await FacebookSessionRepository.markReminderSent(session.psid, 2);
          stage2Sent += 1;
        }
      } catch (err) {
        logger.error('فشل إرسال تذكير سلة متروكة', { psid: session.psid, error: err.message });
      }
    }

    if (stage1Sent || stage2Sent) {
      logger.info('AbandonedCartService: تم إرسال تذكيرات', { stage1Sent, stage2Sent });
    }
    return { stage1Sent, stage2Sent };
  }
}

module.exports = new AbandonedCartService();
