const logger = require('../utils/logger');
const PendingRegistrationRepository = require('../repositories/PendingRegistrationRepository');
const { getMerchantBotUsername } = require('../utils/telegramBotInfo');

function page(bodyHtml, title = 'تسجيل متجر جديد') {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background: #f7f7f8;
      display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:16px; }
    .box { max-width: 420px; width:100%; padding:28px; background:#fff; border-radius:14px;
      box-shadow:0 4px 20px rgba(0,0,0,.08); text-align:center; }
    h1 { font-size:20px; margin:0 0 20px; }
    label { display:block; text-align:right; font-size:14px; margin:14px 0 6px; color:#333; }
    input { width:100%; box-sizing:border-box; padding:12px; border:1px solid #ddd; border-radius:8px; font-size:15px; }
    button, .btn { display:block; width:100%; box-sizing:border-box; margin-top:22px; padding:14px; border:none;
      border-radius:8px; background:#1877f2; color:#fff; font-size:16px; cursor:pointer; text-decoration:none; }
    p { font-size:15px; line-height:1.7; color:#333; }
    .error { color:#c0392b; font-size:14px; margin-top:10px; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function registerRegistrationRoutes(app) {
  // فورم التسجيل الذاتي
  app.get('/register', (req, res) => {
    // كود الدعوة يمكن يجي جاهزًا فـ الرابط (مثال: /register?ref=ABC1234) لما التاجر يشارك رابطه،
    // ونعبّيه مسبقًا فـ الحقل، لكن يبقى قابل للتعديل يدويًا.
    const refFromQuery = String(req.query?.ref || '').trim();
    res.send(
      page(`
        <div class="box">
          <h1>🏪 سجّل متجرك الآن</h1>
          <form method="POST" action="/register">
            <label>اسم المتجر</label>
            <input type="text" name="storeName" required minlength="2" placeholder="مثال: متجر أناقة" />
            <label>اسمك</label>
            <input type="text" name="ownerName" required placeholder="اسمك الكامل" />
            <label>رقم الهاتف</label>
            <input type="tel" name="phone" required placeholder="0555123456" />
            <label>كود الدعوة (اختياري)</label>
            <input type="text" name="referralCode" placeholder="إذا دعاك تاجر آخر، اكتب كوده هنا" value="${refFromQuery.replace(/"/g, '')}" />
            <button type="submit">التالي: تأكيد عبر تيليغرام ✅</button>
          </form>
        </div>
      `)
    );
  });

  // بعد تعبئة الفورم: ننشئ توكن مؤقت ونوجه التاجر لبوت التاجر لإكمال التسجيل (لازم نعرف
  // معرف Telegram الحقيقي تاعو، وهذا ما يصيرش إلا لما يضغط "ابدأ" فـ تيليغرام نفسه)
  app.post('/register', async (req, res) => {
    const storeName = (req.body?.storeName || '').trim();
    const ownerName = (req.body?.ownerName || '').trim();
    const phone = (req.body?.phone || '').trim();
    const referralCode = (req.body?.referralCode || '').trim();

    if (storeName.length < 2 || !ownerName || !phone) {
      return res.status(400).send(
        page(`<div class="box"><p class="error">⚠️ من فضلك عبّي كل الحقول بشكل صحيح.</p>
          <a class="btn" href="/register">رجوع</a></div>`)
      );
    }

    try {
      const token = await PendingRegistrationRepository.create({
        storeName,
        ownerName,
        phone,
        referralCode,
        signupIp: req.ip,
      });
      let telegramLink = null;
      try {
        const username = await getMerchantBotUsername();
        telegramLink = `https://t.me/${username}?start=reg_${token}`;
      } catch (err) {
        logger.error('فشل جلب اسم بوت التاجر (getMe)', { error: err.message });
      }

      if (telegramLink) {
        return res.send(
          page(`
            <div class="box">
              <h1>✅ خطوة أخيرة!</h1>
              <p>اضغط الزر تحت وافتح بوت التاجر على تيليغرام، ثم اضغط "ابدأ" (Start) لإكمال تسجيل متجرك تلقائيًا.</p>
              <a class="btn" href="${telegramLink}">فتح بوت التاجر على تيليغرام</a>
            </div>
          `)
        );
      }

      return res.send(
        page(`
          <div class="box">
            <h1>✅ خطوة أخيرة!</h1>
            <p>افتح بوت التاجر يدويًا على تيليغرام وأرسل هذا الأمر بالضبط لإكمال التسجيل:</p>
            <p style="direction:ltr;font-family:monospace;background:#f1f1f1;padding:10px;border-radius:8px">/start reg_${token}</p>
          </div>
        `)
      );
    } catch (err) {
      logger.error('فشل إنشاء تسجيل مؤقت للمتجر', { error: err.message });
      return res.status(500).send(page(`<div class="box"><p class="error">⚠️ حدث خطأ، حاول مرة أخرى.</p></div>`));
    }
  });
}

module.exports = registerRegistrationRoutes;
