const crypto = require('crypto');
const logger = require('../utils/logger');
const { env } = require('../config/env');

// خدمة الدفع الإلكتروني عبر Chargily Pay (يدعم بطاقة إدهابية Algérie Poste وبطاقة CIB عبر SATIM).
// كل ما تحتاجه: تضع CHARGILY_SECRET_KEY و CHARGILY_TEST_MODE في متغيرات البيئة (Railway)،
// وهذا الملف يتكفل بالباقي (لا حاجة لأي تعديل هنا لتشغيله).
// التوثيق الرسمي: https://dev.chargily.com/pay-v2/introduction

const BASE_URL = () =>
  env.chargily.testMode ? 'https://pay.chargily.net/test/api/v2' : 'https://pay.chargily.net/api/v2';

class ChargilyService {
  isConfigured() {
    return Boolean(env.chargily.secretKey);
  }

  // ينشئ صفحة دفع (checkout) بمبلغ مباشر (بدون الحاجة لإنشاء "منتج/سعر" مسبقًا في لوحة Chargily).
  // amount: بالدينار الجزائري (أرقام صحيحة، بدون فواصل).
  // metadata: أي بيانات نريد استرجاعها لاحقًا عند استلام الـ webhook (مثلاً storeId و planId).
  // walletApplied/planValue (اختياري): لو استُعمل جزء من رصيد المحفظة (عمولات الإحالة) لتغطية جزء
  // من السعر، نحتفظ بالقيمتين فـ الـ metadata حتى يقدر webhook الدفع يخصم الرصيد الفعلي بعد
  // تأكيد الدفع، ويحتسب عمولة الإحالة على القيمة الكاملة للاشتراك planValue (كاش + رصيد).
  async createCheckout({ amount, description, storeId, planId, walletApplied = 0, planValue = null, successUrl, failureUrl }) {
    if (!this.isConfigured()) {
      throw new Error('CHARGILY_SECRET_KEY غير موجود في متغيرات البيئة. أضفه أولاً من Railway.');
    }
    const payload = {
      amount,
      currency: 'dzd',
      locale: 'ar',
      description,
      success_url: successUrl,
      failure_url: failureUrl,
      webhook_endpoint: `${env.appBaseUrl}/api/payments/webhook`,
      metadata: [{ storeId: String(storeId), planId, walletApplied, planValue: planValue ?? amount }],
    };

    const res = await fetch(`${BASE_URL()}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.chargily.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error('فشل إنشاء checkout عبر Chargily', { status: res.status, data });
      throw new Error(data?.message || 'فشل إنشاء عملية الدفع عبر Chargily');
    }
    return data; // يحتوي على data.checkout_url وهو الرابط الذي نوجه إليه الزبون
  }

  // يتحقق أن طلب الـ webhook قادم فعلاً من Chargily وليس مزوّرًا (توقيع HMAC-SHA256)
  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader || !env.chargily.secretKey) return false;
    const computed = crypto.createHmac('sha256', env.chargily.secretKey).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signatureHeader, 'utf8'));
    } catch {
      return false; // أطوال مختلفة = توقيع غير صالح
    }
  }
}

module.exports = new ChargilyService();
