const express = require('express');
const VoiceBlobRepository = require('../voiceNotes/VoiceBlobRepository');
const ImageBlobRepository = require('../media/ImageBlobRepository');
const logger = require('../utils/logger');

// media.routes: يخدم الملفات الصوتية والصور المخزّنة بشكل دائم على رابط عام دائم الصلاحية -
// هذا الرابط هو اللي نمرره لـ Facebook Messenger عند إرسال رسالة صوتية أو بطاقة منتج بصورة
// (بدل رابط تيليغرام المؤقت اللي كان يفشل بعد انتهاء صلاحيته). راجع src/voiceNotes/README.md.
module.exports = function registerMediaRoutes(app) {
  const router = express.Router();

  router.get('/voice/:blobId', async (req, res) => {
    try {
      const blob = await VoiceBlobRepository.get(req.params.blobId);
      if (!blob) return res.status(404).send('Not found');
      const buffer = Buffer.from(blob.base64, 'base64');
      res.setHeader('Content-Type', blob.mimeType || 'audio/ogg');
      res.setHeader('Content-Length', buffer.length);
      // قابل للتخزين المؤقت من طرف فيسبوك/المتصفح - الملف لا يتغير إلا بإعادة تسجيله (نفس blobId)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } catch (err) {
      logger.error('فشل خدمة ملف صوتي دائم', { blobId: req.params.blobId, error: err.message });
      res.status(500).send('Server error');
    }
  });

  router.get('/image/:blobId', async (req, res) => {
    try {
      const blob = await ImageBlobRepository.get(req.params.blobId);
      if (!blob) return res.status(404).send('Not found');
      const buffer = Buffer.from(blob.base64, 'base64');
      res.setHeader('Content-Type', blob.mimeType || 'image/jpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } catch (err) {
      logger.error('فشل خدمة صورة دائمة', { blobId: req.params.blobId, error: err.message });
      res.status(500).send('Server error');
    }
  });

  app.use('/media', router);
};
