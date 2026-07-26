const logger = require('./logger');

// errorReporter: كل خطأ غير متوقع (غير عادي/operational) في أي بوت أو مهمة مجدولة
// يُبعث تلقائيًا كإشعار مفصّل لبوت السوبر أدمن، بدل ما يبقى مخفي فـ اللوقات فقط.
// فيه حماية من "spam": نفس الخطأ (نفس الرسالة + نفس السياق) ما يُعاد إرساله أكثر من مرة
// كل 5 دقائق، حتى لو تكرر آلاف المرات (مثال: Firestore متوقف ووصلت رسائل كثيرة فـ نفس الوقت).

const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 دقائق
const lastSentAt = new Map(); // مفتاح: "context|message" -> timestamp

// يستخرج أول سطر مفيد من stack trace (اسم الملف والسطر) بلا الحاجة نبعثو stack كامل
function extractLocation(err) {
  if (!err?.stack) return 'غير معروف';
  const lines = err.stack.split('\n').slice(1); // أول سطر هو رسالة الخطأ نفسها
  const projectLine = lines.find((l) => l.includes('/src/')) || lines[0];
  if (!projectLine) return 'غير معروف';
  const match = projectLine.match(/\/src\/(.+?)(\)|$)/);
  return match ? `src/${match[1]}` : projectLine.trim();
}

function shouldSend(key) {
  const last = lastSentAt.get(key);
  const now = Date.now();
  if (last && now - last < THROTTLE_WINDOW_MS) return false;
  lastSentAt.set(key, now);
  return true;
}

// context: نص قصير يوضح مصدر الخطأ، مثال: "بوت التاجر", "بوت الزبائن (فيسبوك)", "المجدول - reminderJob"
async function reportError(err, context = 'غير محدد') {
  try {
    const key = `${context}|${err.message}`;
    if (!shouldSend(key)) return; // نفس الخطأ تكرر قريب - تجاهل باش ما نغرقوش السوبر أدمن

    logger.error(`خطأ غير متوقع [${context}]`, {
      error: err.message,
      code: err.code,
      details: err.details,
      metadata: err.metadata?.internalRepr ? Object.fromEntries(err.metadata.internalRepr) : err.metadata,
      stack: err.stack,
    });

    // نستورد هنا (ماشي فوق الملف) لتفادي أي احتمال دائرة استيراد (circular require) مستقبلاً
    const NotificationService = require('../services/NotificationService');
    const location = extractLocation(err);
    await NotificationService.notifySuperAdmin(
      `🐞 خطأ غير متوقع\n\n📍 المصدر: ${context}\n📄 الملف: ${location}\n💬 التفاصيل: ${err.message}`
    );
  } catch (reportingErr) {
    // ما نخليوش فشل الإشعار نفسه يسبب مشكل زايد
    logger.error('فشل إرسال إشعار الخطأ للسوبر أدمن', { error: reportingErr.message });
  }
}

module.exports = { reportError };

// installGlobalErrorHandlers: يسجل معالجات process-level (uncaughtException/unhandledRejection)
// مرة واحدة فقط فـ كل العملية (idempotent)، حتى لو استدعيتها من عدة ملفات دخول (bots) فـ نفس
// العملية (مثال: allInOne.js يشغل الثلاثة مع بعض). كل خطأ غير متوقع يتسجل فـ اللوقات وينبعث
// لبوت السوبر أدمن قبل ما Node يوقف العملية (Railway "Restart on Failure" يعيد التشغيل بعدها).
let installed = false;
function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    reportError(err, 'العملية - unhandledRejection');
  });

  process.on('uncaughtException', async (err) => {
    logger.error('Uncaught Exception - العملية ستتوقف، Railway سيعيد تشغيلها تلقائيًا', {
      error: err.message,
      stack: err.stack,
    });
    await reportError(err, 'العملية - uncaughtException (إعادة تشغيل قادمة)').catch(() => {});
    process.exit(1);
  });
}

module.exports.installGlobalErrorHandlers = installGlobalErrorHandlers;
