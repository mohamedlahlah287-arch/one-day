const BaseRepository = require('./BaseRepository');

class RatingRepository extends BaseRepository {
  constructor() {
    super('ratings');
  }

  async getAverage(storeId) {
    const all = await this.findAll(storeId, { limit: 1000 });
    if (all.length === 0) return { average: null, count: 0 };
    const sum = all.reduce((s, r) => s + Number(r.stars || 0), 0);
    return { average: Math.round((sum / all.length) * 10) / 10, count: all.length };
  }
}

module.exports = new RatingRepository();
