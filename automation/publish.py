"""
publish.py — Üretilen makaleyi Supabase posts tablosuna status='draft' olarak INSERT eder.
Yayına alma kararı artık admin panelinden (Onayla/Reddet) verilir — burada doğrudan
'published' yapılmaz.

Supabase şeması (mapPostToDb ile birebir eşleşir, artı status/published_at):
    slug, tag, author_id, project_id, date, read_time, bg, image_url,
    source, source_url, title_tr, title_en, excerpt_tr, excerpt_en,
    body_tr, body_en, home_pinned, recommended, status, published_at
"""
import datetime
import math
import requests
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_COVER_W, _COVER_H = 1200, 630
_IMAGE_TIMEOUT = 10

# Gemini'nin atadığı Türkçe kategoriye göre kart arka plan rengi
CATEGORY_BG = {
    "AI":           "var(--purple-light)",
    "Yapay Zeka":   "var(--purple-light)",
    "Yatırım":      "var(--green-light)",
    "Fintech":      "var(--green-light)",
    "Girişim":      "var(--blue-light)",
    "Teknoloji":    "var(--blue-light)",
    "Blockchain":   "var(--orange-light)",
    "Kripto":       "var(--orange-light)",
}

_supabase_client = None


def _client():
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def _read_time(content: str, body_tr: list = None) -> int:
    """~200 kelime/dk okuma süresi tahmini."""
    if content:
        word_count = len(content.split())
    elif body_tr:
        word_count = len(' '.join(body_tr).split())
    else:
        word_count = 0
    return max(1, math.ceil(word_count / 200))


def _to_paragraphs(text: str) -> list[str]:
    """Düz metin makaleyi boş satırlara göre paragraf listesine dönüştürür."""
    if not text:
        return []
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    return paras or [text.strip()]


def _process_image(source_url: str, slug: str) -> str | None:
    """Kaynak görseli indirir, 1200x630'a merkezden kırpıp WebP'ye çevirir ve
    Supabase Storage'daki 'post-images' bucket'ına yükler. Public URL döner.

    Herhangi bir adımda hata olursa (indirme, kırpma, yükleme) None döner —
    asla exception fırlatmaz; görselsiz yayın engellenmemeli.
    """
    try:
        from io import BytesIO
        from PIL import Image

        resp = requests.get(source_url, timeout=_IMAGE_TIMEOUT, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()

        img = Image.open(BytesIO(resp.content)).convert("RGB")
        w, h = img.size
        target_ratio = _COVER_W / _COVER_H
        ratio = w / h
        if ratio > target_ratio:
            new_w = round(h * target_ratio)
            left = (w - new_w) // 2
            img = img.crop((left, 0, left + new_w, h))
        else:
            new_h = round(w / target_ratio)
            top = (h - new_h) // 2
            img = img.crop((0, top, w, top + new_h))
        img = img.resize((_COVER_W, _COVER_H), Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="WEBP", quality=82)

        path = f"auto/{slug}.webp"
        _client().storage.from_("post-images").upload(
            path, buf.getvalue(),
            file_options={"content-type": "image/webp", "upsert": "true"},
        )
        return _client().storage.from_("post-images").get_public_url(path)
    except Exception as e:
        print(f"[uyarı] Görsel alınamadı: {e}")
        return None


def publish_article(article: dict, dry_run: bool = False,
                    auto_publish: bool = False) -> dict | None:
    """
    Tek makaleyi Supabase posts tablosuna ekler.
    auto_publish=True  → status='published', published_at=şimdi (onay gerekmez)
    auto_publish=False → status='draft', published_at=None (panel onayı bekler)
    dry_run=True       → INSERT yapmaz, sadece loglar.
    """
    slug = article["slug"]
    content_text = article.get("content", "")
    body_tr = article.get("body_tr") or _to_paragraphs(content_text)

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    image_url = None
    src_image_url = article.get("image_url")
    if src_image_url and not dry_run:
        image_url = _process_image(src_image_url, slug)

    record = {
        "slug":          slug,
        "tag":           article.get("tag", "gundem"),
        "author_id":     article.get("author_id", None),
        "project_id":    None,
        "date":          article.get("date") or datetime.date.today().isoformat(),
        "read_time":     article.get("read_time") or _read_time(content_text, body_tr),
        "bg":            CATEGORY_BG.get(article.get("category", ""), "var(--blue-light)"),
        "image_url":     image_url,
        "source":        article.get("source", article.get("source_name", None)),
        "source_url":    article.get("source_url", None),
        "title_tr":      article.get("title_tr") or article.get("title", ""),
        "title_en":      article.get("title_en", None),
        "excerpt_tr":    article.get("excerpt_tr") or article.get("summary", ""),
        "excerpt_en":    article.get("excerpt_en", None),
        "body_tr":       body_tr,
        "body_en":       article.get("body_en", []),
        "home_pinned":   False,
        "recommended":   False,
        "status":        "published" if auto_publish else "draft",
        "published_at":  now_iso if auto_publish else None,
        "generated_at":  now_iso,
    }

    if dry_run:
        import json
        if src_image_url:
            print(f"[dry-run] Kaynak görsel bulundu (indirme/yükleme atlanıyor): {src_image_url}")
        print(f"[dry-run] Supabase'e yazılacak kayıt ({slug}, status={record['status']}):")
        print(json.dumps(record, ensure_ascii=False, indent=2))
        return None

    try:
        result = _client().table("posts").insert(record).execute()
        row = result.data[0] if result.data else {}
        print(f"[{'yayın' if auto_publish else 'draft'}] Supabase posts ← {slug} "
              f"(id: {row.get('id')}, status={record['status']})")
        return row
    except Exception as e:
        print(f"[hata] Supabase INSERT başarısız ({slug}): {e}")
        return None


def get_draft_by_slug(slug: str) -> dict | None:
    """Supabase'den status='draft' olan satırı slug'a göre bulur (regenerate için)."""
    try:
        result = (_client().table("posts")
                  .select("*")
                  .eq("slug", slug)
                  .eq("status", "draft")
                  .limit(1)
                  .execute())
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"[hata] Supabase SELECT başarısız ({slug}): {e}")
        return None


def update_article(slug: str, article: dict, dry_run: bool = False) -> dict | None:
    """Supabase'deki taslağı (status='draft') yeniden üretilen içerikle günceller."""
    content_text = article.get("content", "")
    body_tr = article.get("body_tr") or _to_paragraphs(content_text)
    updates = {
        "title_tr":   article.get("title_tr") or article.get("title", ""),
        "title_en":   article.get("title_en", None),
        "excerpt_tr": article.get("excerpt_tr") or article.get("summary", ""),
        "excerpt_en": article.get("excerpt_en", None),
        "body_tr":    body_tr,
        "body_en":    article.get("body_en", []),
        "read_time":  article.get("read_time") or _read_time(content_text, body_tr),
        "bg":         CATEGORY_BG.get(article.get("category", ""), "var(--blue-light)"),
        "source":     article.get("source", None),
        "source_url": article.get("source_url", None),
    }
    if dry_run:
        import json
        print(f"[dry-run] Supabase'de güncellenecek taslak ({slug}):")
        print(json.dumps(updates, ensure_ascii=False, indent=2))
        return None
    try:
        result = (_client().table("posts")
                  .update(updates)
                  .eq("slug", slug)
                  .eq("status", "draft")
                  .execute())
        row = result.data[0] if result.data else {}
        print(f"[güncelle] Taslak güncellendi: {slug}")
        return row
    except Exception as e:
        print(f"[hata] Supabase UPDATE başarısız ({slug}): {e}")
        return None
