const PromoCodeService = require('../services/PromoCodeService');
const logger = require('../utils/logger');

async function promoCodeExpirationJob() {
  const reverted = await PromoCodeService.revertExpiredTrials();
  if (reverted) logger.info('promoCodeExpirationJob: تم إرجاع متاجر لباقتها الأصلية', { count: reverted });
}

module.exports = promoCodeExpirationJob;
