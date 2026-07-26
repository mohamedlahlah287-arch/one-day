# تكامل شركات التوصيل

أول جزء منفَّذ من خطة تحويل RedonBot إلى منصة SaaS كاملة. هذا الملف يوثّق الجزء الأول
فقط (شركات التوصيل)؛ بقية الأجزاء (الذكاء الاصطناعي، Broadcast، Excel، الردود الصوتية...)
سيُضاف توثيقها تباعًا مع كل مرحلة.

## البنية

- `src/config/deliveryProviders.js` — سجل الشركات المدعومة (Yalidine مفعّلة، والباقي "قريبًا").
- `src/config/shipmentStatuses.js` — حالات الشحنة الموحّدة + رسائل الزبون التلقائية.
- `src/services/delivery/adapters/` — Adapter لكل شركة (Strategy pattern). `BaseDeliveryAdapter`
  يحدد العقد المشترك (`testConnection`, `createShipment`, `getShipmentStatus`)، و`YalidineAdapter`
  أول تنفيذ حقيقي له.
- `src/services/delivery/DeliveryProviderFactory.js` — يُرجع الـ Adapter المناسب حسب اسم الشركة.
- `src/services/DeliveryService.js` — المنطق الكامل: ربط/فك ربط شركة، اختبار الاتصال، إنشاء
  شحنة لطلب، مزامنة حالته.
- `src/jobs/deliveryStatusSyncJob.js` — مهمة مجدولة كل 10 دقائق تفحص كل الشحنات غير المنتهية
  عبر كل المتاجر النشطة وتُحدّث حالتها تلقائيًا.
- إشعار الزبون التلقائي عند كل تغيّر حالة: `src/events/listeners/notificationListeners.js`
  (حدث `shipment.status_changed`).

## بيانات الاعتماد

تُحفظ بيانات كل تاجر تحت `stores/{storeId}.deliveryProviders.{providerId}` (منفصلة عن باقي
حقول المتجر بفضل dot-notation)، ولا تُعاد أبدًا فـ استجابات API (`GET /delivery-providers`
يُرجع فقط `connected/lastTestOk/connectedAt`، بدون API Token).

## نقاط API الجديدة (`/api/dashboard/...`)

| Method | المسار | الوصف |
|---|---|---|
| GET | `/delivery-providers` | قائمة كل الشركات + حالة الربط لهذا المتجر |
| POST | `/delivery-providers/:providerId/test` | اختبار بيانات اعتماد قبل حفظها |
| POST | `/delivery-providers/:providerId/connect` | ربط شركة (يختبر الاتصال تلقائيًا قبل الحفظ) |
| DELETE | `/delivery-providers/:providerId` | فك الربط |
| POST | `/orders/:orderId/shipment` | إنشاء شحنة لطلب (`{ providerId }`) |
| POST | `/orders/:orderId/shipment/sync` | مزامنة فورية لحالة شحنة طلب معيّن |

## ما تبقّى لإكمال هذا الجزء

- **واجهة الاستخدام (Frontend)**: صفحة "شركات التوصيل" داخل `public/dashboard/store-settings.html`
  (أو صفحة مستقلة) لعرض الجدول أعلاه بشكل بصري - لم تُبنَ بعد.
- **الإنشاء التلقائي للشحنة عند تأكيد الطلب** (خيار "تلقائي" مقابل "يدوي" فـ إعدادات المتجر):
  يحتاج حقل جديد فـ إعدادات المتجر + استدعاء `DeliveryService.createShipmentForOrder` من
  داخل `OrderService` عند تغيير الحالة إلى "تم التأكيد" إذا كان الخيار مفعّلًا.
  حاليًا الإنشاء يدوي فقط (عبر نقطة الـ API أعلاه).
  Feature #5 (صفحة تتبع علنية للزبون) لم تُبنَ بعد أيضًا.
- **ZR Express / Maystro / Noest**: الهيكلة جاهزة لإضافتهم (Adapter جديد + سطر فـ
  `DeliveryProviderFactory` + `enabled: true` فـ `deliveryProviders.js`)، لكن لا تنفيذ فعلي بعد.
- تحقق من التوثيق الرسمي لـ Yalidine (يتطلب حساب) قبل الإطلاق للتأكد من مطابقة أسماء الحقول
  والحالات الخام المستعملة فـ `YalidineAdapter.js`.
