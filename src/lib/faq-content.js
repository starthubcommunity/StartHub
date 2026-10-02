// faq-content.js — /about sayfasındaki Sık Sorulan Sorular. Tek kaynak: hem
// görünür metin (about-labs.jsx) hem FAQPage JSON-LD (app.jsx + prerender.mjs)
// buradan okur — metin ile şema arasında sürüklenme (drift) olmasın diye
// (bkz. lib/seo-content.js'teki aynı gerekçe). İçerik kullanıcı tarafından
// verildi (2026-10-02), İngilizce çevirisi yalnızca var olan TR metnin
// çevirisidir, yeni bir gerçek/iddia eklenmedi.
export const FAQ_ITEMS = [
  {
    q: { tr: 'Start-Hub nedir?', en: 'What is Start-Hub?' },
    a: {
      tr: "Start-Hub, 2026'da kurulan, İstanbul merkezli bağımsız bir öğrenci girişimcilik topluluğu ve venture builder ekosistemidir. Öğrencilerin fikirlerini projelere ve startup'lara dönüştürmesine yardımcı olur.",
      en: 'Start-Hub is an independent, Istanbul-based student entrepreneurship community and venture builder ecosystem founded in 2026. It helps students turn their ideas into projects and startups.',
    },
  },
  {
    q: { tr: "Start-Hub'a kimler katılabilir?", en: 'Who can join Start-Hub?' },
    a: {
      tr: 'Yazılım, tasarım, pazarlama veya girişimcilikle ilgilenen tüm üniversite öğrencileri. Belirli bir bölüm ya da üniversite şartı yoktur.',
      en: 'Any university student interested in software, design, marketing or entrepreneurship. There is no requirement tied to a specific department or university.',
    },
  },
  {
    q: { tr: "Start-Hub Haliç Üniversitesi'ne mi bağlı?", en: 'Is Start-Hub affiliated with Haliç University?' },
    a: {
      tr: "Start-Hub bağımsız bir topluluktur; ayrıca Haliç Üniversitesi'nde resmi bir kulübü vardır.",
      en: 'Start-Hub is an independent community; it also has an official club at Haliç University.',
    },
  },
  {
    q: { tr: 'Start-Hub hangi projeleri geliştiriyor?', en: 'What projects is Start-Hub building?' },
    a: {
      tr: 'Şu an üç ana proje: TİD Çevirici (Türk İşaret Dili çevirmeni), EventHub (etkinlik yönetimi) ve GrantAgent (hibe başvuru asistanı).',
      en: 'Currently three main projects: TİD Çevirici (Turkish Sign Language translator), EventHub (event management) and GrantAgent (grant application assistant).',
    },
  },
  {
    q: { tr: 'Bir projede nasıl yer alabilirim?', en: 'How can I get involved in a project?' },
    a: {
      tr: 'Start-Hub Lab projeleri geliştirme, tasarım, yapay zekâ ve pazarlama alanlarında katkı arar. Katıl sayfamızdan başvurabilirsin.',
      en: 'Start-Hub Lab projects look for contributors in development, design, AI and marketing. You can apply through our Join page.',
    },
  },
];
