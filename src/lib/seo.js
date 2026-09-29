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
