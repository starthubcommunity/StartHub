// Görsel stoğu sabitleri — admin paneli (admin-automation.jsx, image-swap.jsx).
// automation/config.py ile aynı değerleri taşır; birini değiştirirseniz diğerini de güncelleyin.

export const IMAGE_STOCK_CATEGORIES = ['Fon', 'Yapay Zeka', 'Girişim', 'Fintech', 'SaaS', 'E-Ticaret', 'Sağlık', 'Teknoloji', 'Ortaklık', 'Genel'];

export const VISUAL_TYPES = [
  ['el_sikisma', 'El sıkışma'], ['ofis_toplanti', 'Ofis / toplantı'], ['grafik_borsa', 'Grafik / borsa'],
  ['para_finans', 'Para / finans'], ['robot_ai', 'Robot / yapay zeka'], ['cip_donanim', 'Çip / donanım'],
  ['kod_ekran', 'Kod / ekran'], ['cihaz_telefon', 'Cihaz / telefon'], ['veri_merkezi', 'Veri merkezi'],
  ['sehir_bina', 'Şehir / bina'], ['arac_enerji', 'Araç / enerji'], ['insan_portre', 'İnsan / portre'],
  ['laboratuvar', 'Laboratuvar'], ['soyut_diger', 'Soyut / diğer'],
];
export const VISUAL_TYPE_LABEL = Object.fromEntries(VISUAL_TYPES);

// config.py'deki GENERIC_TAGS — yalnızca uyarı için.
export const GENERIC_TAG_HINTS = ['is', 'yatirim', 'girisim', 'basari', 'buyume', 'anlasma', 'ortaklik', 'teknoloji', 'ekonomi', 'sirket', 'para'];

// config.py'deki CATEGORY_ALIAS.
export const CATEGORY_ALIAS = {
  'AI': ['Yapay Zeka'],
  'Yatırım': ['Fon', 'Fintech'],
  'Girişim': ['Ortaklık'],
  'Teknoloji': ['Fintech'],
};

// config.py skor sabitleri.
export const SCORE = {
  CATEGORY_DIRECT: 3,
  CATEGORY_ALIAS: 2,
  GENEL_BONUS: 1,
  GENEL_CATEGORY: 'Genel',
  IDF_SCALE: 2,
  GENERIC_TAG_MAX_WEIGHT: 0.5,
  TAG_SCORE_CAP: 15,
  USAGE_BONUS_MAX: 2,
  TEXT_BODY_CHARS: 600,
  USAGE_WINDOW_DAYS: 90,
};
