const ProductService = require('../../services/ProductService');
const { productsMenu } = require('../../ui/adminKeyboards');
const { env } = require('../../config/env');
const { buildProductRef } = require('../../ui/customerKeyboards');

// Controllers: تتحقق من الشكل العام للطلب، تنادي على الخدمة، وترجع الرد. بلا منطق أعمال هنا.

// يبني رابط Messenger مباشر لمنتج معيّن: عند فتحه الزبون يشوف اسم المنتج وسعره ووصفه فورًا.
function buildDirectProductLink(store, productId) {
  const pageHandle = store.facebookConnected && store.facebookPageId ? store.facebookPageId : env.facebook.pageUsername;
  if (!pageHandle) return null;
  return `https://m.me/${pageHandle}?ref=${buildProductRef(store.id, productId)}`;
}

async function showProductsMenu(ctx) {
  await ctx.reply('📦 قائمة المنتجات:', productsMenu);
}

async function startAddProduct(ctx) {
  const storeId = ctx.state.store.id;
  const productLimit = ctx.state.store?.productLimit;
  if (productLimit !== null && productLimit !== undefined) {
    const currentCount = await ProductService.listProducts(storeId);
    if (currentCount.length >= productLimit) {
      await ctx.reply(
        `🚫 وصلت للحد الأقصى من المنتجات في باقتك الحالية (${productLimit} منتج).\n\nتواصل مع الإدارة للترقية لباقة أعلى.`
      );
      return;
    }
  }
  return ctx.scene.enter('ADD_PRODUCT_SCENE', { storeId });
}

async function listAllProducts(ctx) {
  const store = ctx.state.store;
  const storeId = store.id;
  const products = await ProductService.listProducts(storeId);
  if (products.length === 0) {
    await ctx.reply('لا توجد منتجات بعد. اضغط "➕ إضافة منتج" لإضافة أول منتج.');
    return;
  }
  for (const p of products) {
    const link = buildDirectProductLink(store, p.id);
    const linkLine = link ? `\n\n🔗 رابط مباشر للمنتج:\n${link}` : '';
    const stockLine =
      p.quantity === null || p.quantity === undefined
        ? '♾️ الكمية: غير محدودة'
        : p.quantity > 0
          ? `📦 الكمية المتبقية: ${p.quantity}`
          : '🔴 نفدت الكمية (غير ظاهر للزبائن حاليًا!)';
    const caption = `📦 ${p.name}\n💰 ${p.price} دج\n📝 ${p.description || '-'}\n🚚 ${p.deliveryTime || '-'}\n🛡️ ${p.warranty || '-'}\n${stockLine}\n\n🆔 ${p.id}${linkLine}`;
    if (p.imageFileId) {
      await ctx.replyWithPhoto(p.imageFileId, { caption });
    } else {
      await ctx.reply(caption);
    }
  }
}

async function promptDeleteProduct(ctx) {
  const storeId = ctx.state.store.id;
  const products = await ProductService.listProducts(storeId);
  if (products.length === 0) {
    await ctx.reply('لا توجد منتجات لحذفها.');
    return;
  }
  const list = products.map((p, i) => `${i + 1}. ${p.name} — 🆔 ${p.id}`).join('\n');
  await ctx.reply(`أرسل 🆔 المنتج اللي تحب تحذفه:\n\n${list}`);
  ctx.session.awaitingDeleteProductId = true;
}

async function handleDeleteProductId(ctx) {
  const storeId = ctx.state.store.id;
  const productId = ctx.message.text.trim();
  try {
    const product = await ProductService.getProduct(storeId, productId);
    await ProductService.deleteProduct(storeId, productId);
    ctx.session.awaitingDeleteProductId = false;
    await ctx.reply(`🗑 تم حذف "${product.name}" بنجاح.`, productsMenu);
  } catch (err) {
    await ctx.reply(`⚠️ ${err.message}. حاول مرة أخرى أو اضغط "⬅️ رجوع للقائمة الرئيسية".`);
  }
}

module.exports = { showProductsMenu, startAddProduct, listAllProducts, promptDeleteProduct, handleDeleteProductId };
