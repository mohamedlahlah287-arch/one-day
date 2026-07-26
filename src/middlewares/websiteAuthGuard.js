const WebSessionRepository = require('../repositories/WebSessionRepository');
const WebUserRepository = require('../repositories/WebUserRepository');

const COOKIE_NAME = 'rb_session';

// نقرأ الكوكيز يدويًا (بلا مكتبة cookie-parser إضافية) - Header بسيط بصيغة "a=1; b=2"
function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

// سابقًا: كانت خاصية "Secure" تُضبط فقط بناءً على NODE_ENV، بلا علاقة بالبروتوكول الحقيقي للطلب.
// المشكلة: إذا NODE_ENV=production لكن الطلب وصل فعليًا عبر HTTP (مثلاً بيئة اختبار بلا HTTPS،
// أو Proxy لا يمرر البروتوكول الصحيح)، المتصفح يرفض حفظ الكوكي نهائيًا لأن Secure تتطلب HTTPS -
// وهذا بالضبط يُظهر وكأن تسجيل الدخول "ما يبقاش محفوظ" ويتطلب دخول من جديد فـ كل مرة.
// الحل: نعتمد على req.secure (يعمل بشكل صحيح خلف Proxy بفضل app.set('trust proxy', 1) في
// customerBot.js) بدل NODE_ENV فقط - هذا يعكس الواقع الفعلي للاتصال في كل بيئة.
function setSessionCookie(req, res, token) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax${isHttps ? '; Secure' : ''}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

// Middleware "ناعم": يحاول يحمّل المستخدم إذا عنده جلسة صالحة، لكن ما يرفضش الطلب إذا ماكانش
async function attachWebUser(req, res, next) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    const session = await WebSessionRepository.findValid(token);
    if (session) {
      const user = await WebUserRepository.findById(session.userId);
      req.webUser = user;
      req.webSessionToken = token;
    }
  } catch (err) {
    // تجاهل بصمت - يعني المستخدم غير مسجل دخول فقط
  }
  next();
}

// Middleware "صارم": يرفض الطلب (401) إذا ما كانش مسجل دخول - يُستعمل لمسارات لوحة التحكم
function requireWebUser(req, res, next) {
  if (!req.webUser) return res.status(401).json({ error: 'يجب تسجيل الدخول أولًا' });
  next();
}

module.exports = { attachWebUser, requireWebUser, setSessionCookie, clearSessionCookie, COOKIE_NAME };
