const BaseRepository = require('./BaseRepository');

class CouponRepository extends BaseRepository {
  constructor() {
    super('coupons');
  }

  async findByCode(storeId, code) {
    const snap = await this.collectionRef(storeId).where('code', '==', code.toUpperCase()).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  }
}

module.exports = new CouponRepository();
