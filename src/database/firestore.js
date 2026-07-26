const { admin, app } = require('../config/firebase');
const { env } = require('../config/env');
const logger = require('../utils/logger');

// كل الوصول لـ Firestore في المشروع يمر من هنا فقط.
// أي مكتبة أو خدمة تحتاج قاعدة البيانات تستورد هذا الملف، ماشي config/firebase مباشرة.
//
// دعم قاعدة بيانات باسم مخصص (ماشي "(default)"): لو أنشأت قاعدة Firestore وسميتها باسم غير
// الافتراضي (مثال: كتبت "default" بلا الأقواس كـ database ID مخصص عند الإنشاء)، الكود العادي
// admin.firestore() يبحث فقط عن "(default)" ويطيح بخطأ "5 NOT_FOUND" لأنه ما يلقاهاش.
// FIREBASE_DATABASE_ID (اختياري فـ .env) يحل هذا: إذا محدد، نستعمل getFirestore(app, id).
let db;
if (env.firebase.databaseId) {
  const { getFirestore } = require('firebase-admin/firestore');
  db = getFirestore(app, env.firebase.databaseId);
  logger.info('📦 Firestore متصل بقاعدة بيانات مخصصة', { databaseId: env.firebase.databaseId });
} else {
  db = admin.firestore();
}

// إجبار Firestore على استعمال REST بدل gRPC.
// بعض منصات الاستضافة (Railway وغيرها) عندها قيود شبكية على اتصالات gRPC/HTTP2 الطويلة،
// وهذا كيسبب أخطاء غامضة مثل "5 NOT_FOUND" بلا أي تفصيل، حتى لو كانت كل الإعدادات صحيحة.
// preferRest: true كيخلي كل العمليات تمر عبر REST API العادي، وهذا كيحل هذا النوع من المشاكل.
db.settings({ preferRest: true });

module.exports = { db, admin, FieldValue: admin.firestore.FieldValue };
