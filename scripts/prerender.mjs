#!/usr/bin/env node
// scripts/prerender.mjs — SEO/GEO Aşama 3: `vite build`den SONRA çalışır,
// Supabase'den yayınlanmış yazı/proje verisini çekip her biri için gerçek,
// JS'siz okunabilir bir dist/<path>/index.html üretir. Ayrıca dist/sitemap.xml'i
// gerçek Supabase içeriğiyle YENİDEN üretir (public/sitemap.xml sadece
// script hiç çalışmazsa diye geriye düşülen statik bir kopya).
//
// Neden react-dom/server SSR değil de düz metin enjeksiyonu? Projenin
// "ek kütüphane eklemeden önce sor" kuralı var (CLAUDE.md) — App bileşenini
// tam sunucu tarafında render etmek (context'ler, tweaks-panel, yalnızca
// tarayıcıda çalışan hook'lar) önemli bir yeniden yapı gerektirirdi. Bunun
// yerine plandaki asıl hedef zaten karşılanıyor: "başlık + tam metin düz
// HTML içinde bulunsun, React yüklenince normal şekilde devralsın" — burada
// yazılan HTML, React mount olur olmaz #root'un içeriğinin YERİNE geçiyor
// (hydrate değil, createRoot().render() — bkz. src/main.jsx), bu yüzden
// enjekte edilen metnin React'ın ürettiğiyle piksel piksel aynı olması
// gerekmiyor; yalnızca JS çalıştırmayan bir tarayıcının okuyacağı GERÇEK
// metin olması yeterli.
//
// Not: posts/startups tablolarının snake_case sütun adları burada elle
// (src/data.jsx'teki mapPost/mapStartup ile AYNI adlarla) okunuyor —
// data.jsx'i doğrudan import edemiyoruz çünkü o React/JSX'e bağımlı, düz
// Node ESM'in JSX'i ayrıştırma desteği yok. İki yerde aynı sütun adları
// tekrarlanıyor; Supabase şeması değişirse ikisi de güncellenmeli.
import { createClient } from '@supabase/supabase-js';
import { readFile as readFileP, writeFile as writeFileP, mkdir as mkdirP } from 'node:fs/promises';
import { existsSync, readFileSync as readFileSyncFs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, canonicalFor } from '../src/lib/seo.js';
import { STATIC_SEO } from '../src/lib/seo-content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ── .env yükle (yalnızca process.env'de zaten yoksa) ───────────────────────
// Vercel build ortamında proje değişkenleri zaten process.env'dedir. Yerel
// `npm run build`de ise Vite'ın kendi .env yüklemesi import.meta.env'e gider,
// bu AYRI Node script'ine (vite build bitince ayrı bir process olarak
// çalışıyor) miras kalmaz — o yüzden burada minik, bağımlılıksız bir .env
// ayrıştırıcı var (yeni bir paket eklemeden önce sormak proje kuralı).
function loadDotEnvIfPresent() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSyncFs(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnvIfPresent();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[prerender] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY bulunamadı — prerender atlanıyor, yalnızca normal SPA çıktısı (dist/) kalıyor.');
  process.exit(0);
}

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ yok — önce `vite build` çalışmalı.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// startups.about_tr/desc_tr/problem_tr/solution_tr düz tek satır text kolonlar
// (detail-pages.jsx'teki splitParagraphs ile AYNI mantık — bkz. oradaki not).
function splitParagraphs(text) {
  return String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function writeRoute(routeDir, html) {
  const dir = path.join(DIST, routeDir);
  await mkdirP(dir, { recursive: true });
  await writeFileP(path.join(dir, 'index.html'), html, 'utf8');
  return path.relative(ROOT, path.join(dir, 'index.html'));
}

function jsonLdScript(obj) {
  const json = JSON.stringify(obj).replace(/<\/script/gi, '<\\/script');
  return `<script type="application/ld+json">${json}</script>`;
}

// Proje sayfası JSON-LD (SEO/GEO — feat/seo-projects, madde 1). "Uygun
// değilse CreativeWork": github/demo linki olan bir proje somut bir yazılım
// ürünüdür (SoftwareApplication); ikisi de yoksa (ör. henüz fikir/araştırma
// aşamasında bir proje) daha genel CreativeWork kullanılır — schema.org'un
// SoftwareApplication'ı "çalıştırılabilir bir uygulama" varsayımına dayanır.
// Boş alan (image/applicationCategory) property olarak HİÇ yazılmaz.
function projectSchema(s, { name, description, canonical, image }) {
  const isSoftware = Boolean(s.github || s.demo);
  const schema = {
    '@context': 'https://schema.org',
    '@type': isSoftware ? 'SoftwareApplication' : 'CreativeWork',
    name,
    description,
    url: canonical,
  };
  if (image) schema.image = image;
  if (isSoftware && Array.isArray(s.tags) && s.tags.length) schema.applicationCategory = s.tags[0];
  schema.author = { '@type': 'Organization', name: SITE_NAME };
  schema.publisher = { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE } };
  return schema;
}

function organizationSchema(sameAs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: DEFAULT_OG_IMAGE,
    description: STATIC_SEO.home.tr.desc,
    ...(sameAs && sameAs.length ? { sameAs } : {}),
  };
}

async function main() {
  const shellHtml = await readFileP(path.join(DIST, 'index.html'), 'utf8');

  // Güvenlik kilidi: bu script dist/index.html'in KENDİSİNİ de üretip
  // üzerine yazıyor (ana sayfa da bir "route") — eğer biri `vite build`
  // çalıştırmadan bu script'i ikinci kez çalıştırırsa, "shell" olarak zaten
  // enjekte edilmiş (JSON-LD'li, #root'u dolu) bir dosyayı okur ve her
  // route'a onu temel alarak yazar (üst üste binen <meta name="robots">/
  // JSON-LD etiketleri, yanlış #root içeriği). Bunun yerine build'i baştan
  // çalıştırmasını iste, sessizce bozuk çıktı üretme.
  if (shellHtml.includes('application/ld+json')) {
    console.error('[prerender] dist/index.html zaten prerender edilmiş görünüyor (JSON-LD içeriyor). Önce `vite build` ile temiz bir dist/ üret, sonra bu script\'i çalıştır (npm run build ikisini zaten sırayla yapıyor).');
    process.exit(1);
  }

  const [
    { data: posts, error: postsErr },
    { data: startups, error: startupsErr },
    { data: people, error: peopleErr },
    { data: settingsRow },
  ] = await Promise.all([
    supabase.from('posts').select('*').eq('status', 'published').order('date', { ascending: false }),
    supabase.from('startups').select('*').eq('published', true).order('id'),
    supabase.from('people').select('id, name'),
    supabase.from('site_settings').select('company_linkedin, instagram_url').eq('id', 1).single(),
  ]);

  if (postsErr || startupsErr || peopleErr) {
    console.error('[prerender] Supabase okuma hatası, prerender atlanıyor:', (postsErr || startupsErr || peopleErr).message);
    process.exit(0); // build'i düşürme — SPA zaten çalışır durumda kalır
  }

  const sameAs = [
    settingsRow?.company_linkedin || 'https://www.linkedin.com/company/111725833/',
    settingsRow?.instagram_url,
  ].filter(Boolean);

  function buildHtml({ title, description, routePath, image, imageAlt, bodyHtml, extraJsonLd }) {
    const canonical = canonicalFor(routePath);
    const ogImage = image || DEFAULT_OG_IMAGE;
    let html = shellHtml;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`);
    html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(canonical)}" />`);
    html = html.replace(/<meta property="og:url"\s+content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${esc(canonical)}" />`);
    html = html.replace(/<meta property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`);
    html = html.replace(/<meta property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(description)}" />`);
    html = html.replace(/<meta property="og:image"\s+content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${esc(ogImage)}" />`);
    html = html.replace(/<meta property="og:image:alt"\s+content="[^"]*"\s*\/?>/, `<meta property="og:image:alt" content="${esc(imageAlt || SITE_NAME)}" />`);
    html = html.replace(/<meta name="twitter:title"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(title)}" />`);
    html = html.replace(/<meta name="twitter:description"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(description)}" />`);
    html = html.replace(/<meta name="twitter:image"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${esc(ogImage)}" />`);

    const jsonLd = [organizationSchema(sameAs), ...(extraJsonLd || [])];
    const inject = `  <meta name="robots" content="index, follow" />\n  ${jsonLd.map(jsonLdScript).join('\n  ')}\n</head>`;
    html = html.replace('</head>', inject);

    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${bodyHtml}</div>`);
    return html;
  }

  const written = [];

  // ── Ana sayfa ──────────────────────────────────────────────────────────
  {
    const s = STATIC_SEO.home.tr;
    const latestPosts = posts.slice(0, 8);
    const projectsList = startups.slice(0, 12);
    const bodyHtml = `
      <h1>${esc(s.title)}</h1>
      <p>${esc(s.desc)}</p>
      <h2>Son Yazılar</h2>
      <ul>
        ${latestPosts.map(p => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title_tr || p.title_en || '')}</a></li>`).join('\n        ')}
      </ul>
      <h2>Projeler</h2>
      <ul>
        ${projectsList.map(x => `<li><a href="/labs/${esc(x.slug)}">${esc(x.name || '')}</a></li>`).join('\n        ')}
      </ul>
    `;
    const html = buildHtml({ title: s.title, description: s.desc, routePath: '/', bodyHtml });
    written.push(await writeRoute('', html));
  }

  // ── Statik sayfalar: /about, /labs, /blog, /join ────────────────────────
  {
    const s = STATIC_SEO.about.tr;
    const bodyHtml = `<h1>${esc(s.title)}</h1><p>${esc(s.desc)}</p>`;
    written.push(await writeRoute('about', buildHtml({ title: s.title, description: s.desc, routePath: '/about', bodyHtml })));
  }
  {
    const s = STATIC_SEO.labs.tr;
    const bodyHtml = `
      <h1>${esc(s.title)}</h1>
      <p>${esc(s.desc)}</p>
      <ul>
        ${startups.map(x => `<li><a href="/labs/${esc(x.slug)}">${esc(x.name || '')}</a> — ${esc(x.tagline_tr || x.tagline_en || '')}</li>`).join('\n        ')}
      </ul>
    `;
    written.push(await writeRoute('labs', buildHtml({ title: s.title, description: s.desc, routePath: '/labs', bodyHtml })));
  }
  {
    const s = STATIC_SEO.blog.tr;
    const bodyHtml = `
      <h1>${esc(s.title)}</h1>
      <p>${esc(s.desc)}</p>
      <ul>
        ${posts.map(p => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title_tr || p.title_en || '')}</a> — ${esc(p.excerpt_tr || p.excerpt_en || '')}</li>`).join('\n        ')}
      </ul>
    `;
    written.push(await writeRoute('blog', buildHtml({ title: s.title, description: s.desc, routePath: '/blog', bodyHtml })));
  }
  {
    const s = STATIC_SEO.join.tr;
    const bodyHtml = `<h1>${esc(s.title)}</h1><p>${esc(s.desc)}</p>`;
    written.push(await writeRoute('join', buildHtml({ title: s.title, description: s.desc, routePath: '/join', bodyHtml })));
  }

  // ── Yazı detay sayfaları: /blog/<slug> ──────────────────────────────────
  for (const post of posts) {
    if (!post.slug) continue;
    const title = post.title_tr || post.title_en || 'Start-Hub';
    const desc = post.excerpt_tr || post.excerpt_en || STATIC_SEO.blog.tr.desc;
    const author = people.find(pp => pp.id === post.author_id);
    const authorName = author?.name || post.guest_author?.name || SITE_NAME;
    const bodyParas = (post.body_tr && post.body_tr.length ? post.body_tr : post.body_en) || [];
    const bodyHtml = `
      <article>
        <h1>${esc(title)}</h1>
        <p><em>${esc(authorName)}${post.date ? ` — ${esc(post.date)}` : ''}</em></p>
        <p>${esc(desc)}</p>
        ${bodyParas.map(para => `<p>${esc(para)}</p>`).join('\n        ')}
      </article>
    `;
    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description: desc,
      image: post.image_url || DEFAULT_OG_IMAGE,
      ...(post.date ? { datePublished: post.date } : {}),
      author: { '@type': 'Person', name: authorName },
      publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE } },
      mainEntityOfPage: canonicalFor(`/blog/${post.slug}`),
    };
    const html = buildHtml({
      title: `${title} | Start-Hub`, description: desc, routePath: `/blog/${post.slug}`,
      image: post.image_url, imageAlt: title, bodyHtml, extraJsonLd: [articleSchema],
    });
    written.push(await writeRoute(`blog/${post.slug}`, html));
  }

  // ── Proje detay sayfaları: /labs/<slug> ─────────────────────────────────
  for (const s of startups) {
    if (!s.slug) continue;
    const name = s.name || 'Proje';
    const tagline = s.tagline_tr || s.tagline_en || '';
    const desc = s.desc_tr || s.desc_en || tagline || STATIC_SEO.labs.tr.desc;
    const about = s.about_tr || s.about_en || '';
    const problem = s.problem_tr || '';
    const solution = s.solution_tr || '';
    const bodyHtml = `
      <article>
        <h1>${esc(name)}</h1>
        ${tagline ? `<p>${esc(tagline)}</p>` : ''}
        <p>${esc(desc)}</p>
        ${about ? `<h2>Hakkında</h2>${splitParagraphs(about).map(para => `<p>${esc(para)}</p>`).join('\n        ')}` : ''}
        ${problem ? `<h2>Problem</h2>${splitParagraphs(problem).map(para => `<p>${esc(para)}</p>`).join('\n        ')}` : ''}
        ${solution ? `<h2>Çözüm</h2>${splitParagraphs(solution).map(para => `<p>${esc(para)}</p>`).join('\n        ')}` : ''}
      </article>
    `;
    const schema = projectSchema(s, {
      name, description: desc, canonical: canonicalFor(`/labs/${s.slug}`), image: s.logo || undefined,
    });
    const html = buildHtml({
      title: `${name} | Start-Hub Lab`, description: desc, routePath: `/labs/${s.slug}`,
      image: s.logo, imageAlt: name, bodyHtml, extraJsonLd: [schema],
    });
    written.push(await writeRoute(`labs/${s.slug}`, html));
  }

  // ── sitemap.xml — public/sitemap.xml'in yerine gerçek Supabase içeriğiyle ─
  const todayIso = new Date().toISOString().slice(0, 10);
  const sitemapEntry = (loc, { changefreq, priority, lastmod }) =>
    `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod || todayIso}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  const urls = [
    sitemapEntry(`${SITE_URL}/`, { changefreq: 'daily', priority: '1.0' }),
    sitemapEntry(`${SITE_URL}/about`, { changefreq: 'monthly', priority: '0.8' }),
    sitemapEntry(`${SITE_URL}/labs`, { changefreq: 'weekly', priority: '0.8' }),
    sitemapEntry(`${SITE_URL}/blog`, { changefreq: 'daily', priority: '0.9' }),
    sitemapEntry(`${SITE_URL}/join`, { changefreq: 'monthly', priority: '0.6' }),
    ...posts.filter(p => p.slug).map(p => sitemapEntry(`${SITE_URL}/blog/${p.slug}`, { changefreq: 'monthly', priority: '0.7', lastmod: p.date })),
    ...startups.filter(s => s.slug).map(s => sitemapEntry(`${SITE_URL}/labs/${s.slug}`, { changefreq: 'weekly', priority: '0.7', lastmod: s.updated_at ? String(s.updated_at).slice(0, 10) : undefined })),
  ];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  await writeFileP(path.join(DIST, 'sitemap.xml'), sitemapXml, 'utf8');

  console.log(`[prerender] ${written.length} sayfa + sitemap.xml (${posts.length} yazı, ${startups.length} proje) üretildi.`);
  written.forEach(w => console.log('  -', w));
}

main().catch(err => {
  console.error('[prerender] beklenmeyen hata:', err);
  process.exit(1);
});
