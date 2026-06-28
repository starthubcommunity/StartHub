"""
run.py — Orkestratör. GitHub Actions workflow_dispatch ile tetiklenir.

Akış:
  1. RSS tara + filtre + tekrar koruma   (sources.fetch_filtered)
  2. Gemini ile ilgi puanı + en yüksek N (generate.rank_and_select)
  3. Gemini ile üret                     (generate.generate_article)
  4. Takvime 'draft' olarak ekle         (editorial_calendar.add_draft)
  5. 'approved' satırları Supabase'e yaz (publish.publish_article)
  6. Takvimde 'published' işaretle       (editorial_calendar.mark_published)

Modlar: all | generate | publish | regenerate <slug...>

Dry-run: DRY_RUN=1 ortam değişkeni veya --dry-run argümanı ile
         hiçbir yere (Sheets/Supabase) yazılmaz, sonuçlar terminale yazdırılır.
"""
import json
import os
import sys
from config import DAILY_LIMIT
import sources
import generate
import editorial_calendar as editorial
import publish

DRY_RUN = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes") \
          or "--dry-run" in sys.argv


def step_generate():
    """RSS -> filtre (tekrar korumalı) -> Gemini ile puanla -> en yüksek N -> üret -> taslak."""
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
            print("\n[DRY RUN] Sheets'e yazılmadı. Üretilen makale:")
            print(json.dumps(article, ensure_ascii=False, indent=2))
        else:
            editorial.add_draft(article)
            processed.append(item)

        produced += 1

    if not DRY_RUN:
        sources.mark_seen(processed)

    mode_label = " (DRY RUN)" if DRY_RUN else ""
    print(f"[özet] {produced} taslak üretildi{mode_label} (limit {DAILY_LIMIT}).")


def step_regenerate(slugs):
    """'regenerate' modu — verilen slug listesi için Gemini'yi yeniden çağırır."""
    if not slugs:
        print("[uyarı] regenerate için slug verilmedi.")
        return
    regenerated = 0
    for slug in slugs:
        row = editorial.get_by_slug(slug)
        if not row:
            print(f"[uyarı] slug takvimde yok: {slug}")
            continue
        item = {
            "title":       row.get("title_tr", ""),
            "summary":     row.get("excerpt_tr", ""),
            "link":        row.get("source_url", ""),
            "source_name": row.get("source", ""),
        }
        article = generate.generate_article(item)
        if not article:
            continue
        article["slug"] = slug   # slug'ı sabit tut

        if DRY_RUN:
            print(f"\n[DRY RUN] Takvim güncellenmedi. Yeniden üretilen ({slug}):")
            print(json.dumps(article, ensure_ascii=False, indent=2))
        elif editorial.update_draft(article):
            regenerated += 1

    if not DRY_RUN:
        print(f"[özet] {regenerated} taslak yeniden üretildi.")


def step_publish():
    """Takvimdeki 'approved' satırları Supabase'e yazar."""
    approved = editorial.get_approved()
    if not approved:
        print("[bilgi] Yayınlanacak onaylı yazı yok.")
        return

    published = 0
    for article in approved:
        if DRY_RUN:
            print(f"\n[DRY RUN] Supabase'e yazılmadı: {article.get('slug')}")
            continue
        ok = publish.publish_article(article)
        if ok:
            editorial.mark_published(article["slug"])
            published += 1

    if not DRY_RUN:
        print(f"[özet] {published} makale Supabase'e yayınlandı.")


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    mode = args[0] if args else "all"

    if DRY_RUN:
        print("=" * 60)
        print("DRY RUN MODU — hiçbir yere yazılmıyor")
        print("=" * 60)

    if mode == "regenerate":
        step_regenerate(args[1:])
        return
    if mode in ("generate", "all"):
        step_generate()
    if mode in ("publish", "all"):
        step_publish()


if __name__ == "__main__":
    main()
