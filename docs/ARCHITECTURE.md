# البنية المعمارية - Smart Seller Bot

## نظرة عامة

النظام مبني على **عمارة طبقات (Layered Architecture)** مستوحاة من Clean Architecture، مقسمة كي:

```
طلب من Telegram
      ↓
   Routes        ← يربط الأمر/الرسالة بالـ Controller المناسب
      ↓
 Middlewares     ← rateLimiter, authGuard, errorHandler (asyncHandler)
      ↓
 Controllers     ← رقيقة جدًا: تستقبل، تنادي Service، ترد. بلا منطق أعمال.
      ↓
  Services       ← كل منطق الأعمال هنا (التحقق، الحسابات، القرارات)
      ↓
 Repositories    ← الوصول الوحيد المسموح به لـ Firestore
      ↓
  Firestore
```

بالتوازي مع هذا، كاين نظام أحداث (Events) يسمح للخدمات ترسل "حدث" (مثال: "طلب جديد تم إنشاؤه")
بلا ما تعرف مين رايح يستمع لهذا الحدث. هذا يفصل بين "شنو صرا" و"شنو نديرو بعد ما يصرا".

## لماذا هذا التقسيم؟

- **قابلية الصيانة**: كل ملف مسؤول عن شيء وحيد. تبديل Firestore بقاعدة بيانات أخرى غدًا
  يعني تعديل `repositories/` فقط، بلا لمس `services/` أو `controllers/`.
- **قابلية الاختبار**: `services/` ما تعرفش Telegram إطلاقًا (ما فيهاش `ctx`)، فنقدر نختبرها
  بمعزل تام (unit tests) بلا الحاجة لبوت حقيقي أو Firestore حقيقي.
- **التوسع المستقبلي**: كل "خدمة" (Service) مستقلة بذاتها، وهذا يجهزنا لو حبينا يومًا نفصلها
  كخدمات منفصلة (microservices) — مثال: OrderService يصير سيرفر API منفصل.

## 3 بوتات منفصلة، قاعدة بيانات واحدة

- `src/bots/adminBot.js` — بوت التاجر على Telegram (إدارة المنتجات، الطلبات، الإعدادات)
- `src/bots/superAdminBot.js` — بوت السوبر أدمن على Telegram (إدارة المتاجر والباقات - أنت فقط)
- `src/bots/customerBot.js` — بوت الزبون على **Facebook Messenger** (وليس Telegram)، يخدم كل
  المتاجر عبر رابط `m.me/الصفحة?ref=storeId`، ويشتغل كسيرفر HTTP (Express) يستقبل webhook
  من فيسبوك، بعكس البوتين الآخرين اللي يشتغلو بـ long polling عادي (Telegraf).

كل بوت = عملية (process) منفصلة، وكلها تستعمل نفس `src/repositories` و`src/services`
ونفس قاعدة بيانات Firestore. هذا معناه: منطق الأعمال (مثال: "كيفاش نحسبو خصم الكوبون")
مكتوب مرة وحدة فقط، ويُستعمل من كل الجهات - حتى أن بوت التاجر Telegram وبوت الزبون Facebook
يشتركان في نفس `ProductService`/`OrderService`/`engine/responseEngine.js` بلا أي تكرار.

## الأحداث (Events) والطوابير (Queues)

- **eventBus** (`src/events/eventBus.js`): ناقل أحداث داخل نفس العملية (in-process).
  عندما يصدر `OrderService` حدث `order.created`، تستمع له `NotificationService` (ترسل إشعار)
  و`AnalyticsService` (تسجل إحصائية) بشكل مستقل تمامًا.
- **queue** (`src/queues/queue.js`): طابور مهام في الذاكرة حاليًا، بواجهة مطابقة لـ BullMQ،
  جاهز يتبدل بـ Redis حقيقي بلا تعديل باقي المشروع.

⚠️ **حد مهم يخصك تعرفه**: بما أن eventBus والطابور في الذاكرة، فهما محدودان بحدود عملية واحدة (process).
إذا شغلت أكثر من نسخة (instance) من نفس البوت (مثال: توسع أفقي/scaling)، كل نسخة عندها eventBus
وطابور منفصلين. هذا مقبول للحجم الحالي، لكن لما يكبر النظام فعليًا، هذا أول شيء يحتاج ينتقل
لـ Redis Pub/Sub أو BullMQ الحقيقي (البنية مجهزة لهذا الانتقال، راجع التعليقات داخل `queue.js`).

## الجداول (Firestore Collections)

```
stores/{storeId}
  ├── products/{productId}
  ├── orders/{orderId}
  ├── customers/{customerId}      (customerId = Facebook PSID تاع الزبون)
  ├── messages/{messageId}       (سجل رسائل - للتحليل المستقبلي)
  ├── coupons/{couponId}
  └── analyticsEvents/{eventId}
```

`storeId` = Telegram ID تاع صاحب المتجر (في هذه النسخة، تاجر واحد = متجر واحد).

بالإضافة إلى ذلك: `messengerSessions/{psid}` (على مستوى الجذر، ماشي تحت `stores/`) - تخزّن جلسة كل زبون فيسبوك (أي متجر يتصفح، وأي خطوة هو فيها إذا كان وسط تعبئة طلب)، لأن Messenger webhook بلا حالة بين الطلبات (بعكس `ctx.session` تاع Telegraf).

راجع أيضًا: [FOLDERS.md](./FOLDERS.md)، [SERVICES.md](./SERVICES.md)، [FLOWS.md](./FLOWS.md)،
وللاطلاع على نظام التعلّم والذاكرة (ذاكرة كل متجر، القاموس المحلي، دفتر القرارات، زر "علمني"):
[../src/learning/README.md](../src/learning/README.md)
