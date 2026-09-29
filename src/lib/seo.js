// seo.js — sayfa bazlı SEO metadata (title, description, canonical, Open
// Graph, Twitter Card). Kütüphane kullanılmıyor — doğrudan document.head
// üzerinde "oku, varsa güncelle, yoksa oluştur" (upsert). index.html'deki
// statik etiketler İLK boya (ilk render'dan önce, JS çalışmadan) için kalıyor;
// bu modül React navigasyonu (pushState, sayfa yenilemeden) sırasında her
// sayfa değişiminde onların ÜZERİNE yazıyor (bkz. app.jsx).
export const SITE_URL = 'https://www.starthub-community.com';
export const SITE_NAME = 'Start-Hub';

// TODO(kullanıcı): 1200×630 boyutunda özel bir /og-default.png henüz yok —
// eklenince burada ve index.html'deki statik og:image/twitter:image'da bu
// satır değiştirilmeli. Şimdilik mevcut logo-full.png kullanılıyor (index.html
// zaten aynı görseli varsayılan olarak kullanıyordu, davranış değişmedi).
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo-full.png`;

function upsertMetaByAttr(attr, value, content) {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// path: app.jsx'teki pathFor() çıktısı gibi '/' ile başlayan bir yol
// ('/', '/about', '/blog/x'...) — pathFor zaten HİÇBİR ZAMAN '#' üretmez,
// bu yüzden canonical'da da asla '#' olmaz.
export function canonicalFor(path) {
  const p = path === '/' ? '/' : String(path || '/').replace(/\/+$/, '');
  return `${SITE_URL}${p}`;
}

// { title, description, path, image?, imageAlt?, noindex? } — image
// verilmezse DEFAULT_OG_IMAGE kullanılır (yazı/proje kendi görselini
// vermediğinde). noindex: true — "bulunamadı" gibi içeriksiz sayfalarda
// (silinmiş/yayından kaldırılmış yazı-proje) arama motoruna indeksleme.
export function setSEO({ title, description, path, image, imageAlt, noindex = false }) {
  const canonical = canonicalFor(path);
  const ogImage = image || DEFAULT_OG_IMAGE;

  document.title = title;
  upsertMetaByAttr('name', 'description', description);
  upsertMetaByAttr('name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
  upsertCanonical(canonical);

  upsertMetaByAttr('property', 'og:title', title);
  upsertMetaByAttr('property', 'og:description', description);
  upsertMetaByAttr('property', 'og:url', canonical);
  upsertMetaByAttr('property', 'og:image', ogImage);
  upsertMetaByAttr('property', 'og:image:alt', imageAlt || SITE_NAME);

  upsertMetaByAttr('name', 'twitter:card', 'summary_large_image');
  upsertMetaByAttr('name', 'twitter:title', title);
  upsertMetaByAttr('name', 'twitter:description', description);
  upsertMetaByAttr('name', 'twitter:image', ogImage);
}

// ── Schema.org (JSON-LD) — SEO Aşama 4 ─────────────────────────────────────
// data null → etiketi kaldırır (ör. bir yazı sayfasından ayrılınca Article'ı
// silmek için). id, sayfa içinde tek bir <script> kalmasını garantiler.
function upsertJSONLD(id, data) {
  let el = document.getElementById(id);
  if (data == null) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

// Sitenin her sayfasında sabit kimlik sinyali — GEO'da bir tarayıcı doğrudan
// bir alt sayfaya (yazı/proje) gelebilir, orada da "bu site Start-Hub'a ait"
// bilgisi bulunsun diye yalnızca ana sayfaya değil her sayfaya eklenir.
export function setOrganizationSchema({ description, sameAs = [] } = {}) {
  upsertJSONLD('ld-organization', {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
    description,
    ...(sameAs.length ? { sameAs } : {}),
  });
}

// article: { headline, description, image?, datePublished?, author, mainEntityOfPage }
// null → sayfadan ayrılınca etiketi kaldırır.
export function setArticleSchema(article) {
  if (!article) { upsertJSONLD('ld-article', null); return; }
  upsertJSONLD('ld-article', {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    image: article.image || DEFAULT_OG_IMAGE,
    datePublished: article.datePublished,
    author: article.author,
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE } },
    mainEntityOfPage: article.mainEntityOfPage,
  });
}
