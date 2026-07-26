// نقطة دخول واحدة لكل نظام التعلّم والذاكرة. باقي المشروع (controllers، bots) يفضَّل أن
// يستورد من هنا بدل الدخول لمسارات داخلية، حتى يبقى مسموحًا بإعادة تنظيم الملفات الداخلية
// لأي وحدة (Module) بلا كسر أي كود خارجي يعتمد عليها. راجع README.md فـ هذا المجلد للنظرة الشاملة.

module.exports = {
  // التطبيع وفهم الأخطاء الإملائية
  textNormalizer: require('./normalization/textNormalizer'),

  // فهم الإيموجي
  emojiIntent: require('./emoji/emojiIntent'),

  // القاموس الخاص بكل متجر
  StoreDictionaryService: require('./dictionary/StoreDictionaryService'),

  // ذاكرة المتجر (أسلوب، معلومات متعلَّمة)
  StoreMemoryService: require('./memory/StoreMemoryService'),

  // دفتر قرارات التاجر
  DecisionService: require('./decisions/DecisionService'),

  // أمثلة التدريب (تعلّم من تعديلات التاجر)
  TrainingService: require('./training/TrainingService'),

  // سجل المحادثات (يغذي المراجعة والإحصائيات)
  ConversationLogService: require('./conversationLog/ConversationLogService'),

  // خط أنابيب فهم النية الكامل (المرحلة الوسطى قبل AI)
  intentResolver: require('./intent/intentResolver'),

  // الإحصائيات الأسبوعية
  LearningStatsService: require('./stats/LearningStatsService'),

  // زر "علمني" (مراجعة التاجر للردود)
  teachPublisher: require('./teach/teachPublisher'),
  teachHandlers: require('./teach/teachHandlers'),
};
