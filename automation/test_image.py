"""
test_image.py — SADECE görsel işleme adımlarını test eder: indirme, boyut
ölçme, dominant renk çıkarma, crop/letterbox kararı, yerel WebP kaydı.

Bu script:
  - Gemini çağırmaz
  - RSS çekmez
  - Veritabanına yazı eklemez
  - Supabase'e bağlanmaz (yalnızca .env'de SUPABASE_URL tanımlı mı bakar)

İşlenmiş görseller Supabase Storage'a DEĞİL, automation/test_output/
klasörüne yerel olarak kaydedilir.

Kullanım:
    python automation/test_image.py
"""
import os
import sys
from io import BytesIO

import requests
from PIL import Image
from dotenv import load_dotenv

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

_COVER_W, _COVER_H = 1200, 630
_MIN_WIDTH = 800
_TIMEOUT = 8
_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "test_output")

TEST_IMAGES = [
    {
        "slug": "test-yatay",
        "url": "https://picsum.photos/id/1015/1600/900",
        "beklenen_oran": "yatay 16:9",
    },
    {
        "slug": "test-kare",
        "url": "https://picsum.photos/id/1025/1000/1000",
        "beklenen_oran": "kare 1:1",
    },
    {
        "slug": "test-kucuk",
        "url": "https://picsum.photos/id/1005/400/300",
        "beklenen_oran": "kucuk - kullanilmamali",
    },
]


def _dominant_color(img: Image.Image) -> str:
    """Görselin 50x50'ye küçültülmüş halinden ortalama (dominant) rengi hex olarak döner."""
    tiny = img.resize((50, 50), Image.LANCZOS)
    pixels = list(tiny.getdata())
    r = sum(p[0] for p in pixels) // len(pixels)
    g = sum(p[1] for p in pixels) // len(pixels)
    b = sum(p[2] for p in pixels) // len(pixels)
    return f"#{r:02x}{g:02x}{b:02x}"


def _crop(img: Image.Image, width: int, height: int) -> Image.Image:
    """Yatay görsel — 1200x630'a merkezden kırp."""
    target_ratio = _COVER_W / _COVER_H
    img_ratio = width / height
    if img_ratio > target_ratio:
        new_h = height
        new_w = int(height * target_ratio)
    else:
        new_w = width
        new_h = int(width / target_ratio)
    left = (width - new_w) // 2
    top = (height - new_h) // 2
    return img.crop((left, top, left + new_w, top + new_h)).resize((_COVER_W, _COVER_H), Image.LANCZOS)


def _letterbox(img: Image.Image, width: int, height: int, dominant_hex: str) -> Image.Image:
    """Kare/dikey görsel — dominant renkli canvas'a ortalayarak oturt."""
    target_ratio = _COVER_W / _COVER_H
    img_ratio = width / height
    rgb = tuple(int(dominant_hex[i:i + 2], 16) for i in (1, 3, 5))
    canvas = Image.new("RGB", (_COVER_W, _COVER_H), rgb)
    if img_ratio > target_ratio:
        new_w = _COVER_W
        new_h = int(_COVER_W / img_ratio)
    else:
        new_h = _COVER_H
        new_w = int(_COVER_H * img_ratio)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas.paste(resized, ((_COVER_W - new_w) // 2, (_COVER_H - new_h) // 2))
    return canvas


def run_test(case: dict) -> None:
    slug = case["slug"]
    url = case["url"]
    label = case["beklenen_oran"]

    print("=" * 60)
    print(f"TEST: {slug} (beklenen: {label})")
    print("-" * 60)

    try:
        resp = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        print(f"Hata     : Görsel indirilemedi/açılamadı — {e}")
        print("=" * 60)
        return

    os.makedirs(_OUTPUT_DIR, exist_ok=True)

    width, height = img.size
    aspect_ratio = round(width / height, 2)
    orientation = "YATAY" if aspect_ratio >= 1.2 else "KARE/DİKEY"
    next_step = "cover crop uygulanacak" if aspect_ratio >= 1.2 else "letterbox uygulanacak"
    print(f"Boyut    : {width} x {height} px")
    print(f"Oran     : {aspect_ratio} → {orientation} ({next_step})")

    dominant_hex = _dominant_color(img)
    print(f"Dominant : {dominant_hex}")

    if width < _MIN_WIDTH:
        print(f"Karar    : ✗ ATLANACAK → görsel çok küçük ({width}px < {_MIN_WIDTH}px eşiği)")
        out_path = os.path.join(_OUTPUT_DIR, f"{slug}-ATLANACAK.txt")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(
                f"slug={slug}\nurl={url}\nwidth={width}\nheight={height}\n"
                f"aspect_ratio={aspect_ratio}\ndominant={dominant_hex}\n"
                f"karar=ATLANACAK (width < {_MIN_WIDTH}px)\n"
            )
        print(f"           → {out_path}")
        print("=" * 60)
        return

    if aspect_ratio >= 1.2:
        final = _crop(img, width, height)
        mode = "crop"
    else:
        final = _letterbox(img, width, height, dominant_hex)
        mode = "letterbox + dominant renk"

    out_path = os.path.join(_OUTPUT_DIR, f"{slug}.webp")
    final.save(out_path, format="WEBP", quality=85)
    print(f"Karar    : ✓ KULLANILACAK → {mode} + WebP kaydedildi")
    print(f"           → {out_path} ({final.size[0]}x{final.size[1]})")
    print("=" * 60)


def check_env() -> None:
    """SUPABASE_URL .env'de tanımlı mı — bağlantı KURULMAZ, sadece bilgi amaçlı."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    if supabase_url:
        print(f"[bilgi] SUPABASE_URL tanımlı ({supabase_url[:30]}…) — bu script bağlantı kurmuyor.")
    else:
        print("[uyarı] SUPABASE_URL tanımlı değil (.env eksik olabilir) — bu script yine de çalışır.")


if __name__ == "__main__":
    check_env()
    print()
    for case in TEST_IMAGES:
        run_test(case)
