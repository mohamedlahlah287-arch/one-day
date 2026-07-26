# شرح المجلدات

| المجلد | المسؤولية | مثال |
|---|---|---|
| `src/config/` | تحميل والتحقق من متغيرات البيئة، إعداد Firebase | `env.js`, `firebase.js` |
| `src/database/` | مثيل Firestore الوحيد في المشروع | `firestore.js` |
| `src/errors/` | فئات الأخطاء المخصصة | `AppError`, `NotFoundError`, `ValidationError` |
| `src/utils/` | أدوات عامة، أهمها Logger | `logger.js` |
| `src/repositories/` | الوصول الوحيد المسموح لـ Firestore | `ProductRepository`, `OrderRepository` |
| `src/services/` | كل منطق الأعمال | `OrderService`, `CouponService` |
| `src/events/` | ناقل الأحداث + الاستماعات | `eventBus.js`, `listeners/` |
| `src/queues/` | نظام الطوابير (جاهز لـ BullMQ) | `queue.js` |
| `src/jobs/` | المهام المجدولة (cron) | `reminderJob.js`, `dailyReportJob.js` |
| `src/middlewares/` | حماية وتحقق قبل الوصول للـ Controller | `authGuard.js`, `rateLimiter.js` |
| `src/validators/` | التحقق من شكل المدخلات (قبل الخدمة) | `orderValidator.js` |
| `src/controllers/` | طبقة رقيقة تربط الطلب بالخدمة | `admin/productController.js` |
| `src/routes/` | ربط أوامر/رسائل Telegram أو أحداث Facebook Messenger webhook بالـ Controllers | `admin.routes.js`, `customer.routes.js` (Express) |
| `src/bots/` | نقاط الدخول (entry points) لكل بوت + المشاهد (Scenes) | `adminBot.js` (تليغرام), `superAdminBot.js` (تليغرام), `customerBot.js` (سيرفر Express لـ Facebook Messenger) |
| `src/ui/` | لوحات المفاتيح (Keyboards) | `adminKeyboards.js` |
| `src/engine/` | محرك فهم النية (كلمات مفتاحية) | `responseEngine.js` |
| `src/learning/` | نظام التعلّم والذاكرة (ذاكرة كل متجر، قاموس محلي، دفتر قرارات، زر "علمني"، إحصائيات) - راجع `src/learning/README.md` | `intentResolver.js`, `StoreDictionaryService.js` |
| `src/voiceNotes/` | الرسائل الصوتية للتاجر (باقة الأعمال فقط) - راجع `src/voiceNotes/README.md` | `VoiceNoteService.js` |
| `tests/` | اختبارات الوحدة والتكامل | `unit/`, `integration/` |
| `docs/` | هذا التوثيق | - |
| `logs/` | ملفات اللوقات (يوم بيوم) | `2026-07-01.log` |
