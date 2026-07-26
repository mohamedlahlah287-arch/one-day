// scripts/migrateVoiceNoteConditions.js
// -----------------------------------------------------------------------------------
// Migration تلقائي وآمن (البند العاشر فـ متطلبات نظام الردود الصوتية الذكي): يمرّ على كل
// المتاجر، ولكل متجر يمرّ على كل وثائق stores/{id}/voiceNotes/{intentKey}، ويضيف حقل
// "conditions" (شروط التشغيل: requiresProduct/noProductAction/noProductText) لأي وثيقة
// ماكانتش تحتويه بعد (رسائل صوتية سُجّلت قبل هذا التحديث).
//
// آمن 100% وقابل للتكرار (Idempotent):
//   - لا يمس أي حقل آخر (fileId/url/duration) - استعمال merge:true.
//   - يتخطى تمامًا أي وثيقة عندها "conditions" مسبقًا (ماشي تصادف مع تخصيص التاجر).
//   - لا يحذف ولا ينشئ منتجات/متاجر - فقط يضيف حقلًا مفقودًا.
// حتى بدون تشغيل هذا السكريبت، النظام يشتغل صحيح (VoiceNoteService.getConditionsForIntent
// يدمج الافتراضيات فـ وقت القراءة) - هذا السكريبت اختياري، فقط يجعل البيانات المخزَّنة صراحةً
// متطابقة مع الافتراضيات الحالية (مفيد مثلاً لو أردت لاحقًا استعلام Firestore مباشرة بحقل
// conditions.requiresProduct بلا المرور بكود التطبيق).
//
// تشغيل: node scripts/migrateVoiceNoteConditions.js
// -----------------------------------------------------------------------------------

const { db, FieldValue } = require('../src/database/firestore');
const { defaultConditionsFor } = require('../src/engine/voiceConditions');
const logger = require('../src/utils/logger');

async function migrate() {
  const storesSnap = await db.collection('stores').get();
  logger.info(`🔧 Migration شروط التشغيل: ${storesSnap.size} متجر`);

  let updated = 0;
  let skipped = 0;

  for (const storeDoc of storesSnap.docs) {
    const storeId = storeDoc.id;
    const voiceNotesSnap = await db.collection('stores').doc(storeId).collection('voiceNotes').get();

    for (const noteDoc of voiceNotesSnap.docs) {
      const data = noteDoc.data();
      if (data.conditions) {
        skipped += 1;
        continue; // عنده شروط مخزَّنة مسبقًا (ربما خصّصها التاجر) - ما نلمسوهاش
      }
      const intentKey = data.intentKey || noteDoc.id;
      await noteDoc.ref.set(
        { conditions: defaultConditionsFor(intentKey), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      updated += 1;
      logger.info('✅ تمت إضافة شروط التشغيل الافتراضية', { storeId, intentKey });
    }
  }

  logger.info(`🎉 انتهى الـ Migration: ${updated} وثيقة تم تحديثها، ${skipped} وثيقة عندها شروط مسبقًا (تُركت كما هي)`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('❌ فشل Migration شروط التشغيل', { error: err.message });
    process.exit(1);
  });
