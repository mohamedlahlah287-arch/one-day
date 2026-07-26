# دليل الإعداد (Setup Guide)

## المتطلبات
- Node.js 18.17+ (يحتاج `fetch`/`FormData` المدمجة للميزات الصوتية/الصور، وسيرفر Express لبوت الزبائن)
- حساب Firebase مع Firestore مفعّل
- بوتان Telegram (تاجر، سوبر أدمن) من [@BotFather](https://t.me/BotFather)
- صفحة + تطبيق Facebook Messenger لبوت الزبائن (راجع [FACEBOOK_SETUP.md](./FACEBOOK_SETUP.md))
- اختياري: مفتاح [Groq API](https://console.groq.com) للرد الصوتي وتحليل الصور

## الخطوات

```bash
# 1. ثبّت المكتبات
npm install

# 2. جهّز متغيرات البيئة
cp .env.example .env
# افتح .env واملأ القيم (توكنات Telegram + متغيرات Facebook + مفاتيح Firebase + معرفك الشخصي)

# 3. شغّل الاختبارات (تأكد أن كل شيء سليم قبل التشغيل الفعلي)
npm test

# 4. شغّل بوت السوبر أدمن (Terminal أول) - أضف أول متجر من هنا
npm run start:superadmin

# 5. شغّل بوت التاجر (Terminal ثاني)
npm run start:merchant

# 6. شغّل بوت الزبائن (Terminal ثالث) - سيرفر Express محلي، يحتاج أداة مثل ngrok
#    لعرضه على رابط عام مؤقت أثناء التجربة المحلية فقط (Facebook يحتاج HTTPS عام حتى للتجربة)
npm run start:customer
```

## أثناء التطوير

استعمل `npm run dev:merchant`، `npm run dev:customer`، `npm run dev:superadmin` (يستعملان nodemon،
يعيدان التشغيل تلقائيًا عند أي تعديل في الكود).

## هيكلة إضافة ميزة جديدة (مثال توضيحي)

لنفترض تحب تضيف "تقييم المنتج من الزبون" (rating):

1. **Repository**: أضف `findAll`/`create` خاصين في `ProductRepository` أو مستودع `RatingRepository` جديد يرث من `BaseRepository`.
2. **Service**: أنشئ `RatingService` أو أضف method في `ProductService` (حسب مدى ترابط المنطق).
3. **Validator**: أضف `validateRatingValue()` في `validators/`.
4. **Controller**: أضف method في `controllers/customer/` يستدعي الخدمة.
5. **Route**: اربط الأمر/الزر الجديد في `routes/customer.routes.js`.
6. **Event (اختياري)**: لو حبيت تشعر التاجر بكل تقييم جديد، أصدر حدث `product.rated` وسجل استماع له في `notificationListeners.js`.
7. **Test**: أضف اختبار وحدة لـ `RatingService` في `tests/unit/services/`.

هذا الترتيب (Repository → Service → Validator → Controller → Route) هو نفسه لأي ميزة جديدة.
