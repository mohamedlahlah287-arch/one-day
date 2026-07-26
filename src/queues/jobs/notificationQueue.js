const { createQueue } = require('../queue');
const NotificationService = require('../../services/NotificationService');
const logger = require('../../utils/logger');

// طابور مخصص لإرسال الإشعارات بلا ما توقف الطلب الأساسي (fire-and-forget بأمان)
const notificationQueue = createQueue('notifications');

notificationQueue.process('notifyStoreOwner', async (job) => {
  const { storeId, message } = job.data;
  await NotificationService.notifyStoreOwner(storeId, message);
});

notificationQueue.process('notifyCustomer', async (job) => {
  const { storeId, customerId, message } = job.data;
  await NotificationService.notifyCustomer(storeId, customerId, message);
});

logger.debug('طابور الإشعارات جاهز');

module.exports = notificationQueue;
