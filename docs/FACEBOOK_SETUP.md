# إعداد بوت الزبائن على Facebook Messenger

بوت الزبائن أصبح على Facebook Messenger بدل Telegram. هذا يحتاج إعدادًا مختلفًا تمامًا:
تطبيق Facebook + صفحة + رابط webhook عام (HTTPS). هذا الدليل يشرح كل خطوة.

## 1. أنشئ صفحة Facebook (إذا ما عندكش وحدة بعد)

هذه هي الصفحة التي سيتحدث معها كل الزبائن (لكل المتاجر، عبر رابط مختلف لكل تاجر).
من facebook.com → Pages → Create Page.

## 2. أنشئ تطبيق Facebook (Meta App)

1. روح لـ [developers.facebook.com](https://developers.facebook.com/apps)
2. "Create App" → اختر نوع **Business**
3. من لوحة التطبيق، أضف منتج **Messenger** (Add Product → Messenger → Set Up)

## 3. اربط الصفحة واحصل على Page Access Token

1. في إعدادات Messenger داخل التطبيق (Messenger → Settings)
2. تحت "Access Tokens"، اربط الصفحة التي أنشأتها
3. انسخ الـ **Page Access Token** الذي يظهر → هذا هو `FB_PAGE_ACCESS_TOKEN`

⚠️ إذا كان التطبيق في وضع "Development"، فقط الحسابات المضافة كـ "Testers/Admins" في التطبيق
تقدر تتحدث مع البوت. لازم تنشر التطبيق لاحقًا (App Review) باش يشتغل مع أي زبون حقيقي —
راجع القسم الأخير في هذا الملف.

## 4. احصل على App Secret (اختياري لكن موصى به بشدة)

من App Settings → Basic → App Secret → اضغط "Show" وانسخه → هذا هو `FB_APP_SECRET`
(يُستعمل للتحقق أن كل طلب webhook قادم فعلاً من فيسبوك، وليس من طرف خبيث).

## 5. اختر Verify Token بنفسك

هذا نص سري تختاره أنت بنفسك (أي كلمة/جملة عشوائية، مثال: `smartseller-webhook-2026`).
تحطه في `FB_VERIFY_TOKEN` وأيضًا في إعدادات webhook داخل تطبيق فيسبوك (الخطوة الجاية).

## 6. انشر بوت الزبائن أولاً (Railway) قبل ربط webhook

فيسبوك يحتاج رابط HTTPS **عام وشغال فعليًا** قبل ما يقبل حفظ إعدادات webhook.
اتبع خطوات `docs/DEPLOYMENT.md` لنشر خدمة `customer-bot` على Railway أولاً، وفعّل لها
"Public Domain" (من Settings → Networking → Generate Domain). ستحصل على رابط شكله:

```
https://customer-bot-production.up.railway.app
```

## 7. اربط الـ Webhook

1. في Messenger → Settings → Webhooks → "Add Callback URL"
2. Callback URL: `https://<رابط-خدمتك-على-Railway>/webhook`
3. Verify Token: نفس القيمة اللي حطيتها في `FB_VERIFY_TOKEN`
4. اضغط "Verify and Save" (لازم تكون الخدمة شغالة على Railway وقتها، وإلا التحقق يفشل)
5. اشترك (Subscribe) في هذه الحقول (Webhook Fields) على الأقل:
   - `messages`
   - `messaging_postbacks`
   - `messaging_referrals`

## 8. جرب الرابط

بعد ما تضيف متجرًا من بوت السوبر أدمن، اطلب من التاجر يشارك هذا الرابط مع زبائنه:

```
https://m.me/اسم_صفحتك؟ref=معرف_التاجر
```

(البوت نفسه يعرض لك هذا الرابط جاهزًا من بوت التاجر → "🔗 رابط متجرك للزبائن"، إذا ضبطت
`FB_PAGE_USERNAME` في متغيرات البيئة).

## 9. النشر للعموم (App Review)

بينما التطبيق في وضع Development، فقط أنت والحسابات المضافة يدويًا كـ Testers تقدروا تجربو البوت.
باش أي زبون حقيقي يقدر يتحدث معه، خاصك:

1. من App Settings → أضف Privacy Policy URL (رابط سياسة خصوصية - حتى بسيطة تكفي للبداية)
2. اطلب صلاحية `pages_messaging` عبر App Review → Permissions and Features
3. فيسبوك قد يطلب منك فيديو يشرح استعمال البوت - سجل شاشة قصيرة توضح المحادثة الكاملة

هذه الخطوة تاخذ عادة بضعة أيام للمراجعة من طرف Meta. ريثما تنتظر، تقدر تجرب البوت بنفسك
وبأي حساب تضيفه كـ Tester/Admin على التطبيق.

## ملخص المتغيرات المطلوبة

| المتغير | من وين تجيبه |
|---|---|
| `FB_PAGE_ACCESS_TOKEN` | Messenger → Settings → Access Tokens |
| `FB_VERIFY_TOKEN` | تختاره أنت بنفسك |
| `FB_APP_SECRET` | App Settings → Basic |
| `FB_PAGE_USERNAME` | اسم مستخدم صفحتك (من رابطها، بدون @) |
