// Görsel skorunun JS karşılığı — automation/image_matcher.py ile aynı formül,
// yalnızca "Görseli değiştir" listesinin sıralaması için. Filtreler (son 10 yazı,
// gevşetme vb.) uygulanmaz: admin burada her adayı görebilmeli.
// Sabitler image-constants.js'te; Python tarafı değişirse burası da güncellenmeli.
import { CATEGORY_ALIAS, SCORE, GENERIC_TAG_HINTS } from './image-constants';

const TR = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

export function normalize(text) {
  return String(text || '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, c => TR[c]).toLowerCase();
}

const tagNorm = t => normalize(t).trim();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildText(post) {
  const body = Array.isArray(post.body_tr) ? post.body_tr.join(' ') : String(post.body_tr || '');
  return normalize(`${post.title_tr || ''} ${post.excerpt_tr || ''} ${body.slice(0, SCORE.TEXT_BODY_CHARS)}`);
}

function tagWeights(images) {
  const n = images.length;
  const df = {};
  for (const img of images) {
    for (const t of new Set((img.tags || []).map(tagNorm).filter(Boolean))) df[t] = (df[t] || 0) + 1;
  }
  const generic = new Set(GENERIC_TAG_HINTS.map(tagNorm));
  const w = {};
  for (const [t, d] of Object.entries(df)) {
    let v = 1 + Math.log((n + 1) / (d + 1)) * SCORE.IDF_SCALE;
    if (generic.has(t)) v = Math.min(v, SCORE.GENERIC_TAG_MAX_WEIGHT);
    w[t] = v;
  }
  return w;
}

function categoryScore(articleCat, imgCat) {
  let s = 0;
  if (imgCat) {
    if (imgCat === articleCat) s = SCORE.CATEGORY_DIRECT;
    else if ((CATEGORY_ALIAS[articleCat] || []).includes(imgCat)) s = SCORE.CATEGORY_ALIAS;
  }
  if (imgCat === SCORE.GENEL_CATEGORY) s += SCORE.GENEL_BONUS;
  return s;
}

// images: image_stock satırları; usage90: { [image_id]: son 90 gündeki kullanım sayısı }
// Dönüş: [{ image, score, tags: [{tag, w}], parts }] — en yüksek skor üstte.
export function rankImages(post, images, usage90, articleCategory) {
  const text = buildText(post);
  const weights = tagWeights(images);
  const maxUsage = Math.max(0, ...images.map(i => usage90[i.id] || 0));
  const ranked = images.map(img => {
    const cat = categoryScore(articleCategory, img.category || '');
    const hits = [];
    let total = 0;
    const seen = new Set();
    for (const raw of img.tags || []) {
      const t = tagNorm(raw);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      if (new RegExp(`(?<!\\w)${escapeRe(t)}(?!\\w)`).test(text)) {
        const w = weights[t] ?? 1;
        hits.push({ tag: t, w: Math.round(w * 100) / 100 });
        total += w;
      }
    }
    const tagScore = Math.min(total, SCORE.TAG_SCORE_CAP);
    const u = usage90[img.id] || 0;
    const usageBonus = maxUsage > 0 ? SCORE.USAGE_BONUS_MAX * (1 - u / maxUsage) : SCORE.USAGE_BONUS_MAX;
    const score = cat + tagScore + usageBonus;
    return { image: img, score: Math.round(score * 100) / 100, tags: hits, parts: { cat, tagScore: Math.round(tagScore * 100) / 100, usage90: u, usageBonus: Math.round(usageBonus * 100) / 100 } };
  });
  return ranked.sort((a, b) => b.score - a.score || (a.image.id - b.image.id));
}
