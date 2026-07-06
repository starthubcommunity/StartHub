"""
run.py — Orkestratör. GitHub Actions cron (her saat) / workflow_dispatch ile tetiklenir.

Başlangıç kontrolleri (sırayla):
  0a. Supabase'den ayarları oku
  0b. automation_enabled=False → sessizce çık
  0c. Şu anki UTC saati preferred_run_hours listesinde yoksa çık (--ignore-hour ile atlanır)

Akış:
  1. RSS tara + filtre + tekrar koruması       (sources.fetch_filtered)
  2. Saf Python puanla + en yüksek N seç       (sources.select_top)
  3. Gemini ile makale üret                    (generate.generate_article)
  4. Supabase'e yaz:
       auto_publish=True  → status='published' (onay gerekmez)
       auto_publish=False → status='draft'     (admin paneli bekler)
  5. enabled_categories filtresi uygula
  6. automation_logs'a çalışma kaydı at

Modlar : all | generate | regenerate <slug...>
Bayraklar:
  --dry-run      → hiçbir yere yazılmaz
  --ignore-hour  → preferred_run_hours kontrolünü atla
"""
import sys
import datetime

# Windows konsolu genelde UTF-8 değildir (cp1252) ve kod tabanındaki ok/kutu
# çizim karakterleri (←, ═, vb.) print() sırasında UnicodeEncodeError fırlatabilir.
# Bu, gerçek işlem (ör. Supabase INSERT) başarılı olsa bile "başarısız" gibi
# raporlanmasına yol açar — bu yüzden stdout/stderr'i baştan UTF-8'e sabitliyoruz.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from config import DAILY_LIMIT, SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client
import sources
import generate
import publish

DRY_RUN     = "--dry-run"     in sys.argv
IGNORE_HOUR = "--ignore-hour" in sys.argv
ARGS = [a for a in sys.argv[1:] if a not in ("--dry-run", "--ignore-hour")]

_sb = None


def _client():
    global _sb
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _sb


def _read_settings() -> dict:
    """Supabase site_settings'den tüm otomasyon ayarlarını okur."""
    defaults = {
        "automation_enabled":      True,
        "auto_publish":            False,
        "preferred_run_hours":     [5],
        "enabled_categories":      [],
        "tone_level":              3,
        "tone_extra_instructions": {},
        "tone_banned_phrases":     [],
    }
    try:
        # select("*") kullanılır: tek tek kolon adı listelemek, ileride eklenecek/eksik
        # bir kolon yüzünden (PostgREST tüm sorguyu reddeder) TÜM ayarların sessizce
        # varsayılana düşmesine yol açabiliyor. "*" bu riski tamamen ortadan kaldırır.
        row = (_client()
               .table("site_settings")
               .select("*")
               .eq("id", 1)
               .single()
               .execute()
               .data or {})
        raw_hours = row.get("preferred_run_hours")
        if isinstance(raw_hours, list) and raw_hours:
            preferred_hours = sorted({int(h) for h in raw_hours})
        else:
            preferred_hours = [int(row.get("preferred_run_hour", 5))]
        return {
            "automation_enabled":      bool(row.get("automation_enabled", True)),
            "auto_publish":            bool(row.get("auto_publish", False)),
            "preferred_run_hours":     preferred_hours,
            "enabled_categories":      row.get("enabled_categories") or [],
            "tone_level":              int(row.get("tone_level", 3)),
            "tone_extra_instructions": row.get("tone_extra_instructions") or {},
            "tone_banned_phrases":     row.get("tone_banned_phrases") or [],
        }
    except Exception as e:
        print(f"[uyarı] Supabase ayarları okunamadı, varsayılanlar: {e}")
        return defaults


def _log_run(found: int, filtered: int, draft_count: int,
             error: str | None = None) -> None:
    if DRY_RUN:
        return
    try:
        _client().table("automation_logs").insert({
            "found_count":    found,
            "filtered_count": filtered,
            "draft_count":    draft_count,
            "error_text":     error,
        }).execute()
        print(f"[log] automation_logs ← found={found} filtered={filtered} drafts={draft_count}")
    except Exception as e:
        print(f"[uyarı] Çalışma logu yazılamadı: {e}")


def step_generate(settings: dict) -> tuple[int, int, int]:
    """
    Dönüş: (found_count, filtered_count, draft_count)
    """
    auto_publish       = settings["auto_publish"]
    enabled_categories = settings["enabled_categories"]

    items, meta = sources.fetch_filtered()
    found_count    = meta["found"]
    filtered_count = meta["skipped_seen"] + meta["skipped_blocked"]

    if not items:
        print("[bilgi] İşlenecek yeni haber yok.")
        return found_count, filtered_count, 0

    top_items = sources.select_top(
        items, DAILY_LIMIT,
        kws=meta["kws"],
        src_weights=meta["src_weights"],
    )

    produced    = 0
    seen_slugs  = set()
    processed   = []

    for item in top_items:
        article = generate.generate_article(item, tone_settings=settings)
        if not article or article["slug"] in seen_slugs:
            continue

        # Kategori filtresi (enabled_categories boşsa tümünü kabul et)
        if enabled_categories and article.get("category") not in enabled_categories:
            print(f"[filtre] Kategori devre dışı ({article.get('category')}), atlandı: {article['slug']}")
            continue

        seen_slugs.add(article["slug"])
        publish.publish_article(article, dry_run=DRY_RUN, auto_publish=auto_publish)
        processed.append(item)
        produced += 1

    if not DRY_RUN:
        sources.mark_seen(processed)

    status_word = "published" if auto_publish else "draft"
    print(f"[özet] {produced} makale "
          f"{'önizlendi (dry-run)' if DRY_RUN else f'Supabase posts ← {status_word}'} "
          f"(limit {DAILY_LIMIT}).")
    return found_count, filtered_count, produced


def step_regenerate(slugs: list[str], settings: dict) -> None:
    """Verilen slug'lar için Gemini'yi yeniden çağırır, taslakları günceller."""
    if not slugs:
        print("[uyarı] regenerate için slug verilmedi.")
        return
    regenerated = 0
    for slug in slugs:
        row = publish.get_draft_by_slug(slug)
        if not row:
            print(f"[uyarı] taslak Supabase'de bulunamadı (status=draft): {slug}")
            continue
        item = {
            "title":       row.get("title_tr", ""),
            "summary":     row.get("excerpt_tr", ""),
            "link":        row.get("source_url", ""),
            "source_name": row.get("source", ""),
        }
        article = generate.generate_article(item, tone_settings=settings)
        if not article:
            continue
        article["slug"] = slug
        result = publish.update_article(slug, article, dry_run=DRY_RUN)
        if result is not None or DRY_RUN:
            regenerated += 1
    print(f"[özet] {regenerated} taslak yeniden üretildi.")


def main():
    if DRY_RUN:
        print("=" * 50)
        print("DRY RUN — hiçbir yere yazılmıyor")
        print("=" * 50)

    # 0a. Ayarları oku
    settings = _read_settings()

    mode = ARGS[0] if ARGS else "all"

    if mode == "regenerate":
        step_regenerate(ARGS[1:], settings)
        return

    # 0b. Otomasyon açık mı?
    if not settings["automation_enabled"]:
        print("[bilgi] Otomasyon kapalı (automation_enabled=false). Çıkılıyor.")
        _log_run(0, 0, 0, "Otomasyon kapalı")
        return

    # 0c. Tercih edilen saat(ler) kontrolü
    if not DRY_RUN and not IGNORE_HOUR:
        current_hour = datetime.datetime.now(datetime.timezone.utc).hour
        preferred    = settings["preferred_run_hours"]
        if current_hour not in preferred:
            preferred_str = ", ".join(f"{h:02d}:00" for h in preferred)
            msg = f"Saat eşleşmedi: beklenen saatler [{preferred_str}] UTC, şu an {current_hour:02d}:00 UTC"
            print(f"[bilgi] {msg}. Çıkılıyor.")
            _log_run(0, 0, 0, msg)
            return

    if mode in ("generate", "all"):
        # 30 günden eski seen_url kayıtlarını temizle
        sources.cleanup_old_seen(days=30)

        found = filtered = drafted = 0
        error_text = None
        try:
            found, filtered, drafted = step_generate(settings)
        except Exception as e:
            error_text = str(e)
            print(f"[hata] step_generate: {e}")
        _log_run(found, filtered, drafted, error_text)


if __name__ == "__main__":
    main()
