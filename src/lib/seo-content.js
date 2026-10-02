// seo-content.js — statik sayfa SEO metinleri + statik rota listesi.
// Kasıtlı olarak React/JSX içermeyen düz bir modül: hem app.jsx (Vite/React)
// hem scripts/prerender.mjs (düz Node, JSX import edemez) AYNI veriyi buradan
// okur — iki yerde aynı metnin tekrarlanıp zamanla birbirinden sapması
// (drift) riski olmasın diye (bkz. lib/routes.js'teki pathFor deseni).

// Metinler translations.jsx'teki mevcut about/labs/blog/join hero
// başlık+açıklamasından alındı (SEO Aşama 2) — hiçbir satır uydurulmadı.
export const STATIC_SEO = {
  home: {
    tr: { title: 'Start-Hub — Fikirlerden Girişimlere, Öğrencilerden Kuruculara', desc: "Start-Hub; girişim, teknoloji ve yapay zeka dünyasını Türkçe takip eden, kendi projelerini herkesin gözü önünde inşa eden bir venture builder topluluğudur." },
    en: { title: 'Start-Hub — From Ideas to Startups, From Students to Founders', desc: "Start-Hub is a venture builder community that follows startups, tech and AI in Turkish — and builds its own projects in public." },
  },
  about: {
    // Meta description 25-160 karakter aralığında olmalı (arama motoru SERP
    // kısıtı) — önceki metin (215/185 karakter) bu sınırı aşıyordu, aynı
    // iddialar korunarak kısaltıldı (2026-10-02, SEO audit uyarısı).
    tr: { title: 'Hakkımızda | Start-Hub', desc: "Start-Hub, öğrencilerin fikirlerini projelere, projelerini startup'lara ve startup'larını gerçek şirketlere dönüştürdüğü bir girişimcilik ekosistemidir." },
    en: { title: 'About | Start-Hub', desc: "Start-Hub is an entrepreneurship ecosystem helping students turn ideas into projects, projects into startups, and startups into real companies." },
  },
  labs: {
    tr: { title: 'Lab Projeleri | Start-Hub', desc: 'Start-Hub ekosisteminde geliştirilen tüm girişimler. Filtreleyerek keşfet veya ekibe başvur.' },
    en: { title: 'Lab Projects | Start-Hub', desc: 'All ventures being built in the Start-Hub ecosystem. Filter, explore, or apply to a team.' },
  },
  blog: {
    tr: { title: 'Yazılar | Start-Hub', desc: 'Blog yazıları, gündem haberleri ve etkinlikler — tek akışta.' },
    en: { title: 'Posts | Start-Hub', desc: 'Blog posts, news and events — one feed.' },
  },
  join: {
    tr: { title: "Start-Hub'a Katıl", desc: 'Topluluğumuza katıl, fikirlerini paylaş, ekip bul ve startup yolculuğuna başla.' },
    en: { title: 'Join Start-Hub', desc: 'Join our community, share your ideas, find a team, and start your startup journey.' },
  },
};

// app.jsx'teki parsePath() ile birebir aynı olmalı — tek statik sayfa
// listesi, hem routing hem prerender/sitemap burayı okur.
export const SIMPLE_PAGES = ['about', 'labs', 'blog', 'join'];
