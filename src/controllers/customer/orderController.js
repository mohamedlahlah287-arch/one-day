const ProductService = require('../../services/ProductService');
const OrderService = require('../../services/OrderService');
const CouponService = require('../../services/CouponService');
const FacebookSessionRepository = require('../../repositories/FacebookSessionRepository');
const FacebookMessengerService = require('../../services/FacebookMessengerService');
const { validatePhone, validateNonEmptyText, validateQuantity } = require('../../validators/orderValidator');
const { confirmOrderQuickReplies } = require('../../ui/customerKeyboards');
const engine = require('../../engine/responseEngine');
const { ORDER_STEPS: STEPS } = require('../../config/orderStates');

// خطوات جمع بيانات الطلب (تعادل WizardScene تاع تليغراف، لكن مخزّنة في Firestore
// لأن Messenger webhook بلا حالة بين الطلبات)

async function startOrderFromProduct(psid, storeId, productId) {
  const product = await ProductService.getProduct(storeId, productId);
  await FacebookSessionRepository.set(psid, {
    orderState: 'AWAITING_NAME',
    orderDraft: { productId, productName: product.name, price: product.price, quantity: 1 },
  });
  return FacebookMessengerService.sendText(storeId, psid, '👤 ما اسمك؟');
}

// يُستدعى من webhook handler لكل رسالة نصية إذا كان الزبون وسط تعبئة طلب
async function handleOrderStep(psid, storeId, session, text) {
  const draft = session.orderDraft || {};
  const state = session.orderState;

  switch (state) {
    case 'AWAITING_NAME': {
      try {
        draft.name = validateNonEmptyText(text, 'الاسم');
      } catch (err) {
        return FacebookMessengerService.sendText(storeId, psid, `⚠️ ${err.message}`);
      }
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_PHONE', orderDraft: draft });
      return FacebookMessengerService.sendText(storeId, psid, '📱 رقم هاتفك؟ (مثال: 0555123456)');
    }
    case 'AWAITING_PHONE': {
      try {
        draft.phone = validatePhone(text);
      } catch (err) {
        return FacebookMessengerService.sendText(storeId, psid, `⚠️ ${err.message}`);
      }
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_WILAYA', orderDraft: draft });
      return FacebookMessengerService.sendText(storeId, psid, '📍 ولايتك؟');
    }
    case 'AWAITING_WILAYA': {
      draft.wilaya = text.trim();
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_COMMUNE', orderDraft: draft });
      return FacebookMessengerService.sendText(storeId, psid, '🏘️ بلديتك؟');
    }
    case 'AWAITING_COMMUNE': {
      draft.commune = text.trim();
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_ADDRESS', orderDraft: draft });
      return FacebookMessengerService.sendText(storeId, psid, '🏠 العنوان بالتفصيل؟');
    }
    case 'AWAITING_ADDRESS': {
      draft.address = text.trim();
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_QUANTITY', orderDraft: draft });
      return FacebookMessengerService.sendText(storeId, psid, '🔢 شحال تحب من هاذ المنتج؟ (اكتب رقم، مثلاً 1)');
    }
    case 'AWAITING_QUANTITY': {
      try {
        draft.quantity = validateQuantity(text);
      } catch (err) {
        return FacebookMessengerService.sendText(storeId, psid, `⚠️ ${err.message}`);
      }
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_TIME', orderDraft: draft });
      return FacebookMessengerService.sendText(storeId, psid, '🕐 أفضل وقت للتوصيل؟ (أو "أي وقت")');
    }
    case 'AWAITING_TIME': {
      draft.bestTime = text.trim();
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_NOTE', orderDraft: draft });
      return FacebookMessengerService.sendText(
        storeId,
        psid,
        '📝 حاب تزيد ملاحظة على الطلب؟ (مثلاً: لون معيّن، مقاس، أو أي تفصيل إضافي)\nاكتب ملاحظتك، أو اكتب "لا" إذا ماكاينش.'
      );
    }
    // ملاحظة اختيارية على الطلب - إذا الزبون كتب "لا" أو أي كلمة تخطي، نعتبرها بلا ملاحظة
    case 'AWAITING_NOTE': {
      const skip = engine.detectYesNo(text) === 'cancel' || /^(تخطي|skip|بلا ملاحظة|ماكاين|ماكاينش)$/i.test(engine.normalize(text));
      draft.note = skip ? '' : text.trim();
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_COUPON', orderDraft: draft });
      return FacebookMessengerService.sendText(
        storeId,
        psid,
        '🏷️ عندك كود كوبون؟ اكتبه، أو اكتب "لا" إذا ماكاينش.'
      );
    }
    // كود الكوبون اختياري - نتحقق منه فورًا (صالح؟ غير منتهي؟) قبل عرض ملخص الطلب، حتى
    // الخصم يبان للزبون فـ الملخص قبل التأكيد النهائي (نفس التحقق يُعاد فـ OrderService.createOrder
    // كحماية إضافية وقت التأكيد، تفاديًا لأي تلاعب بين المعاينة والتأكيد).
    case 'AWAITING_COUPON': {
      const skip = engine.detectYesNo(text) === 'cancel' || /^(تخطي|skip|بلا كوبون|ماكاين|ماكاينش)$/i.test(engine.normalize(text));
      const qty = draft.quantity || 1;
      const rawTotal = draft.price * qty;
      if (skip) {
        draft.couponCode = null;
        draft.discountPreview = 0;
      } else {
        try {
          const result = await CouponService.validateAndApply(storeId, text.trim(), rawTotal);
          draft.couponCode = result.coupon ? result.coupon.code : null;
          draft.discountPreview = result.discount;
        } catch (err) {
          return FacebookMessengerService.sendText(
            storeId,
            psid,
            `⚠️ ${err.message}. أرسل كود كوبون صحيح، أو اكتب "لا" للمتابعة بدون كوبون.`
          );
        }
      }
      await FacebookSessionRepository.set(psid, { orderState: 'AWAITING_CONFIRM', orderDraft: draft });
      const noteLine = draft.note ? `📝 ملاحظة: ${draft.note}\n` : '';
      const discountLine = draft.discountPreview > 0 ? `🏷️ خصم الكوبون: -${draft.discountPreview} دج\n` : '';
      const finalTotal = rawTotal - (draft.discountPreview || 0);
      const summary =
        `📋 ملخص الطلب:\n\n👤 ${draft.name}\n📱 ${draft.phone}\n📍 ${draft.wilaya}, ${draft.commune}\n` +
        `🏠 ${draft.address}\n🔢 الكمية: ${qty}\n🕐 ${draft.bestTime}\n${noteLine}📦 ${draft.productName}\n${discountLine}💰 المجموع: ${finalTotal} دج\n\n` +
        `هل تؤكد الطلب؟ اضغط زر التأكيد، أو اكتب "نعم" للتأكيد و"لا" للإلغاء.`;
      return FacebookMessengerService.sendQuickReplies(storeId, psid, summary, confirmOrderQuickReplies);
    }
    // AWAITING_CONFIRM: أساسًا يُعالج عبر ضغطة زر quick_reply (انظر confirmOrder/cancelOrder فـ
    // customer.routes.js)، لكن أزرار Messenger ما تتصيّرش دايمًا فـ Facebook Lite، فكثير زبائن
    // يكتبوا "نعم"/"لا" يدويًا بدل الضغط. هذا الفرع يدعم هذه الحالة كتابةً.
    case 'AWAITING_CONFIRM': {
      const answer = engine.detectYesNo(text);
      if (answer === 'confirm') return confirmOrder(psid, storeId, session);
      if (answer === 'cancel') return cancelOrder(psid, storeId);
      return FacebookMessengerService.sendQuickReplies(
        storeId,
        psid,
        'من فضلك أكّد الطلب: اكتب "نعم" للتأكيد أو "لا" للإلغاء 👇',
        confirmOrderQuickReplies
      );
    }
    default:
      return;
  }
}

async function confirmOrder(psid, storeId, session) {
  const draft = session.orderDraft || {};
  try {
    const { total, discount } = await OrderService.createOrder(storeId, {
      ...draft,
      notes: draft.note || '',
      customerId: psid,
    });
    await FacebookSessionRepository.clearOrderState(psid);
    const discountLine = discount > 0 ? `\n🏷️ خصم: ${discount} دج` : '';
    return FacebookMessengerService.sendText(
      storeId,
      psid,
      `✅ شكرًا لك! تم استلام طلبك بمبلغ ${total} دج.${discountLine}\nسنتواصل معك قريبًا.`
    );
  } catch (err) {
    return FacebookMessengerService.sendText(storeId, psid, `⚠️ ${err.message}`);
  }
}

async function cancelOrder(psid, storeId) {
  await FacebookSessionRepository.clearOrderState(psid);
  return FacebookMessengerService.sendText(storeId, psid, 'تم إلغاء الطلب. يمكنك تصفح المنتجات مجددًا في أي وقت.');
}

module.exports = { startOrderFromProduct, handleOrderStep, confirmOrder, cancelOrder, STEPS };
