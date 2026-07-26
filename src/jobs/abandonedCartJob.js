const AbandonedCartService = require('../services/AbandonedCartService');
const logger = require('../utils/logger');

// يفحص كل الزبائن اللي بداو طلب وما كملوهش، ويرسل تذكير لطيف (مرة بعد ساعة، مرة بعد يوم)
async function abandonedCartJob() {
  const result = await AbandonedCartService.runFollowUps();
  logger.info('abandonedCartJob: تم الفحص', result);
}

module.exports = abandonedCartJob;
