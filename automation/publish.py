"""
publish.py — Onaylı makaleyi Supabase posts tablosuna INSERT eder.

Supabase şeması (mapPostToDb ile birebir eşleşir):
    slug, tag, author_id, project_id, date, read_time, bg, image_url,
    source, source_url, title_tr, title_en, excerpt_tr, excerpt_en,
    body_tr, body_en, home_pinned, recommended
"""
import datetime
import math
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_supabase_client = None


def _client():
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def _read_time(content: str) -> int:
    """~200 kelime/dk okuma süresi tahmini."""
    return max(1, math.ceil(len((content or "").split()) / 200))


def _to_paragraphs(text: str) -> list[str]:
    """Düz metin makaleyi boş satırlara göre paragraf listesine dönüştürür."""
    if not text:
        return []
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    return paras or [text.strip()]


def publish_article(article: dict, dry_run: bool = False) -> dict | None:
    """
    Tek makaleyi Supabase posts tablosuna ekler.
    dry_run=True ise INSERT yapmaz, sadece kaydı loglar.
    Dönüş: eklenen satır (dry_run'da None).
    """
    slug = article["slug"]
    content_text = article.get("content", "")

    # Gemini'den gelen düz metin → body_tr paragraph array
    body_tr = article.get("body_tr") or _to_paragraphs(content_text)

    record = {
        "slug":        slug,
        "tag":         article.get("tag", "gundem"),
        "author_id":   article.get("author_id", None),
        "project_id":  None,
        "date":        article.get("date") or datetime.date.today().isoformat(),
        "read_time":   article.get("read_time") or _read_time(content_text),
        "bg":          article.get("bg", "var(--blue-light)"),
        "image_url":   article.get("image_url", None),
        "source":      article.get("source_name", None),
        "source_url":  article.get("source_url", None),
        "title_tr":    article.get("title_tr") or article.get("title", ""),
        "title_en":    article.get("title_en", None),
        "excerpt_tr":  article.get("excerpt_tr") or article.get("summary", ""),
        "excerpt_en":  article.get("excerpt_en", None),
        "body_tr":     body_tr,
        "body_en":     article.get("body_en", []),
        "home_pinned": False,
        "recommended": False,
    }

    if dry_run:
        import json
        print(f"[dry-run] Supabase'e yazılacak kayıt ({slug}):")
        print(json.dumps(record, ensure_ascii=False, indent=2))
        return None

    try:
        result = _client().table("posts").insert(record).execute()
        row = result.data[0] if result.data else {}
        print(f"[yayın] Supabase posts ← {slug} (id: {row.get('id')})")
        return row
    except Exception as e:
        print(f"[hata] Supabase INSERT başarısız ({slug}): {e}")
        return None
