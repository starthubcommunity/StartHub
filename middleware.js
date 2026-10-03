// Vercel Routing Middleware (SEO Aşama 7) — var olmayan /labs/<slug> ve
// /blog/<slug> adreslerine gerçek 404 döndürür. Geçerli slug listesi build
// sırasında scripts/prerender.mjs tarafından valid-slugs.js'e yazılır.
// Liste yoksa (null — prerender atlandıysa) isteği olduğu gibi geçirir: yanlışlıkla
// geçerli sayfaları 404'lemektense soft-404'e düşmek daha güvenli.
import { next } from '@vercel/functions';
import validSlugs from './valid-slugs.js';

export const config = {
  matcher: ['/labs/:slug', '/blog/:slug'],
};

export default function middleware(request) {
  const { pathname } = new URL(request.url);
  const match = pathname.match(/^\/(labs|blog)\/([^/]+)\/?$/);
  if (!match) return next();

  const [, kind, rawSlug] = match;
  const list = validSlugs[kind];
  if (!Array.isArray(list)) return next();

  let slug = rawSlug;
  try { slug = decodeURIComponent(rawSlug); } catch { /* bozuk kodlama — ham değerle karşılaştır */ }
  if (list.includes(slug)) return next();

  return new Response('Not Found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
  });
}
