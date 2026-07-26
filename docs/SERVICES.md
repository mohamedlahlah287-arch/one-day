# شرح الخدمات (Services)

كل خدمة مسؤولة عن شيء وحيد فقط (Single Responsibility).

| الخدمة | المسؤولية | تصدر أحداث؟ |
|---|---|---|
| `StoreService` | تسجيل متجر جديد، تحديث إعداداته | `store.registered` |
| `ProductService` | إضافة/حذف/عرض منتجات، تقليل المخزون | `product.created`, `product.out_of_stock` |
| `OrderService` | إنشاء طلب (يتحقق من المنتج + يطبق الكوبون)، تحديث حالته، إحصائيات | `order.created`, `order.status_changed`, `order.cancelled` |
| `CouponService` | التحقق من صلاحية كوبون وحساب الخصم | - |
| `CustomerService` | تسجيل/تحديث بيانات الزبون (لاكتشاف العملاء المتكررين) | `customer.registered` |
| `SubscriptionService` | تفعيل اشتراك التاجر، فحص المنتهي | `subscription.expired` |
| `PaymentService` | **Stub حاليًا** - طلبات دفع يدوية (BaridiMob) بانتظار مزود دفع حقيقي | - |
| `NotificationService` | إرسال إشعارات: Telegram لصاحب المتجر/السوبر أدمن، Facebook Messenger للزبون | - (تستمع للأحداث، ما تصدرش) |
| `AnalyticsService` | تسجيل أحداث تحليلية بسيطة في Firestore | - (تستمع، ما تصدرش) |
| `ReminderService` | البحث عن طلبات معلقة وتذكير التاجر | - |
| `MessageQuotaService` | فحص/استهلاك حصة الرسائل الشهرية لكل متجر حسب باقته | - |
| `FacebookMessengerService` | كل تواصل خام مع Graph API (إرسال نص/بطاقات منتج/quick replies، تحقق توقيع webhook) | - |
| `AIMediaService` | تحويل صوت لنص وتحليل صور عبر Groq API (اختياري، حسب باقة المتجر) | - |

## قاعدة مهمة

خدمة **لا تستدعي خدمة أخرى مباشرة إلا لو كانت تابعة منطقيًا لنفس العملية** (مثال: `OrderService`
يستدعي `ProductService.getProduct` لأنه محتاج يتأكد من سعر المنتج الحقيقي — هذا طبيعي).

أما التفاعلات "الجانبية" (إشعار، تحليل، تذكير) فتتم **عبر الأحداث فقط** (`eventBus`)، ماشي باستدعاء مباشر.
هذا يخلي `OrderService` ما يعرفش حتى بوجود `NotificationService` أو `AnalyticsService` — فصل كامل.
