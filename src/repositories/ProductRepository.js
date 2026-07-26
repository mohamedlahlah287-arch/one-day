const BaseRepository = require('./BaseRepository');

class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  async findAllInStock(storeId) {
    const all = await this.findAll(storeId, { limit: 200 });
    return all.filter((p) => p.quantity === null || p.quantity === undefined || p.quantity > 0);
  }

  async decrementQuantity(storeId, productId, amount = 1) {
    const product = await this.findById(storeId, productId);
    if (!product || product.quantity === null || product.quantity === undefined) return null; // كمية غير محدودة
    const newQty = Math.max(0, product.quantity - amount);
    await this.update(storeId, productId, { quantity: newQty });
    return newQty;
  }
}

module.exports = new ProductRepository();
