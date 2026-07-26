const { db, FieldValue } = require('../database/firestore');

// مجموعة مستقلة على مستوى المنصة كلها (ماشي خاصة بمتجر وحيد): promoCodes/{code}
// كل كود يعطي التاجر اللي يستعمله وصول مؤقت لباقة معينة (مميزات/حدود يحددها السوبر أدمن)
// لمدة ساعات محددة، وله تاريخ صلاحية (بعده الكود ما يصلحش للاستعمال حتى لو ما استُعمل).
class PromoCodeRepository {
  collectionRef() {
    return db.collection('promoCodes');
  }

  async findByCode(code) {
    const snap = await this.collectionRef().doc(code.toUpperCase()).get();
    return snap.exists ? { code: snap.id, ...snap.data() } : null;
  }

  async create(code, data) {
    const id = code.toUpperCase();
    await this.collectionRef().doc(id).set({
      ...data,
      usedByStoreIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    return this.findByCode(id);
  }

  async markUsedBy(code, storeId) {
    await this.collectionRef()
      .doc(code.toUpperCase())
      .update({ usedByStoreIds: FieldValue.arrayUnion(String(storeId)) });
  }

  async delete(code) {
    await this.collectionRef().doc(code.toUpperCase()).delete();
  }
}

module.exports = new PromoCodeRepository();
