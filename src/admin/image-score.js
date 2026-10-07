// Görsel skorunun JS karşılığı — automation/image_matcher.py ile aynı formül ve aynı filtre bayrakları.
// Sabitler automation/matching_config.json'dan (image-constants.js üzerinden) gelir.
// Parite: src/admin/image-score.test.mjs ve automation/tests/test_image_parity.py aynı fixture'ı kullanır.
import { CATEGORY_ALIAS, SCORE, GENERIC_TAG_HINTS, PARTNERSHIP_TOPIC_TAGS, VISUAL_TYPES } from './image-constants.js';

const TR = { 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };

// Admin listesinde elenme nedeni etiketleri (filtre adı → metin).
export const FLAG_LABELS = {
  category_fit: 'kategori uyumsuz',
  recent_posts: `son ${SCORE.RECENT_POSTS_EXCLUDE} yazıda kullanıldı`,
  over_used_30d: `son ${SCORE.DAILY_WINDOW_DAYS} günde ${SCORE.MAX_USES_IN_WINDOW}+ kez kullanıldı`,
  recent_visual_type: 'tip tekrarı',
  generic_excluded: 'klişe',
};

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

// Son `days` gündeki kullanım sayısı: { [image_id]: n }. history: image_usage satırları (used_at string).
export function usageCounts(history, nowMs, days) {
  const since = nowMs - days * 24 * 3600 * 1000;
  const out = {};
  for (const h of history) {
    if (new Date(h.used_at).getTime() >= since) out[h.image_id] = (out[h.image_id] || 0) + 1;
  }
  return out;
}

export function visualWindow(nImages) {
  const avg = nImages / VISUAL_TYPES.length;
  for (const [threshold, window] of SCORE.VISUAL_WINDOW_RULES) {
    if (avg < threshold) return window;
  }
  return SCORE.VISUAL_WINDOW_DEFAULT;
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

export function isSameCategory(articleCat, imgCat) {
  return !!imgCat && (imgCat === articleCat || (CATEGORY_ALIAS[articleCat] || []).includes(imgCat));
}

const partnershipPatterns = PARTNERSHIP_TOPIC_TAGS.map(t => new RegExp(`(?<!\\w)${escapeRe(tagNorm(t))}(?!\\w)`));

// Haberde ortaklık/anlaşma/birleşme vb. kelimeler geçiyor mu (el_sikisma görsellerinin 'son çare'
// elenmesinden muaf tutulup tutulmayacağına karar vermek için) — image_matcher.py ile aynı mantık.
function hasPartnershipTopic(text) {
  return partnershipPatterns.some(p => p.test(text));
}

// Konuyla uyumlu (kategori+etiket, kullanım bonusu HARİÇ) ve klişe olmayan güçlü bir aday varsa,
// aynı kategorideki klişe görseller elenir. İstisna: el_sikisma, haber ortaklık/anlaşma vb.
// konuluysa elenmez — image_matcher.py _generic_excluded_ids ile aynı mantık.
function genericExcludedIds(articleCategory, images, scored, text) {
  let specBest = null;
  for (const img of images) {
    if (img.is_generic || !isSameCategory(articleCategory, img.category || '')) continue;
    const v = scored[img.id].parts.cat + scored[img.id].parts.tagScore;
    if (specBest === null || v > specBest) specBest = v;
  }
  if (specBest === null || specBest < SCORE.MIN_SPECIFIC_SCORE) return new Set();
  const hasTopic = hasPartnershipTopic(text);
  const excluded = new Set();
  for (const img of images) {
    if (!img.is_generic || !isSameCategory(articleCategory, img.category || '')) continue;
    if (img.visual_type === 'el_sikisma' && hasTopic) continue;
    excluded.add(img.id);
  }
  return excluded;
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

// Filtresiz skor: { [id]: { score, parts, tags } }. Python score_all ile aynı değerleri üretir.
function scoreAll(text, articleCategory, images, usage90) {
  const weights = tagWeights(images);
  const maxUsage = Math.max(0, ...images.map(i => usage90[i.id] || 0));
  const out = {};
  for (const img of images) {
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
    out[img.id] = {
      score: Math.round(score * 100) / 100,
      raw: score, // eşik kararı yuvarlanmamış skorla (Python ile aynı)
      tags: hits,
      parts: { cat, tagScore: Math.round(tagScore * 100) / 100, usage90: u, usageBonus: Math.round(usageBonus * 100) / 100 },
    };
  }
  return out;
}

// images: image_stock satırları; usage90: usageCounts(...) çıktısı.
// Dönüş: [{ image, score, tags, parts }] — en yüksek skor üstte, eşitlikte id küçük olan önce.
export function rankImages(post, images, usage90, articleCategory) {
  const scored = scoreAll(buildText(post), articleCategory, images, usage90);
  return images
    .map(img => ({ image: img, ...scored[img.id] }))
    .sort((a, b) => b.score - a.score || (a.image.id - b.image.id));
}

// Her görsel için elenme nedenleri (boş dizi = elenmedi). Python image_flags ile aynı mantık.
// generic_excluded tam stok üzerinden hesaplanır (admin listesi); seçimdeki havuz kuralı Python'da.
export function imageFlags({ post, articleCategory, images, history, now }) {
  const text = buildText(post);
  const byId = Object.fromEntries(images.map(i => [i.id, i]));
  const uses30 = usageCounts(history, now, SCORE.DAILY_WINDOW_DAYS);
  const recentIds = new Set(history.slice(0, SCORE.RECENT_POSTS_EXCLUDE).map(h => h.image_id));
  const recentTypes = new Set(
    history.slice(0, visualWindow(images.length))
      .map(h => byId[h.image_id]?.visual_type)
      .filter(Boolean)
  );
  const flags = {};
  for (const img of images) {
    const f = [];
    if (!isSameCategory(articleCategory, img.category || '')) f.push('category_fit');
    if (recentIds.has(img.id)) f.push('recent_posts');
    if ((uses30[img.id] || 0) >= SCORE.MAX_USES_IN_WINDOW) f.push('over_used_30d');
    if (img.visual_type && recentTypes.has(img.visual_type)) f.push('recent_visual_type');
    flags[img.id] = f;
  }

  const usage90 = usageCounts(history, now, SCORE.USAGE_WINDOW_DAYS);
  const scored = scoreAll(text, articleCategory, images, usage90);
  for (const id of genericExcludedIds(articleCategory, images, scored, text)) {
    flags[id].push('generic_excluded');
  }
  return flags;
}
