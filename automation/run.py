"""
run.py — Orkestratör. GitHub Actions workflow_dispatch ile tetiklenir.

Akış:
  1. RSS tara + filtre + tekrar koruma   (sources.fetch_filtered)
  2. Gemini ile ilgi puanı + en yüksek N (generate.rank_and_select)
  3. Gemini ile üret                     (generate.generate_article)
  4. Takvime 'draft' olarak ekle         (editorial_calendar.add_draft)
  5. 'approved' satırları Supabase'e yaz (publish.publish_article)
  6. Takvimde 'published' işaretle       (editorial_calendar.mark_published)

Modlar : all | generate | publish | regenerate <slug...>
Bayrak  : --dry-run  →  hiçbir yere yazılmaz, sadece terminale loglanır
"""
import sys
import json
from config import DAILY_LIMIT
import sources
import generate
import editorial_calendar as editorial
import publish

DRY_RUN = "--dry-run" in sys.argv
ARGS = [a for a in sys.argv[1:] if a != "--dry-run"]


def step_generate():
    """RSS -> filtre -> Gemini puanla -> en yüksek N -> üret -> taslak."""
    items = sources.fetch_filtered()
    if not items:
        print("[bilgi] İşlenecek yeni haber yok.")
        return
    top_items = generate.rank_and_select(items, DAILY_LIMIT)
    produced = 0
    seen_slugs = set()
    processed = []
    for item in top_items:
        article = generate.generate_article(item)
        if not article or article["slug"] in seen_slugs:
            continue
        seen_slugs.add(article["slug"])
        if DRY_RUN:
            print(f"[dry-run] Takvime eklenmeyecek — önizleme:")
            print(json.dumps(article, ensure_ascii=False, indent=2))
        else:
            editorial.add_draft(article)
            processed.append(item)
        produced += 1
    if not DRY_RUN:
        sources.mark_seen(processed)
    print(f"[özet] {produced} taslak {'önizlendi' if DRY_RUN else 'üretildi'} (limit {DAILY_LIMIT}).")


def step_regenerate(slugs):
    """Verilen slug listesi için Gemini'yi yeniden çağırır, taslakları günceller."""
    if not slugs:
        print("[uyarı] regenerate için slug verilmedi.")
        return
    regenerated = 0
    for slug in slugs:
        row = editorial.get_by_slug(slug)
        if not row:
            print(f"[uyarı] slug takvimde yok: {slug}")
            continue
        # content sütunundaki JSON'dan kaynak bilgilerini geri yükle
        article_data = {}
        try:
            article_data = json.loads(row.get("content", "{}") or "{}")
        except (json.JSONDecodeError, TypeError):
            pass
        item = {
            "title":       article_data.get("title_tr") or row.get("title", ""),
            "summary":     article_data.get("excerpt_tr", ""),
            "link":        article_data.get("source_url") or row.get("source_url", ""),
            "source_name": article_data.get("source", ""),
        }
        article = generate.generate_article(item)
        if not article:
            continue
        article["slug"] = slug
        if DRY_RUN:
            print(f"[dry-run] Güncellenmeyecek: {slug}")
            print(json.dumps(article, ensure_ascii=False, indent=2))
        elif editorial.update_draft(article):
            regenerated += 1
    print(f"[özet] {regenerated} taslak yeniden üretildi.")


def step_publish():
    """Takvimdeki 'approved' satırları Supabase posts tablosuna yazar."""
    approved = editorial.get_approved()
    if not approved:
        print("[bilgi] Yayınlanacak onaylı yazı yok.")
        return
    published_count = 0
    for row in approved:
        # content sütununda tam makale JSON'u var
        article = None
        try:
            article = json.loads(row.get("content", "") or "")
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

        # Geriye dönük uyumluluk: JSON yoksa sütun değerlerinden kur
        if not article:
            article = {
                "slug":       row.get("slug", ""),
                "title_tr":   row.get("title", ""),
                "excerpt_tr": "",
                "body_tr":    [],
                "category":   row.get("category", "Teknoloji"),
                "tag":        "gundem",
                "source":     "",
                "source_url": row.get("source_url", ""),
            }

        result = publish.publish_article(article, dry_run=DRY_RUN)
        if not DRY_RUN and result is not None:
            editorial.mark_published(article["slug"])
            published_count += 1
        elif DRY_RUN:
            published_count += 1

    print(f"[özet] {published_count} yazı "
          f"{'önizlendi (dry-run)' if DRY_RUN else 'Supabase posts tablosuna eklendi'}.")


def main():
    if DRY_RUN:
        print("=" * 50)
        print("DRY RUN — hiçbir yere yazılmıyor")
        print("=" * 50)

    mode = ARGS[0] if ARGS else "all"

    if mode == "regenerate":
        step_regenerate(ARGS[1:])
        return
    if mode in ("generate", "all"):
        step_generate()
    if mode in ("publish", "all"):
        step_publish()


if __name__ == "__main__":
    main()
