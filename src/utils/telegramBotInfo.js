const { env } = require('../config/env');

let cachedUsername = null;

// اسم بوت التاجر (بدون @) - يُستعمل لبناء روابط t.me/البوت?start=... من صفحات الموقع.
// نجيبو مرة وحدة من تيليغرام (getMe) ونخزنو فـ الذاكرة (اسم البوت ما يتبدلش خلال تشغيل السيرفر).
async function getMerchantBotUsername() {
  if (cachedUsername) return cachedUsername;
  const res = await fetch(`https://api.telegram.org/bot${env.telegram.merchantBotToken}/getMe`);
  const data = await res.json();
  if (!data.ok) throw new Error('فشل جلب معلومات بوت التاجر من تيليغرام');
  cachedUsername = data.result.username;
  return cachedUsername;
}

module.exports = { getMerchantBotUsername };
