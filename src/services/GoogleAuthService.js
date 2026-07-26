const { env } = require('../config/env');
const logger = require('../utils/logger');

// نتحقق من id_token القادم من زر "تسجيل الدخول بـ Google" (Google Identity Services) عبر
// مسار Google الرسمي tokeninfo، بلا حاجة لمكتبة google-auth-library إضافية (نستعمل fetch
// المدمج في Node 18+، بنفس أسلوب ChargilyService).
// التوثيق: https://developers.google.com/identity/sign-in/web/backend-auth
class GoogleAuthService {
  isConfigured() {
    return Boolean(env.google.clientId);
  }

  async verifyIdToken(idToken) {
    if (!idToken) throw new Error('لم يتم استلام رمز Google (id_token)');
    if (!this.isConfigured()) {
      throw new Error('تسجيل الدخول عبر Google غير مفعّل بعد. أضف GOOGLE_CLIENT_ID في متغيرات البيئة.');
    }

    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      logger.warn('فشل التحقق من رمز Google', { error: data.error_description || data.error });
      throw new Error('رمز Google غير صالح أو منتهي الصلاحية. حاول تسجيل الدخول من جديد.');
    }

    // aud يجب أن يطابق بالضبط Client ID الخاص بتطبيقك، وإلا فالتوكن ممكن يكون موجّه لتطبيق آخر
    if (data.aud !== env.google.clientId) {
      logger.warn('رمز Google موجّه لتطبيق مختلف (aud mismatch)', { aud: data.aud });
      throw new Error('رمز Google غير صالح لهذا الموقع.');
    }

    if (data.email_verified !== 'true' && data.email_verified !== true) {
      throw new Error('حساب Google هذا غير مؤكد البريد الإلكتروني.');
    }

    return {
      googleId: data.sub,
      email: data.email,
      fullName: data.name || '',
      avatarUrl: data.picture || null,
    };
  }
}

module.exports = new GoogleAuthService();
