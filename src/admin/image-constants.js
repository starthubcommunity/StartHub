// Görsel stoğu sabitleri — admin paneli (admin-automation.jsx, image-swap.jsx, image-score.js).
// Skor/eşik değerleri automation/matching_config.json'dan gelir (tek kaynak; Python da aynı dosyayı okur).
// Burada yalnızca arayüz etiketleri ve kategori listesi tutulur.
import MC from '../../automation/matching_config.json' with { type: 'json' };

export const IMAGE_STOCK_CATEGORIES = ['Fon', 'Yapay Zeka', 'Girişim', 'Fintech', 'SaaS', 'E-Ticaret', 'Sağlık', 'Teknoloji', 'Ortaklık', 'Genel'];

const VISUAL_TYPE_LABELS = {
  el_sikisma: 'El sıkışma', ofis_toplanti: 'Ofis / toplantı', grafik_borsa: 'Grafik / borsa',
  para_finans: 'Para / finans', robot_ai: 'Robot / yapay zeka', cip_donanim: 'Çip / donanım',
  kod_ekran: 'Kod / ekran', cihaz_telefon: 'Cihaz / telefon', veri_merkezi: 'Veri merkezi',
  sehir_bina: 'Şehir / bina', arac_enerji: 'Araç / enerji', insan_portre: 'İnsan / portre',
  laboratuvar: 'Laboratuvar', soyut_diger: 'Soyut / diğer',
};
// Sıra ve anahtarlar JSON'dan; etiketler yalnızca gösterim.
export const VISUAL_TYPES = MC.VISUAL_TYPES.map(v => [v, VISUAL_TYPE_LABELS[v] || v]);
export const VISUAL_TYPE_LABEL = Object.fromEntries(VISUAL_TYPES);

export const GENERIC_TAG_HINTS = MC.GENERIC_TAGS;
export const PARTNERSHIP_TOPIC_TAGS = MC.PARTNERSHIP_TOPIC_TAGS;
export const CATEGORY_ALIAS = MC.CATEGORY_ALIAS;

// Python config'in JS karşılığı (isimler image-score.js'te kullanılan biçimde).
export const SCORE = {
  CATEGORY_DIRECT: MC.CATEGORY_DIRECT_BONUS,
  CATEGORY_ALIAS: MC.CATEGORY_ALIAS_BONUS,
  GENEL_BONUS: MC.GENEL_CATEGORY_BONUS,
  GENEL_CATEGORY: MC.GENEL_CATEGORY,
  IDF_SCALE: MC.IDF_SCALE,
  GENERIC_TAG_MAX_WEIGHT: MC.GENERIC_TAG_MAX_WEIGHT,
  TAG_SCORE_CAP: MC.TAG_SCORE_CAP,
  USAGE_BONUS_MAX: MC.USAGE_BONUS_MAX,
  TEXT_BODY_CHARS: MC.TEXT_BODY_CHARS,
  USAGE_WINDOW_DAYS: MC.USAGE_WINDOW_DAYS,
  HISTORY_LIMIT: MC.HISTORY_LIMIT,
  RECENT_POSTS_EXCLUDE: MC.RECENT_POSTS_EXCLUDE,
  DAILY_WINDOW_DAYS: MC.DAILY_WINDOW_DAYS,
  MAX_USES_IN_WINDOW: MC.MAX_USES_IN_WINDOW,
  VISUAL_WINDOW_RULES: MC.VISUAL_WINDOW_RULES,
  VISUAL_WINDOW_DEFAULT: MC.VISUAL_WINDOW_DEFAULT,
  MIN_SPECIFIC_SCORE: MC.MIN_SPECIFIC_SCORE,
  RELAX_REVIEW_THRESHOLD: MC.RELAX_REVIEW_THRESHOLD,
};
