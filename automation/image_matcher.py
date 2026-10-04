"""
image_matcher.py — Üretilen makaleye image_stock havuzundan görsel seçer.

Yayın anında HİÇBİR AI/LLM/embedding çağrısı yapılmaz; seçim deterministik ve
yereldir. Sabitler config.py'de. Her hata durumunda eski (kullanım sayacına
dayalı) algoritmaya, o da olmazsa FALLBACK_IMAGES'a düşülür; yayın görselsiz
kalmaz ve hata loglanır.

Puanlama (select_image):
  - Kategori: doğrudan eşleşme +3, alias eşleşmesi +2, "Genel" görsel +1
  - Etiketler: kelime sınırlı (\\b benzeri) eşleşme; ağırlık IDF tabanlı,
    GENERIC_TAGS en fazla 0.5; toplam TAG_SCORE_CAP ile sınırlı
  - Kullanım: son USAGE_WINDOW_DAYS gündeki image_usage sayısına göre 0–2

Filtreler (sırayla; aday kalmazsa o filtre gevşer ve reason'a yazılır):
  a. Son RECENT_POSTS_EXCLUDE yazıda kullanılan görseller
  b. Son DAILY_WINDOW_DAYS günde MAX_USES_IN_WINDOW'dan fazla kullanılanlar
  c. Son N yazının visual_type'ları, N = visual_window(stok büyüklüğü) (null olan muaf)
  d. is_generic görseller, yalnızca AYNI kategoride klişe olmayan ve MIN_SPECIFIC_SCORE
     üstü bir aday varsa elenir; aksi halde seçilebilir
"""
import logging
import math
import re
from collections import Counter
from datetime import datetime, timedelta, timezone

import config

log = logging.getLogger("image_matcher")

_TR_MAP = str.maketrans({
    "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
    "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
})

_pattern_cache: dict[str, re.Pattern] = {}


def normalize(text: str) -> str:
    return (text or "").translate(_TR_MAP).lower()


def _tag_norm(tag: str) -> str:
    return normalize(tag).strip()


def _tag_pattern(tag: str) -> re.Pattern:
    pat = _pattern_cache.get(tag)
    if pat is None:
        pat = re.compile(r"(?<!\w)" + re.escape(tag) + r"(?!\w)")
        _pattern_cache[tag] = pat
    return pat


def build_text(article: dict) -> str:
    body = article.get("body_tr") or []
    if isinstance(body, list):
        body = " ".join(body)
    body = (body or "")[: config.TEXT_BODY_CHARS]
    return normalize(f"{article.get('title_tr') or ''} {article.get('excerpt_tr') or ''} {body}")


def tag_weights(images: list[dict]) -> dict[str, float]:
    n = len(images)
    df: Counter = Counter()
    for img in images:
        df.update({_tag_norm(t) for t in (img.get("tags") or []) if t and _tag_norm(t)})
    generic = {_tag_norm(g) for g in config.GENERIC_TAGS}
    weights = {}
    for tag, d in df.items():
        w = 1 + math.log((n + 1) / (d + 1)) * config.IDF_SCALE
        if tag in generic:
            w = min(w, config.GENERIC_TAG_MAX_WEIGHT)
        weights[tag] = w
    return weights


def _is_same_category(article_category: str, image_category: str) -> bool:
    return bool(image_category) and (
        image_category == article_category
        or image_category in config.CATEGORY_ALIAS.get(article_category, [])
    )


def _category_score(article_category: str, image_category: str) -> float:
    score = 0.0
    if image_category:
        if image_category == article_category:
            score = config.CATEGORY_DIRECT_BONUS
        elif image_category in config.CATEGORY_ALIAS.get(article_category, []):
            score = config.CATEGORY_ALIAS_BONUS
    if image_category == config.GENEL_CATEGORY:
        score += config.GENEL_CATEGORY_BONUS
    return score


def score_image(text: str, article_category: str, img: dict, weights: dict[str, float],
                usage_window: dict[int, int], max_usage: int) -> tuple[float, dict]:
    cat_score = _category_score(article_category, img.get("category") or "")

    tag_hits = []
    total = 0.0
    seen = set()
    for raw in img.get("tags") or []:
        t = _tag_norm(raw)
        if not t or t in seen:
            continue
        seen.add(t)
        if _tag_pattern(t).search(text):
            w = weights.get(t, 1.0)
            tag_hits.append({"tag": t, "w": round(w, 2)})
            total += w
    tag_score = min(total, config.TAG_SCORE_CAP)

    usage = usage_window.get(img["id"], 0)
    usage_bonus = config.USAGE_BONUS_MAX * (1 - usage / max_usage) if max_usage > 0 else config.USAGE_BONUS_MAX

    score = cat_score + tag_score + usage_bonus
    return score, {
        "category": round(cat_score, 2),
        "tags": tag_hits,
        "tag_score": round(tag_score, 2),
        "usage_window": usage,
        "usage_bonus": round(usage_bonus, 2),
        "score": round(score, 2),
    }


def _parse_ts(value) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def visual_window(n_images: int) -> int:
    avg = n_images / len(config.VISUAL_TYPES)
    for threshold, window in config.VISUAL_WINDOW_RULES:
        if avg < threshold:
            return window
    return config.VISUAL_WINDOW_DEFAULT


def select_image(text: str, article_category: str, images: list[dict], history: list[dict],
                 now: datetime) -> dict:
    """Saf seçim fonksiyonu (DB'ye dokunmaz). history: used_at'e göre yeniden eskiye sıralı."""
    if not images:
        raise ValueError("boş görsel havuzu")

    by_id = {img["id"]: img for img in images}
    weights = tag_weights(images)

    window_90 = now - timedelta(days=config.USAGE_WINDOW_DAYS)
    usage_90 = Counter(h["image_id"] for h in history if h["used_at"] >= window_90)
    max_usage = max((usage_90.get(i["id"], 0) for i in images), default=0)

    window_30 = now - timedelta(days=config.DAILY_WINDOW_DAYS)
    uses_30 = Counter(h["image_id"] for h in history if h["used_at"] >= window_30)

    recent_ids = {h["image_id"] for h in history[: config.RECENT_POSTS_EXCLUDE]}
    recent_types = {
        by_id[h["image_id"]].get("visual_type")
        for h in history[: visual_window(len(images))]
        if h["image_id"] in by_id and by_id[h["image_id"]].get("visual_type")
    }

    filters = [
        ("recent_posts", lambda img: img["id"] not in recent_ids),
        ("over_used_30d", lambda img: uses_30.get(img["id"], 0) < config.MAX_USES_IN_WINDOW),
        ("recent_visual_type", lambda img: not img.get("visual_type") or img["visual_type"] not in recent_types),
    ]

    pool = list(images)
    applied, relaxed = [], []
    for name, keep in filters:
        candidates = [img for img in pool if keep(img)]
        if candidates:
            pool = candidates
            applied.append(name)
        else:
            relaxed.append(name)

    scored = {img["id"]: score_image(text, article_category, img, weights, usage_90, max_usage) for img in pool}

    # Klişe görsel, yalnızca AYNI kategoride klişe olmayan ve eşik üstü bir aday varsa elenir.
    same_cat_specific_best = max(
        (scored[img["id"]][0] for img in pool
         if not img.get("is_generic") and _is_same_category(article_category, img.get("category") or "")),
        default=None,
    )
    generic_excluded = same_cat_specific_best is not None and same_cat_specific_best >= config.MIN_SPECIFIC_SCORE
    if generic_excluded:
        pool = [img for img in pool
                if not (img.get("is_generic") and _is_same_category(article_category, img.get("category") or ""))]
        applied.append("generic_excluded")
    generic_allowed = not generic_excluded

    last_used: dict[int, float] = {}
    for h in history:
        ts = _parse_ts(h["used_at"]).timestamp()
        last_used[h["image_id"]] = max(last_used.get(h["image_id"], 0.0), ts)

    ranked = sorted(pool, key=lambda img: (-scored[img["id"]][0], last_used.get(img["id"], 0.0), img["id"]))
    best = ranked[0]
    best_score, best_parts = scored[best["id"]]

    return {
        "image": best,
        "score": round(best_score, 2),
        "reason": {
            "best": best_parts,
            "filters_applied": applied,
            "filters_relaxed": relaxed,
            "generic_allowed": generic_allowed,
            "is_generic_pick": bool(best.get("is_generic")),
            "top3": [
                {"id": img["id"], "score": round(scored[img["id"]][0], 2)} for img in ranked[:3]
            ],
        },
        "relaxed_count": len(relaxed),
    }


def _legacy_pick(text: str, article_category: str, rows: list[dict]) -> dict:
    """Eski algoritma (kullanım için yedek): kategori + etiket + usage_count."""
    max_usage = max((r.get("usage_count") or 0) for r in rows)
    legacy_alias = {"AI": "Yapay Zeka", "Yatırım": "Fon"}

    def score(r):
        s = 0.0
        ic = r.get("category") or ""
        if ic and (ic == article_category or ic == legacy_alias.get(article_category)):
            s += 10
        for tag in r.get("tags") or []:
            if tag and _tag_norm(tag) in text:
                s += 3
        usage = r.get("usage_count") or 0
        s += 2 * (1 - usage / max_usage) if max_usage > 0 else 2
        return s

    best = sorted(rows, key=lambda r: (-score(r), r.get("usage_count") or 0, r["id"]))[0]
    return {"url": best["url"], "alt_tr": best.get("alt_tr") or "", "id": best.get("id"),
            "usage_count": best.get("usage_count") or 0, "needs_review": False,
            "reason": {"mode": "legacy"}}


def _fallback(article_category: str, why: str) -> dict:
    url = config.FALLBACK_IMAGES.get(article_category, config.FALLBACK_IMAGES["default"])
    return {"url": url, "alt_tr": "Start-Hub", "id": None, "usage_count": 0,
            "needs_review": True, "reason": {"mode": "fallback", "why": why}}


def _load_images(client) -> list[dict]:
    return client.table("image_stock").select("*").order("id").execute().data or []


def _load_history(client, now: datetime) -> list[dict]:
    rows = (client.table("image_usage")
            .select("image_id, post_id, used_at, score, reason")
            .order("used_at", desc=True)
            .limit(config.HISTORY_LIMIT)
            .execute().data or [])
    for r in rows:
        r["used_at"] = _parse_ts(r["used_at"])
    return rows


def find_best_image(article: dict, supabase_client, dry_run: bool = False) -> dict:
    """
    Dönüş: {"url", "alt_tr", "id", "usage_count", "needs_review", "score", "reason"}.
    Asla exception fırlatmaz ve asla None dönmez (son çare görseli dahil).
    DB'ye yazmaz — kullanım kaydı publish.record_image_usage ile, yazı başarıyla
    eklendikten sonra yapılır.
    """
    category = article.get("category") or ""
    now = datetime.now(timezone.utc)
    try:
        images = _load_images(supabase_client)
    except Exception as e:
        log.warning("image_stock okunamadı, son çare görseli kullanılacak: %s", e)
        return _fallback(category, "image_stock_unreadable")
    if not images:
        log.warning("image_stock boş, son çare görseli kullanılacak")
        return _fallback(category, "empty_stock")

    text = build_text(article)
    try:
        history = _load_history(supabase_client, now)
    except Exception as e:
        log.warning("image_usage okunamadı (eski algoritma kullanılacak): %s", e)
        try:
            legacy = _legacy_pick(text, category, images)
            legacy["reason"]["why"] = "history_unreadable"
            return legacy
        except Exception as e2:
            log.error("eski algoritma da başarısız: %s", e2)
            return _fallback(category, "legacy_failed")

    try:
        res = select_image(text, category, images, history, now)
    except Exception as e:
        log.error("görsel seçimi başarısız, eski algoritmaya dönülüyor: %s", e)
        try:
            return _legacy_pick(text, category, images)
        except Exception as e2:
            log.error("eski algoritma da başarısız: %s", e2)
            return _fallback(category, "legacy_failed")

    img = res["image"]
    needs_review = res["relaxed_count"] >= config.RELAX_REVIEW_THRESHOLD
    print(f"[bilgi] Görsel seçildi: id={img.get('id')} kategori={img.get('category')} "
          f"tip={img.get('visual_type')} skor={res['score']} gevşetilen={res['reason']['filters_relaxed']}")
    return {
        "url": img["url"],
        "alt_tr": img.get("alt_tr") or "",
        "id": img.get("id"),
        "usage_count": img.get("usage_count") or 0,
        "needs_review": needs_review,
        "score": res["score"],
        "reason": res["reason"],
    }
