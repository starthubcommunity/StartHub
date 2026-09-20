// join-defaults.js — Katıl akışı ile admin paneli (Site Ayarları → Katılım Formu) ortak sabitleri.
// Küçük ve bağımsız tutuluyor: admin paketi join-flow.jsx'i (CSS, sayfa bileşenleri) çekmesin.

// Kulüp (HUB) ekip alanları — join_form_settings.team_areas boşsa bunlar kullanılır.
export const DEFAULT_TEAM_AREAS = [
  { key: 'sosyal-medya', label: 'Sosyal Medya',  label_en: 'Social Media',        icon: 'megaphone', active: true,
    desc: 'İçerik takvimi, paylaşımlar ve topluluk yönetimi.' },
  { key: 'tasarim',      label: 'Tasarım Ekibi', label_en: 'Design Team',         icon: 'palette',   active: true,
    desc: 'Görsel kimlik, afiş ve etkinlik tasarımları.' },
  { key: 'organizasyon', label: 'Organizasyon',  label_en: 'Events & Operations', icon: 'calendar',  active: true,
    desc: 'Etkinlik planlama, lojistik ve buluşmalar.' },
  { key: 'sponsorluk',   label: 'Sponsorluk',    label_en: 'Sponsorship',         icon: 'handshake', active: true,
    desc: 'Sponsor ilişkileri, teklifler ve iş birlikleri.' },
];

// Ekip alanı ikon seçenekleri (site ikon setinde var olanlar).
export const TEAM_AREA_ICONS = [
  ['megaphone', 'Megafon'], ['palette', 'Palet'], ['calendar', 'Takvim'], ['handshake', 'El sıkışma'],
  ['camera', 'Kamera'], ['code', 'Kod'], ['globe', 'Dünya'], ['mail', 'E-posta'],
  ['star', 'Yıldız'], ['heart', 'Kalp'], ['lightbulb', 'Ampul'], ['users', 'Kişiler'],
];
