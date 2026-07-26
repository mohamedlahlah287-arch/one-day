const admin = require('firebase-admin');
const { env } = require('./env');
const logger = require('../utils/logger');

let app;
if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });

  // تشخيص آمن (Project ID ماشي سري) - يساعدك تتأكد بعينك من اللوق أن القيمة المستعملة
  // فعليًا هي نفسها لي كاينة فـ Firebase Console (مشاكل كثيرة سببها هذا الفرق بالذات).
  logger.info('🔥 Firebase مهيأ بـ Project ID:', {
    projectId: env.firebase.projectId,
    clientEmailDomain: env.firebase.clientEmail ? env.firebase.clientEmail.split('@')[1] : null,
    databaseId: env.firebase.databaseId || '(default)',
  });
} else {
  app = admin.apps[0];
}

module.exports = { admin, app };
