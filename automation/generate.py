"""
generate.py — Seçilen haberi Gemini Flash'e gönderip Start-Hub formatında
Türkçe makale üretir. Puanlama/seçim tamamen sources.select_top() tarafından
saf Python ile yapılır; Gemini SADECE makale yazımı için kullanılır.

Günlük Gemini kullanımı: 2 makale üretimi = 2 istek (free tier: 20 istek/gün).

Yerel test:
    python automation/generate.py --dry-run
    python automation/generate.py --dry-run --title "Başlık" --summary "Özet"
"""
import argparse
import json
import re
import time
import google.generativeai as genai
from slugify import slugify
from config import GEMINI_API_KEY, GEMINI_MODEL, SYSTEM_PROMPT, DAILY_LIMIT, SUPABASE_URL, SUPABASE_SERVICE_KEY

genai.configure(api_key=GEMINI_API_KEY)

_RETRY_WAIT_DEFAULT = 35  # 429 sonrası varsayılan bekleme (saniye)
_MAX_RETRIES        = 3


def _call_with_retry(model, prompt: str):
    """Gemini çağrısı — 429 rate limit hatasında önerilen süre kadar bekle, yeniden dene."""
    for attempt in range(_MAX_RETRIES):
        try:
            return model.generate_content(prompt)
        except Exception as exc:
            err = str(exc)
            if "429" not in err or attempt >= _MAX_RETRIES - 1:
                raise
            m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", err)
            wait = int(m.group(1)) + 2 if m else _RETRY_WAIT_DEFAULT
            print(f"[bilgi] Rate limit — {wait}s bekleniyor (deneme {attempt + 1}/{_MAX_RETRIES})…")
            time.sleep(wait)


# ---- Ton seviyeleri ----
# Not: Tüm seviyeler bilgi/analiz odaklı — "blog"/topluluk sohbeti üslubuna
# kaymasınlar diye kasıtlı olarak motive edici/coşkulu dil içermiyor. Fark
# eden şey resmiyet derecesi ve analiz derinliği, "samimiyet" değil.
TONE_INSTRUCTIONS = {
    1: "Ton: Resmi haber dili kullan. Tamamen nesnel ve olgusal ol; abartılı sıfatlar, duygusal ifadeler ve yorum içeren cümlelerden kaçın. Yalnızca doğrulanabilir rakamlara ve olgulara dayan.",
    2: "Ton: Net ve bilgilendirici bir dil kullan. Teknik terimleri kısaca açıkla, gereksiz sözcüklerden kaçın. Okuyucuyu bilinçlendirmeyi öncelikle hedefle.",
    3: "Ton: Açık ve bilgi yoğun bir analiz dili kullan. Sohbet havasından kaçın; her paragraf yeni bir veri, mekanizma veya karşılaştırma taşısın. Türk girişim ekosistemine somut, özgün bağlantılar kur.",
    4: "Ton: Uzman düzeyinde derinlemesine analiz yap. Gelişmeyi izole bir haber gibi değil, daha geniş bir trend/mekanizma içinde açıkla; sayısal karşılaştırmalar ve nedensellik zincirleri kullan.",
    5: "Ton: En yüksek bilgi yoğunluğu seviyesi. Konuyu uzman bir analist gibi katmanlı şekilde işle — arka plan, mekanizma, sonuç ve çıkarım sırasıyla verilsin. Coşku veya motivasyon dili değil, keskin ve yoğun bir içgörü hedefle; okuyucu 'bunu bilmiyordum' desin.",
}

_cached_tone_level: int | None = None


def fetch_tone_level() -> int:
    """Supabase site_settings tablosundan tone_level çeker; hata/eksikse varsayılan 3."""
    global _cached_tone_level
    if _cached_tone_level is not None:
        return _cached_tone_level
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("[bilgi] Supabase credentials yok, ton seviyesi varsayılan 3.")
        _cached_tone_level = 3
        return 3
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        result = client.table("site_settings").select("tone_level").single().execute()
        level = max(1, min(5, int(result.data.get("tone_level", 3))))
        _cached_tone_level = level
        print(f"[bilgi] Ton seviyesi: {level} ({TONE_INSTRUCTIONS[level][:50]}…)")
        return level
    except Exception as e:
        print(f"[uyarı] tone_level alınamadı, varsayılan 3: {e}")
        _cached_tone_level = 3
        return 3


def _build_system_prompt(tone_settings: dict | None = None) -> str:
    if tone_settings:
        tone = int(tone_settings.get("tone_level", 3))
        extra = (tone_settings.get("tone_extra_instructions") or {}).get(str(tone), "")
        banned = tone_settings.get("tone_banned_phrases") or []
    else:
        tone = fetch_tone_level()
        extra = ""
        banned = []

    prompt = SYSTEM_PROMPT.replace("{TONE_INSTRUCTION}", TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS[3]))
    if extra:
        prompt += f"\n\nEk ton talimatları (bu seviye için): {extra}"
    if banned:
        prompt += f"\n\nYasaklı ifadeler — bunları kesinlikle kullanma: {', '.join(banned)}"
    return prompt


def _extract_json(text: str) -> dict:
    """Modelin döndürdüğü metinden ilk JSON bloğunu güvenle ayıkla."""
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Gemini çıktısında JSON bulunamadı:\n" + text[:500])
    return json.loads(text[start:end + 1])


def generate_article(item: dict, tone_settings: dict | None = None) -> dict | None:
    """
    item: sources.fetch_filtered() çıktısından bir haber sözlüğü.
    Dönüş: yayına hazır makale sözlüğü ya da hata/düşük uygunluk durumunda None.
    """
    user_prompt = (
        f"Kaynak başlık: {item['title']}\n"
        f"Kaynak özet: {item['summary']}\n"
        f"Kaynak link: {item['link']}\n"
        f"Kaynak adı: {item['source_name']}\n\n"
        "Yukarıdaki haberi Start-Hub editör üslubuyla yeniden yaz ve JSON üret."
    )
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=_build_system_prompt(tone_settings))

    try:
        resp = _call_with_retry(model, user_prompt)
        data = _extract_json(resp.text)
    except Exception as e:
        print(f"[hata] Gemini üretimi başarısız: {item['title']} — {e}")
        return None

    data["slug"]       = slugify(data.get("slug") or data.get("title_tr", "yazi"))
    data.setdefault("source_url", item["link"])
    data.setdefault("source",     item["source_name"])
    data.setdefault("tag",        "gundem")
    if data.get("tag") not in ("gundem", "blog", "etkinlik"):
        data["tag"] = "gundem"
    if data.get("category") not in ("AI", "Girişim", "Teknoloji", "Yatırım"):
        data["category"] = "Teknoloji"

    body = data.get("body_tr")
    if isinstance(body, str):
        data["body_tr"] = [p.strip() for p in body.split("\n\n") if p.strip()]
    elif not isinstance(body, list):
        data["body_tr"] = []

    body_en = data.get("body_en")
    if isinstance(body_en, str):
        data["body_en"] = [p.strip() for p in body_en.split("\n\n") if p.strip()]
    elif not isinstance(body_en, list):
        data["body_en"] = []

    uygunluk = int(data.get("uygunluk_skoru", 10))
    if uygunluk < 7:
        print(f"[bilgi] düşük uygunluk ({uygunluk}/10), atlandı: {data.get('title_tr', item['title'])}")
        return None

    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start-Hub makale üretici — dry-run testi")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--title",   default="Anthropic announces next-gen Claude model")
    parser.add_argument("--summary", default="New model offers powerful automation for startups.")
    parser.add_argument("--source",  default="TechCrunch")
    parser.add_argument("--link",    default="https://techcrunch.com/example")
    args = parser.parse_args()

    item = {"title": args.title, "summary": args.summary,
            "link": args.link, "source_name": args.source}

    print("=" * 60)
    print("DRY RUN — Gemini çağrılıyor, hiçbir yere yazılmıyor")
    print(f"Model  : {GEMINI_MODEL}")
    print(f"Başlık : {item['title']} ({item['source_name']})")
    print("=" * 60)

    article = generate_article(item)
    if article is None:
        print("\n[SONUÇ] Bu haber uygunluk_skoru < 7 olduğu için filtrelendi.")
    else:
        print(f"\n[SONUÇ] Uygunluk skoru: {article.get('uygunluk_skoru', '?')}/10 — filtreden geçti ✓")
        print("\n--- Üretilen makale (JSON) ---")
        print(json.dumps(article, ensure_ascii=False, indent=2))
