// routes.js — path üretimi, hem app.jsx (routing motoru) hem sayfa
// bileşenleri (gerçek <a href> üretmek için) tarafından kullanılır. Tek
// kaynak: burada bir şey değişirse navigate() ve gerçek linkler AYNI ANDA
// güncel kalır, aralarında sürüklenme (drift) riski olmaz.
import { getPostSlug, getStartupSlug } from '../data';

// 2026-09-29 (SEO/GEO): "kart" gibi tıklanabilir div'leri gerçek <a href>'e
// çevirirken tekrarlanan koruma — sol-tık + modifier'sız tıklamada
// preventDefault edip verilen fn()'i çalıştırır (navigate() ile pushState),
// aksi halde (Ctrl/Cmd/orta-tık/Shift) tarayıcının kendi native davranışına
// (yeni sekmede aç vb.) karışılmaz.
export function guardClick(e, fn) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  fn();
}

export function pathFor(page, id) {
  if (!page || page === 'home') return '/';
  if (page === 'post' && id != null) {
    const slug = getPostSlug(id);
    return slug ? `/blog/${slug}` : `/blog/${id}`;
  }
  if (page === 'project' && id != null) {
    const slug = getStartupSlug(id);
    return slug ? `/labs/${slug}` : `/labs/${id}`;
  }
  return `/${page}`;
}
