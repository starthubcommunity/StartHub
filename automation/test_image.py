"""
test_image.py — publish.py'deki görsel işleme mantığını (indirme, ölçme,
dominant renk, kırpma/letterbox) örnek görsel URL'leriyle test eder.

Supabase Storage'a yükleme YAPILMAZ (dry_run=True). Sadece terminale
aspect_ratio, dominant renk ve hangi modun (crop/letterbox) seçildiğini yazar.

Kullanım:
    python automation/test_image.py
"""
import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import publish

# (etiket, görsel URL'i) — yatay, dikey ve çok küçük bir örnek
SAMPLES = [
    ("Yatay (crop bekleniyor)",        "https://picsum.photos/id/1015/1600/900"),
    ("Dikey (letterbox bekleniyor)",   "https://picsum.photos/id/1025/800/1200"),
    ("Çok küçük (kullanılmamalı)",     "https://picsum.photos/id/1005/400/300"),
    ("Bozuk URL (None dönmeli)",       "https://this-domain-does-not-exist-xyz123.invalid/img.jpg"),
]

if __name__ == "__main__":
    for label, url in SAMPLES:
        print("=" * 60)
        print(f"{label}\n  {url}")
        image_url, aspect_ratio, bg = publish._prepare_image(
            url, "test-slug", fallback_bg="var(--blue-light)", dry_run=True)
        print(f"  → image_url={image_url}  aspect_ratio={aspect_ratio}  bg={bg}")
    print("=" * 60)
