const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

// LoggerService: أي مكان في المشروع يستعمل هذا بلاصة console.log مباشرة.
// إذا حبينا نبدلو لاحقًا بـ Winston/Pino أو نرسلو اللوقات لخدمة خارجية (مثال: Datadog)،
// نبدلو محتوى هذا الملف فقط، بلا ما نلمسو باقي المشروع.

const LEVELS = { ERROR: 'ERROR', WARNING: 'WARNING', INFO: 'INFO', DEBUG: 'DEBUG' };

const logDir = path.resolve(process.cwd(), env.logging.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function fileNameForToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
}

function writeToFile(line) {
  const filePath = path.join(logDir, fileNameForToday());
  fs.appendFile(filePath, line + '\n', (err) => {
    if (err) {
      // آخر ملاذ: إذا فشلت الكتابة للملف، نطبعو في الطرفية فقط هنا
      // eslint-disable-next-line no-console
      console.error('فشل في كتابة اللوق:', err.message);
    }
  });
}

function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  writeToFile(line);

  // مهم: نطبع فـ الطرفية فـ كل الحالات (حتى production)، لأن على Railway اللوقات المحلية
  // (logs/*.log) تُمسح عند كل إعادة نشر/تشغيل وما تقدرش تشوفها أصلاً. Railway يقرا اللوقات
  // من stdout/stderr فقط، فـ خاصنا نطبعو فيهم دومًا وإلا تبقى كل الأخطاء مخفية بصمت.
  // eslint-disable-next-line no-console
  const printer = level === LEVELS.ERROR ? console.error : console.log;
  printer(`[${level}] ${message}`, Object.keys(meta).length ? meta : '');
}

const LoggerService = {
  info: (message, meta) => log(LEVELS.INFO, message, meta),
  warn: (message, meta) => log(LEVELS.WARNING, message, meta),
  error: (message, meta) => {
    const errMeta = meta instanceof Error ? { stack: meta.stack, name: meta.name } : meta;
    log(LEVELS.ERROR, message, errMeta);
  },
  debug: (message, meta) => {
    if (env.logging.level === 'debug') log(LEVELS.DEBUG, message, meta);
  },
};

module.exports = LoggerService;
