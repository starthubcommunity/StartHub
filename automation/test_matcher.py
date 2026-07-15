"""
test_matcher.py — image_matcher.find_best_image() işlevini örnek makale
dict'leriyle test eder. Her aday görsel için skoru, seçilen görseli ve
usage_count'unu terminale yazdırır.

ÖNEMLİ: Supabase'de image_stock tablosunda EN AZ 1 kayıt olması gerekir
(admin panel → Otomasyon → Görsel Stoğu → Görsel Ekle). Tablo boşsa script
bunu bildirip çıkar.

dry_run=True kullanılır — gerçek usage_count Supabase'de güncellenmez.

Kullanım:
    python automation/test_matcher.py
"""
import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
import image_matcher as im

ARTICLES = [
    {
        "title_tr": "Girişimler İçin Yeni Bir Nefes: Float, Gelire Dayalı Finansmanla 4.5 Milyon Euro Yatırım Aldı",
        "excerpt_tr": "Float, girişimlere gelire dayalı finansman sağlayan bir fintech şirketi olarak 4.5 milyon euro yatırım turunu tamamladı.",
        "category": "Yatırım",
    },
    {
        "title_tr": "Yapay Zeka Destekli Video Üretiminde Rekor Yatırım",
        "excerpt_tr": "PixVerse, yapay zeka ile video üretim teknolojisi geliştiren bir girişim, büyük bir yatırım turu duyurdu.",
        "category": "AI",
    },
    {
        "title_tr": "İki Teknoloji Devi Stratejik Ortaklık Duyurdu",
        "excerpt_tr": "Şirketler, yapay zeka altyapısını birlikte geliştirmek için el sıkıştı ve anlaşma imzaladı.",
        "category": "Teknoloji",
    },
]


def main():
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    rows = client.table("image_stock").select("*").execute().data or []
    if not rows:
        print("[uyarı] image_stock tablosu boş. Test için admin panelden "
              "(Otomasyon → Görsel Stoğu) en az 1 görsel ekleyin, sonra tekrar çalıştırın.")
        return

    print(f"[bilgi] image_stock'ta {len(rows)} görsel bulundu.\n")

    for article in ARTICLES:
        print("=" * 60)
        print(f"MAKALE: {article['title_tr'][:60]}")
        print(f"Kategori: {article['category']}")
        print("-" * 60)

        text = im._normalize(article["title_tr"] + " " + article["excerpt_tr"])
        max_usage = max((r.get("usage_count") or 0) for r in rows)
        scored = sorted(
            rows,
            key=lambda r: (-im._score(text, article["category"], r, max_usage), r.get("usage_count") or 0),
        )
        for r in scored:
            s = im._score(text, article["category"], r, max_usage)
            marker = " ← SEÇİLDİ" if r is scored[0] else ""
            print(f"  id={r['id']:<4} kategori={str(r.get('category')):<12} "
                  f"etiketler={r.get('tags')}  skor={s:.1f}  usage={r.get('usage_count') or 0}{marker}")

        match = im.find_best_image(article, client, dry_run=True)
        print(f"\nSonuç: {match}")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
