const BaseRepository = require('../repositories/BaseRepository');
const { FieldValue } = require('../database/firestore');

// VoiceNoteRepository: رسائل صوتية "عامة" يسجلها التاجر لنية معينة (تحية، توصيل، ضمان...)
// - وليس رسائل صوتية خاصة بمنتج معين (تلك تعيش كحقل مباشر على وثيقة المنتج نفسه، راجع
// VoiceNoteService.attachToProduct). نستعمل مفتاح النية (intentKey) كمعرف الوثيقة مباشرة
// (مثل StoreDictionaryRepository) حتى يكون "تسجيل/استبدال" رسالة صوتية لنفس النية عملية
// واحدة بسيطة (set) بلا حاجة للبحث أولاً عن وثيقة قديمة.
// stores/{storeId}/voiceNotes/{intentKey}
class VoiceNoteRepository extends BaseRepository {
  constructor() {
    super('voiceNotes');
  }

  async setForIntent(storeId, intentKey, { fileId, url, duration = null }) {
    const ref = this.collectionRef(storeId).doc(intentKey);
    await ref.set(
      {
        intentKey,
        fileId,
        url,
        duration,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { id: intentKey, intentKey, fileId, url, duration };
  }

  async getForIntent(storeId, intentKey) {
    return this.findById(storeId, intentKey);
  }

  async removeForIntent(storeId, intentKey) {
    return this.delete(storeId, intentKey);
  }

  // يحفظ "شروط التشغيل" لنية معينة (conditions: { requiresProduct, noProductAction,
  // noProductText }) - منفصل عن setForIntent حتى يقدر التاجر يضبط الشروط حتى بلا ما
  // يكون سجّل صوتًا بعد (الوثيقة تُنشأ بـ merge:true إذا ماكانتش موجودة أصلاً).
  async setConditions(storeId, intentKey, conditions) {
    const ref = this.collectionRef(storeId).doc(intentKey);
    await ref.set(
      {
        intentKey,
        conditions,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return this.getForIntent(storeId, intentKey);
  }


  async findAllVoiceNotes(storeId) {
    return this.findAll(storeId, { limit: 50 });
  }
}

module.exports = new VoiceNoteRepository();
