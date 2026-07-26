const { Markup } = require('telegraf');

// callback_data محدود بـ 64 بايت فـ تيليغرام - نستعمل بادئة قصيرة + معرف الوثيقة (Firestore
// auto-id عادة ~20 حرف) فيبقى بأمان تحت الحد.
function teachKeyboard(logId) {
  return Markup.inlineKeyboard([
    Markup.button.callback('✔ الرد ممتاز', `teach:good:${logId}`),
    Markup.button.callback('✏ تعديل الرد', `teach:edit:${logId}`),
  ]);
}

function formatReviewMessage({ customerMessage, botReply, intent }) {
  return [
    '🎓 علّمني - راجع هذا الرد:',
    '',
    `👤 الزبون: ${customerMessage}`,
    `🤖 البوت: ${botReply}`,
    intent && intent !== 'unknown' ? `🏷️ النية: ${intent}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = { teachKeyboard, formatReviewMessage };
