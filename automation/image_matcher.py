"""
image_matcher.py — Üretilen makaleye Supabase image_stock tablosundan en
uygun stok görseli seçer. RSS/kaynak sayfasından görsel indirme YOK —
görseller önceden admin panelinden (Otomasyon → Görsel Stoğu) yüklenmiş
kalite kontrollü bir havuzdan seçilir.

Puanlama (basit, saf Python — ML/embedding yok):
  - Kategori eşleşmesi (article['category'] ↔ image['category'])  → +10
  - Her eşleşen etiket (başlık+özet metninde geçiyorsa)            → +3
  - Çeşitlilik bonusu: az kullanılmış görsele küçük bir öncelik    → +0..2

Skor eşitse usage_count düşük olan kazanır. image_stock tablosu boş
değilse hiçbir zaman None dönmez — en azından en az kullanılan görsel
seçilir (skorlar sıfır olsa bile).
"""

# Gemini'nin article'a atadığı kategori adları (AI/Girişim/Teknoloji/Yatırım —
# bkz. generate.py SYSTEM_PROMPT) ile image_stock'ta admin panelinden seçilen
# kategori adları farklı sözlükler kullanıyor. Eşleştirme için karşılık tablosu.
CATEGORY_ALIAS = {
    "AI":      "Yapay Zeka",
    "Yatırım": "Fon",
}

_TR_MAP = str.maketrans({
    "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
    "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c",
})


def _normalize(text: str) -> str:
    """Küçük harfe çevirir, Türkçe karakterleri ASCII karşılıklarına indirger."""
    return (text or "").translate(_TR_MAP).lower()


def _score(article_text: str, article_category: str, image: dict, max_usage: int) -> float:
    score = 0.0

    img_category = image.get("category") or ""
    if img_category and (img_category == article_category
                          or img_category == CATEGORY_ALIAS.get(article_category)):
        score += 10

    for tag in image.get("tags") or []:
        if tag and _normalize(tag) in article_text:
            score += 3

    usage = image.get("usage_count") or 0
    score += 2 * (1 - (usage / max_usage)) if max_usage > 0 else 2

    return score


def find_best_image(article: dict, supabase_client, dry_run: bool = False) -> dict | None:
    """
    article: generate.py çıktısı — en azından title_tr/excerpt_tr/category okunur.
    dry_run=True  → usage_count güncellenmez, sadece seçilen görsel döner (test için).

    Dönüş: {"url": ..., "alt_tr": ...} ya da image_stock tablosu boşsa None.
    Herhangi bir adımda hata olursa (Supabase okunamadı vb.) None döner —
    asla exception fırlatmaz, görselsiz yayın engellenmemeli.
    """
    try:
        rows = supabase_client.table("image_stock").select("*").execute().data or []
    except Exception as e:
        print(f"[uyarı] image_stock okunamadı: {e}")
        return None

    if not rows:
        print("[uyarı] image_stock tablosu boş — görsel atanamadı.")
        return None

    text = _normalize((article.get("title_tr") or "") + " " + (article.get("excerpt_tr") or ""))
    category = article.get("category") or ""
    max_usage = max((r.get("usage_count") or 0) for r in rows)

    scored = sorted(
        rows,
        key=lambda r: (-_score(text, category, r, max_usage), r.get("usage_count") or 0),
    )
    best = scored[0]
    best_score = _score(text, category, best, max_usage)
    print(f"[bilgi] Görsel seçildi: id={best.get('id')} kategori={best.get('category')} "
          f"skor={best_score:.1f} usage_count={best.get('usage_count') or 0}")

    if not dry_run:
        try:
            supabase_client.table("image_stock").update(
                {"usage_count": (best.get("usage_count") or 0) + 1}
            ).eq("id", best["id"]).execute()
        except Exception as e:
            print(f"[uyarı] usage_count güncellenemedi: {e}")

    return {"url": best["url"], "alt_tr": best.get("alt_tr") or ""}
