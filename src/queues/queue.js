const logger = require('../utils/logger');
const { env } = require('../config/env');

/**
 * طابور مهام داخلي بسيط (in-memory).
 *
 * الواجهة (add / process) مصممة عمدًا لتشبه BullMQ:
 *   queue.add('sendMessage', { chatId, text })
 *   queue.process('sendMessage', async (job) => {...})
 *
 * لما يتوفر Redis (env.queue.redisUrl)، نبدلو محتوى هذا الملف فقط بتنفيذ BullMQ حقيقي،
 * بلا ما نلمسو أي كود آخر يستعمل queue.add() في المشروع.
 *
 * تحذير: الطابور الحالي في الذاكرة فقط - إذا توقف السيرفر تضيع المهام غير المنفذة.
 * هذا مقبول لمرحلة MVP، لكن غير مناسب لحمل إنتاجي حقيقي (لهذا خاصنا Redis لاحقًا).
 */
class InMemoryQueue {
  constructor(name) {
    this.name = name;
    this.handlers = new Map();
  }

  process(jobName, handler) {
    this.handlers.set(jobName, handler);
  }

  async add(jobName, data, options = {}) {
    const handler = this.handlers.get(jobName);
    if (!handler) {
      logger.warn(`لا يوجد معالج مسجل للمهمة: ${jobName}`);
      return;
    }
    const delay = options.delay || 0;
    setTimeout(async () => {
      try {
        await handler({ name: jobName, data });
      } catch (err) {
        logger.error(`فشلت مهمة الطابور: ${jobName}`, err);
      }
    }, delay);
  }
}

function createQueue(name) {
  if (env.queue.redisUrl) {
    // TODO: لما تتوفر بنية Redis، نبدل هذا بـ:
    // const { Queue } = require('bullmq');
    // return new Queue(name, { connection: { url: env.queue.redisUrl } });
    logger.warn('REDIS_URL موجود لكن BullMQ غير مفعّل بعد - نستعمل الطابور الداخلي');
  }
  return new InMemoryQueue(name);
}

module.exports = { createQueue };
