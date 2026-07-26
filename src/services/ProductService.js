const ProductRepository = require('../repositories/ProductRepository');
const eventBus = require('../events/eventBus');
const events = require('../events/eventNames');
const { ValidationError } = require('../errors');

const LOW_STOCK_THRESHOLD = 3;

class ProductService {
  async addProduct(storeId, productData) {
    this.validateProduct(productData);
    const id = await ProductRepository.create(storeId, productData);
    eventBus.emit(events.PRODUCT_CREATED, { storeId, productId: id, product: productData });
    return id;
  }

  validateProduct(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 2) errors.push('name');
    if (data.price === undefined || Number.isNaN(Number(data.price)) || Number(data.price) <= 0) {
      errors.push('price');
    }
    if (errors.length) throw new ValidationError('بيانات المنتج غير صحيحة', errors);
  }

  async listProducts(storeId) {
    return ProductRepository.findAll(storeId, { limit: 200 });
  }

  async listAvailableProducts(storeId) {
    return ProductRepository.findAllInStock(storeId);
  }

  async getProduct(storeId, productId) {
    return ProductRepository.findByIdOrFail(storeId, productId, 'المنتج');
  }

  async deleteProduct(storeId, productId) {
    await ProductRepository.findByIdOrFail(storeId, productId, 'المنتج');
    return ProductRepository.delete(storeId, productId);
  }

  async reduceStockAfterOrder(storeId, productId, quantity = 1) {
    const newQty = await ProductRepository.decrementQuantity(storeId, productId, quantity);
    if (newQty === null || newQty === undefined) return; // كمية غير محدودة - بلا تنبيهات
    const product = await ProductRepository.findById(storeId, productId);
    if (!product) return;
    if (newQty === 0) {
      eventBus.emit(events.PRODUCT_OUT_OF_STOCK, { storeId, productId, productName: product.name });
    } else if (newQty <= LOW_STOCK_THRESHOLD) {
      eventBus.emit(events.PRODUCT_LOW_STOCK, { storeId, productId, productName: product.name, quantity: newQty });
    }
  }
}

module.exports = new ProductService();
