"""
publish.py — Onaylı makaleyi doğrudan Supabase posts tablosuna INSERT eder.
GitHub yazma mantığı kaldırıldı; site veriyi Supabase'den okur.

Supabase sütun eşleşmesi (mapPostToDb ile birebir):
    slug, title_tr, excerpt_tr, body_tr, tag, category,
    source, source_url, date, read_time, home_pinned, recommended
"""
import datetime
import math
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY


def _supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _read_time(body_tr: list) -> int:
    """~200 kelime/dk okuma süresi tahmini (body_tr paragraf listesinden)."""
    word_count = sum(len(p.split()) for p in body_tr)
    return max(1, math.ceil(word_count / 200))


def publish_article(article: dict) -> bool:
    """
    Tek makaleyi Supabase'e yazar. Aynı slug zaten varsa günceller (upsert).
    Dönüş: başarılıysa True, hata varsa False.
    """
    body_tr = article.get("body_tr") or []
    if isinstance(body_tr, str):
        body_tr = [p.strip() for p in body_tr.split("\n\n") if p.strip()]

    row = {
        "slug":        article["slug"],
        "title_tr":    article.get("title_tr") or article.get("title", ""),
        "excerpt_tr":  article.get("excerpt_tr") or article.get("summary", ""),
        "body_tr":     body_tr,
        "tag":         article.get("tag", "gundem"),
        "category":    article.get("category", "Teknoloji"),
        "source":      article.get("source") or article.get("source_name"),
        "source_url":  article.get("source_url", ""),
        "date":        article.get("date") or datetime.date.today().isoformat(),
        "read_time":   article.get("read_time") or _read_time(body_tr),
        "home_pinned": bool(article.get("home_pinned", False)),
        "recommended": bool(article.get("recommended", False)),
    }

    try:
        client = _supabase()
        client.table("posts").upsert(row, on_conflict="slug").execute()
        print(f"[supabase] yayınlandı: {row['slug']}")
        return True
    except Exception as e:
        print(f"[hata] Supabase yazma başarısız ({row['slug']}): {e}")
        return False
