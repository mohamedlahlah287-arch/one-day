# مخططات التدفق (Flows)

## 1. إنشاء متجر جديد (من طرف السوبر أدمن فقط)

```
السوبر أدمن يضغط "➕ إضافة متجر جديد" في بوت السوبر أدمن
   → superAdminGuard (يتأكد أن المرسل هو SUPER_ADMIN_TELEGRAM_ID فقط)
   → ADD_STORE_SCENE: يدخل معرف Telegram للتاجر + اسم المتجر
   → يختار باقة (starter/pro/business أو مخصصة)
   → StoreService.adminCreateStore()
   → StoreRepository.create() (يحفظ الباقة: حد الرسائل/المنتجات/المميزات + تاريخ انتهاء)
   → eventBus.emit('store.registered')
       → AnalyticsService.track('store_registered')
       → NotificationService.notifySuperAdmin()

التاجر يفتح بوت التاجر ويرسل /start
   → adminBot: bot.start()
   → StoreService.getStore() → موجود (لأن السوبر أدمن أنشأه مسبقًا)
   → يعرض معلومات المتجر (الباقة، استهلاك الرسائل) + القائمة الرئيسية

⚠️ لا يوجد تسجيل ذاتي: لو حاول شخص غير مسجل استعمال بوت التاجر، يرد عليه البوت بأنه غير مسجل.
```

## 2. زبون يدخل من رابط متجر ويطلب منتج (Facebook Messenger)

```
الزبون يضغط رابط m.me/الصفحة?ref=storeId (من إعلان أو صفحة التاجر)
   → فيسبوك يبعت POST /webhook بحدث فيه referral.ref (أو postback.referral.ref لأول مرة)
   → customer.routes.js: processEvent() يكتشف الـ ref
   → catalogController.startForStore(psid, storeId)
   → FacebookSessionRepository.set(psid, { storeId })  (يعادل ctx.session.storeId تاع تليغرام)
   → CustomerService.findOrRegister()
   → رسالة ترحيب + quick reply "🛍️ عرض المنتجات"

الزبون يضغط "عرض المنتجات" أو يكتب اسم منتج
   → catalogController.sendProductList / handleFreeText
   → ProductService.listAvailableProducts()
   → engine.detectIntent() / engine.findProductByName()  (فهم النية - نفس المحرك المستعمل سابقًا مع تليغرام)
   → FacebookMessengerService.sendProductCard() (بطاقة فيها صورة + وصف + زر "🛒 اطلب الآن")

الزبون يضغط "اطلب الآن" (postback: BUY_<productId>)
   → orderController.startOrderFromProduct()
   → FacebookSessionRepository.set(psid, { orderState: 'AWAITING_NAME', orderDraft: {...} })
   → كل رسالة نصية جاية بعدها تمر عبر orderController.handleOrderStep()
     (نفس خطوات تليغرام: الاسم → الهاتف validatePhone() → الولاية → البلدية → العنوان → الوقت)
   → عرض ملخص + quick replies "✅ نعم أؤكد" / "❌ إلغاء"

الزبون يضغط "✅ نعم أؤكد" (quick_reply payload: CONFIRM_ORDER)
   → orderController.confirmOrder()
   → OrderService.createOrder()
       → ProductService.getProduct() (يتأكد من السعر الحقيقي)
       → CouponService.validateAndApply() (لو كاين كود خصم)
       → OrderRepository.create()
       → ProductService.reduceStockAfterOrder()
       → eventBus.emit('order.created')
           → NotificationService.notifyStoreOwner()  (إشعار Telegram فوري للتاجر)
           → AnalyticsService.track('order_created')
```

ملاحظة مهمة: كل حدث Messenger يمر أولاً عبر فحص نشاط المتجر وحصة الرسائل (`MessageQuotaService`)
داخل `customer.routes.js: processEvent()`، تمامًا كيما كان `quotaGuard` في نسخة تليغرام القديمة.

## 3. تاجر يغيّر حالة طلب

```
تاجر يضغط زر "✅ تم التأكيد" تحت الطلب
   → adminBot: bot.action(/order_.../)
   → orderController.updateOrderStatusAction
   → OrderService.updateStatus()
   → OrderRepository.update()
   → eventBus.emit('order.status_changed')
   → لو الحالة "ملغى": eventBus.emit('order.cancelled')
       → AnalyticsService.track('order_cancelled')
```

## 4. مهمة مجدولة (تذكير بطلب معلق)

```
كل ساعة (node-cron في scheduler.js)
   → reminderJob()
   → StoreRepository.findAllActive()
   → لكل متجر: ReminderService.remindPendingOrders()
       → OrderRepository.findPendingOlderThan()
       → NotificationService.notifyStoreOwner() لكل طلب معلق
```
