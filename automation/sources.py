"""
sources.py — RSS kaynaklarını çek, anahtar kelimelere göre filtrele,
             saf Python puanlamasıyla en iyi N haberi seç (Gemini kullanılmaz).

Kaynaklar  → Supabase automation_sources  (yoksa config.py RSS_SOURCES)
Kelimeler  → Supabase automation_keywords  (yoksa config.py KEYWORDS)
Görülmüş URL → Supabase automation_seen_urls  (tekrar engeli)
"""
import datetime
import re
from supabase import create_client
from config import RSS_SOURCES as _CONFIG_SOURCES, KEYWORDS as _CONFIG_KEYWORDS
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_MIN_TEXT_LEN = 80

_sb = None


def _client():
    global _sb
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _sb


# ── Supabase'den kaynak/kelime okuma ─────────────────────────────────────────

def get_rss_sources() -> list[dict]:
    """automation_sources'dan aktif kaynakları döndür; boşsa config.py."""
    try:
        rows = (_client().table("automation_sources")
                .select("name, url, weight")
                .eq("enabled", True)
                .order("id")
                .execute().data or [])
        if rows:
            print(f"[bilgi] {len(rows)} RSS kaynağı Supabase'den okundu.")
            return rows
    except Exception as e:
        print(f"[uyarı] Supabase kaynakları okunamadı, config.py: {e}")
    return [{"name": s["name"], "url": s["url"], "weight": 5} for s in _CONFIG_SOURCES]


def get_keywords() -> dict:
    """
    automation_keywords'den kelimeleri döndür; boşsa config.py.
    Dönüş: {"high":[(kw,score),...], "medium":[(kw,score),...], "blocked":[kw,...]}
    """
    try:
        rows = (_client().table("automation_keywords")
                .select("keyword, score, group_type")
                .order("score", desc=True)
                .execute().data or [])
        if rows:
            kws: dict = {"high": [], "medium": [], "blocked": []}
            for r in rows:
                g = r.get("group_type", "medium")
                kw = r["keyword"].lower()
                if g == "blocked":
                    kws["blocked"].append(kw)
                elif g == "high":
                    kws["high"].append((kw, int(r.get("score", 5))))
                else:
                    kws["medium"].append((kw, int(r.get("score", 3))))
            print(f"[bilgi] {len(rows)} anahtar kelime Supabase'den okundu.")
            return kws
    except Exception as e:
        print(f"[uyarı] Supabase kelimeleri okunamadı, config.py: {e}")

    _HIGH = {"funding", "unicorn", "acquisition", "ipo", "yatırım", "satın alma",
             "seri", "round", "milyon dolar"}
    return {
        "high":    [(kw.lower(), 5) for kw in _CONFIG_KEYWORDS if kw.lower() in _HIGH],
        "medium":  [(kw.lower(), 3) for kw in _CONFIG_KEYWORDS if kw.lower() not in _HIGH],
        "blocked": [],
    }


# ── URL tekrar koruması (Supabase) ───────────────────────────────────────────

def _norm(url: str) -> str:
    return (url or "").strip().rstrip("/").lower()


def _load_seen() -> set[str]:
    try:
        rows = _client().table("automation_seen_urls").select("url").execute().data or []
        return {r["url"] for r in rows}
    except Exception as e:
        print(f"[uyarı] Supabase seen_urls okunamadı: {e}")
        return set()


def mark_seen(items: list[dict]) -> None:
    """İşlenen URL'leri automation_seen_urls'e kaydet."""
    rows = [{"url": _norm(it.get("link", ""))} for it in items if it.get("link")]
    if not rows:
        return
    try:
        _client().table("automation_seen_urls").upsert(rows, on_conflict="url").execute()
        print(f"[bilgi] {len(rows)} URL Supabase'e kaydedildi.")
    except Exception as e:
        print(f"[uyarı] Supabase seen_urls yazılamadı: {e}")


def cleanup_old_seen(days: int = 30) -> None:
    """30 günden eski seen_url kayıtlarını sil."""
    cutoff = (datetime.datetime.now(datetime.timezone.utc)
              - datetime.timedelta(days=days)).isoformat()
    try:
        _client().table("automation_seen_urls").delete().lt("seen_at", cutoff).execute()
        print(f"[bilgi] {days} günden eski seen_url kayıtları temizlendi.")
    except Exception as e:
        print(f"[uyarı] seen_url temizliği başarısız: {e}")


# ── Puanlama ─────────────────────────────────────────────────────────────────

_LEGACY_SRC_SCORES = {
    "techcrunch": 10, "venturebeat": 10, "webrazzi": 10, "bloomberg": 10, "reuters": 10,
    "sifted": 8, "the next web": 8, "thenextweb": 8, "wired": 8,
    "the verge": 8, "theverge": 8,
}
_REGION_KW = {"türkiye", "turkey", "istanbul", "ankara", "mena",
               "middle east", "avrupa", "europe", "emerging markets"}


def _score_item(item: dict, kws: dict, src_weights: dict) -> int:
    score = 0
    src_key = item.get("source_name", "").lower()
    score += src_weights.get(src_key, _LEGACY_SRC_SCORES.get(src_key, 3))

    text = (item.get("title", "") + " " + item.get("summary", "")).lower()
    for kw, pts in kws.get("high", []):
        if kw in text:
            score += pts
    for kw, pts in kws.get("medium", []):
        if kw in text:
            score += pts
    for rkw in _REGION_KW:
        if rkw in text:
            score += 5
            break

    parsed = item.get("published_parsed")
    if parsed:
        try:
            pub = datetime.datetime(*parsed[:6], tzinfo=datetime.timezone.utc)
            age_h = (datetime.datetime.now(datetime.timezone.utc) - pub).total_seconds() / 3600
            if age_h > 48:
                score -= 5
        except Exception:
            pass
    return score


def _title_words(title: str) -> set[str]:
    STOP = {
        "the", "and", "for", "with", "from", "this", "that", "into", "one", "new",
        "how", "why", "what", "its", "not", "are", "was", "has", "have", "will",
        "bir", "ile", "için", "ve", "bu", "da", "de", "ama", "daha", "olan",
    }
    return {
        w.lower() for w in re.sub(r"[^\w\s]", " ", title).split()
        if len(w) > 4 and w.lower() not in STOP
    }


def select_top(items: list[dict], limit: int,
               kws: dict | None = None, src_weights: dict | None = None) -> list[dict]:
    if kws is None:
        kws = {"high": [], "medium": [], "blocked": []}
    if src_weights is None:
        src_weights = {}

    valid = [it for it in items
             if len(it.get("title", "") + it.get("summary", "")) >= _MIN_TEXT_LEN]
    elim = len(items) - len(valid)
    if elim:
        print(f"[bilgi] {elim} haber kısa içerik nedeniyle elendi.")

    scored = sorted(valid, key=lambda it: _score_item(it, kws, src_weights), reverse=True)
    deduped: list[dict] = []
    for item in scored:
        kw_set = _title_words(item["title"])
        if not any(len(kw_set & _title_words(k["title"])) >= 2 for k in deduped):
            deduped.append(item)

    selected = deduped[:limit]
    scores = [_score_item(it, kws, src_weights) for it in selected]
    print(f"[bilgi] {len(valid)} haberden {len(selected)} seçildi (puanlar: {scores}).")
    return selected


# ── RSS çekme ─────────────────────────────────────────────────────────────────

def fetch_filtered(limit_per_source: int = 10,
                   enabled_categories: list | None = None) -> tuple[list[dict], dict]:
    """
    Tüm aktif RSS kaynaklarını çeker, filtreler, tekrar kontrolü yapar.

    Dönüş:
        (items, meta) — meta anahtarları:
            found, skipped_seen, skipped_blocked, kws, src_weights
    """
    import feedparser

    rss_sources = get_rss_sources()
    kws = get_keywords()
    seen = _load_seen()
    src_weights = {s["name"].lower(): int(s.get("weight", 5)) for s in rss_sources}

    results: list[dict] = []
    skipped_seen = 0
    skipped_blocked = 0

    for src in rss_sources:
        try:
            feed = feedparser.parse(src["url"])
        except Exception as e:
            print(f"[uyarı] {src['name']} çekilemedi: {e}")
            continue

        for entry in feed.entries[:limit_per_source]:
            title   = entry.get("title", "")
            summary = entry.get("summary", "") or entry.get("description", "")
            link    = entry.get("link", "")

            if _norm(link) in seen:
                skipped_seen += 1
                continue

            low = (title + " " + summary).lower()

            blocked = any(bkw in low for bkw in kws.get("blocked", []))
            if blocked:
                skipped_blocked += 1
                continue

            has_match = any(kw in low for kw, _ in kws.get("high", []) + kws.get("medium", []))
            if not has_match:
                continue

            results.append({
                "title":            title,
                "summary":          summary,
                "link":             link,
                "source_name":      src["name"],
                "source_url":       src["url"],
                "published":        entry.get("published", ""),
                "published_parsed": entry.get("published_parsed"),
            })

    print(f"[bilgi] {len(results)} yeni haber filtreden geçti "
          f"({skipped_seen} tekrar, {skipped_blocked} engellendi).")

    meta = {
        "found":           len(results) + skipped_seen + skipped_blocked,
        "skipped_seen":    skipped_seen,
        "skipped_blocked": skipped_blocked,
        "kws":             kws,
        "src_weights":     src_weights,
    }
    return results, meta
