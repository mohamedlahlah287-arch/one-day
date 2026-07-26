const { db, FieldValue } = require('../database/firestore');
const { ORDER_STEPS } = require('../config/orderStates');

// جلسة كل زبون فيسبوك (PSID) مخزّنة في Firestore بدل ctx.session تاع تليغراف،
// لأن Messenger يشتغل عبر webhook (بلا حالة داخلية بين الطلبات مثل telegraf session()).
// المجموعة: messengerSessions/{psid}
class FacebookSessionRepository {
  docRef(psid) {
    return db.collection('messengerSessions').doc(String(psid));
  }

  async get(psid) {
    const snap = await this.docRef(psid).get();
    return snap.exists ? snap.data() : null;
  }

  async set(psid, fields) {
    await this.docRef(psid).set({ ...fields, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  async clearOrderState(psid) {
    await this.docRef(psid).set(
      { orderState: null, orderDraft: null, abandonedReminderStage: 0, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  // كل الجلسات اللي وسط تعبئة طلب (لم تؤكد ولا تلغي بعد) - يُستعمل من جوب متابعة السلة المتروكة
  async findAbandonedCandidates() {
    const snap = await db.collection('messengerSessions').where('orderState', 'in', ORDER_STEPS).get();
    return snap.docs.map((d) => ({ psid: d.id, ...d.data() }));
  }

  async markReminderSent(psid, stage) {
    await this.docRef(psid).set({ abandonedReminderStage: stage }, { merge: true });
  }

  // نسخة مخصّصة بمتجر واحد لعرضها فـ لوحة تحكم الموقع (قسم "السلات المتروكة") - نفس شرط
  // findAbandonedCandidates لكن مفلترة بـ storeId ومرتبة الأحدث أولًا لعرض مفيد للتاجر.
  async findByStore(storeId, { limit = 100 } = {}) {
    const snap = await db
      .collection('messengerSessions')
      .where('storeId', '==', storeId)
      .where('orderState', 'in', ORDER_STEPS)
      .limit(limit)
      .get();
    const sessions = snap.docs.map((d) => ({ psid: d.id, ...d.data() }));
    sessions.sort((a, b) => {
      const at = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
      const bt = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
      return bt - at;
    });
    return sessions;
  }
}

module.exports = new FacebookSessionRepository();
