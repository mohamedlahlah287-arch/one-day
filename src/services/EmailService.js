const { env } = require('../config/env');
const logger = require('../utils/logger');

// إرسال إيميلات عبر Resend (https://resend.com). طالما RESEND_API_KEY فارغ، الدوال هنا
// ما تديرش شي وتكتفي بتسجيل ملاحظة فـ اللوق، بلا ما توقف بقية النظام.
class EmailService {
  isConfigured() {
    return Boolean(env.resend.apiKey);
  }

  async send({ to, subject, html }) {
    if (!this.isConfigured()) {
      logger.info('📧 Resend غير مفعّل بعد (RESEND_API_KEY فارغ) - تم تجاهل إرسال الإيميل', { to, subject });
      return { skipped: true };
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resend.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: env.resend.fromEmail, to, subject, html }),
      });
      const data = await res.json();
      if (!res.ok) {
        logger.error('فشل إرسال إيميل عبر Resend', { error: data });
        return { skipped: false, error: data };
      }
      return { skipped: false, id: data.id };
    } catch (err) {
      logger.error('خطأ غير متوقع أثناء إرسال إيميل عبر Resend', { error: err.message });
      return { skipped: false, error: err.message };
    }
  }

  async sendWelcomeEmail(to, fullName) {
    return this.send({
      to,
      subject: 'أهلاً بك في Red Bot 👋',
      html: `<div dir="rtl" style="font-family:sans-serif">
        <h2>أهلاً ${fullName || ''} 👋</h2>
        <p>تم إنشاء حسابك بنجاح على منصة Red Bot. فريقنا سيراجع حسابك وقد نتواصل معك قريبًا.</p>
      </div>`,
    });
  }
}

module.exports = new EmailService();
