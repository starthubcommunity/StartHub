"""
sources.py — RSS kaynaklarını çek, anahtar kelimelere göre filtrele.

İşlenen her haberin URL'i hash'lenip seen_urls.json'a kaydedilir; aynı URL ikinci kez
işlenmez (tekrar/duplicate koruması).

Kullanım:
    from sources import fetch_filtered, mark_seen
    items = fetch_filtered()  # -> sadece DAHA ÖNCE görülmemiş haberler
    ...
    mark_seen(items)          # işlenenleri kalıcı olarak kaydet
"""
import hashlib
import json
import os
import feedparser
from config import RSS_SOURCES, KEYWORDS

# İşlenen URL hash'lerinin saklandığı dosya (backend repo kökünde tutulur).
SEEN_FILE = os.path.join(os.path.dirname(__file__), "seen_urls.json")


def _url_hash(url: str) -> str:
    """URL'i normalize edip SHA-256 ile hash'ler."""
    norm = (url or "").strip().rstrip("/").lower()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def _load_seen() -> set[str]:
    """seen_urls.json'daki hash kümesini okur (yoksa boş küme)."""
    try:
        with open(SEEN_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def _save_seen(hashes: set[str]) -> None:
    with open(SEEN_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted(hashes), f, ensure_ascii=False, indent=2)


def mark_seen(items: list[dict]) -> None:
    """Verilen haberlerin URL hash'lerini seen_urls.json'a ekler (kalıcı)."""
    seen = _load_seen()
    for it in items:
        seen.add(_url_hash(it.get("link", "")))
    _save_seen(seen)
    print(f"[bilgi] {len(items)} URL 'görüldü' olarak kaydedildi (toplam {len(seen)}).")


def _matches(text: str) -> bool:
    """Başlık+özet metninde filtre kelimelerinden en az biri geçiyor mu?"""
    low = (text or "").lower()
    return any(kw.lower() in low for kw in KEYWORDS)


def fetch_filtered(limit_per_source: int = 10):
    """
    Tüm aktif RSS kaynaklarını çeker, anahtar kelime filtresinden geçenleri döndürür.
    DAHA ÖNCE işlenmiş (seen_urls.json'da hash'i olan) URL'ler atlanır.
    NOT: feedparser ağ hatalarında 'bozzo' nesne döndürebilir; entries boşsa atlanır.
    """
    seen = _load_seen()
    results = []
    skipped = 0
    for src in RSS_SOURCES:
        try:
            feed = feedparser.parse(src["url"])
        except Exception as e:  # pragma: no cover
            print(f"[uyarı] {src['name']} çekilemedi: {e}")
            continue

        for entry in feed.entries[:limit_per_source]:
            title = entry.get("title", "")
            summary = entry.get("summary", "") or entry.get("description", "")
            if not _matches(title + " " + summary):
                continue
            link = entry.get("link", "")
            if _url_hash(link) in seen:   # daha önce işlendi → atla
                skipped += 1
                continue
            results.append({
                "title": title,
                "summary": summary,
                "link": link,
                "source_name": src["name"],
                "source_url": src["url"],
                "published": entry.get("published", ""),
            })
    print(f"[bilgi] {len(results)} yeni haber filtreden geçti ({skipped} tekrar atlandı).")
    return results


if __name__ == "__main__":
    for it in fetch_filtered():
        print(f"- ({it['source_name']}) {it['title']}")
