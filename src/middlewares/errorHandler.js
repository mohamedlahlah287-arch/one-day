const AppError = require('../errors/AppError');
const logger = require('../utils/logger');
const { reportError } = require('../utils/errorReporter');

// toUserMessage: يحول أي خطأ لرسالة آمنة للمستخدم.
// أخطاءنا الخاصة (ValidationError/NotFoundError...) رسالتها واضحة ومقصودة، فنعرضها كما هي.
// أي خطأ آخر (Firestore، Telegram API، إلخ) قد يحتوي تفاصيل تقنية حساسة أو غير مفهومة
// للمستخدم (مثال: "5 NOT_FOUND: ...")، فنعرض رسالة عامة، ونرسل التفاصيل الحقيقية لبوت السوبر أدمن.
function toUserMessage(err, context = 'غير محدد') {
  if (err instanceof AppError && err.isOperational) {
    return err.message;
  }
  reportError(err, context); // fire-and-forget: ما نوقفوش الرد على المستخدم فـ انتظار الإشعار
  return 'صار خطأ غير متوقع من جهتنا. جربنا نصلحه، حاول مرة أخرى بعد قليل.';
}

/**
 * asyncHandler: يلف أي controller/handler باش لو صرا خطأ (حتى في async)
 * ما يبقاش يهرب من Telegraf بلا معالجة، ويتحول لرسالة واضحة للمستخدم.
 * استعمال: bot.hears('...', asyncHandler(myController))
 */
function asyncHandler(fn) {
  return async (ctx, ...args) => {
    try {
      await fn(ctx, ...args);
    } catch (err) {
      await handleError(err, ctx);
    }
  };
}

// المعالج العام لأي خطأ غير متوقع يهرب من Telegraf نفسه (bot.catch)
function globalErrorHandler(err, ctx) {
  handleError(err, ctx);
}

function botContextLabel(ctx) {
  const username = ctx?.botInfo?.username ? `@${ctx.botInfo.username}` : 'بوت تليغرام';
  const fromId = ctx?.from?.id ? ` (من: ${ctx.from.id})` : '';
  return `${username}${fromId}`;
}

async function handleError(err, ctx) {
  const isOperational = err instanceof AppError && err.isOperational;

  if (isOperational) {
    logger.warn('خطأ متوقع (operational)', { message: err.message, meta: err.meta });
    try {
      await ctx.reply(`⚠️ ${err.message}`);
    } catch (_) {
      /* تجاهل فشل الرد نفسه */
    }
  } else {
    // خطأ غير متوقع: نرد على المستخدم برسالة عامة، ونبعث التفاصيل الكاملة لبوت السوبر أدمن
    await reportError(err, botContextLabel(ctx));
    try {
      await ctx.reply('😔 صار خطأ غير متوقع من جهتنا. جربنا نصلحه، حاول مرة أخرى بعد قليل.');
    } catch (_) {
      /* تجاهل فشل الرد نفسه */
    }
  }
}

module.exports = { asyncHandler, globalErrorHandler, toUserMessage };
