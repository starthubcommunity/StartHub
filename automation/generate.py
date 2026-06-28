"""
generate.py — Filtrelenen haberi Gemini Flash'e gönderip Start-Hub formatında
Türkçe makale üretir.

Çıktı: config.SYSTEM_PROMPT'taki JSON şeması:
    {title, slug, summary, content, category, source_url, source_name, tags, uygunluk_skoru}

Yerel test (hiçbir yere yazmaz):
    python automation/generate.py --dry-run
    python automation/generate.py --dry-run --title "Başlık" --summary "Özet"
"""
import argparse
import json
import re
import google.generativeai as genai
from slugify import slugify
from config import GEMINI_API_KEY, GEMINI_MODEL, SYSTEM_PROMPT, DAILY_LIMIT, SUPABASE_URL, SUPABASE_SERVICE_KEY

genai.configure(api_key=GEMINI_API_KEY)

# ---- Ton seviyeleri (Supabase site_settings.tone_level'a karşılık gelir) ----
TONE_INSTRUCTIONS = {
    1: "Ton: Resmi haber dili kullan. Tamamen nesnel ve olgusal ol; abartılı sıfatlar, duygusal ifadeler ve yorum içeren cümlelerden kaçın. Yalnızca doğrulanabilir rakamlara ve olgulara dayan.",
    2: "Ton: Net ve bilgilendirici bir dil kullan. Teknik terimleri kısaca açıkla, gereksiz sözcüklerden kaçın. Okuyucuyu bilinçlendirmeyi öncelikle hedefle.",
    3: "Ton: Samimi ama profesyonel bir üslup benimse. Okuyucuyla doğal bir dilde konuş; Türk girişim ekosistemine somut, özgün bağlantılar kur.",
    4: "Ton: Sıcak ve kapsayıcı bir topluluk dili kullan. Okuyucuyu girişim topluluğunun aktif bir parçası olarak hissettir; ilham verici ve somut örneklere yer ver.",
    5: "Ton: Coşkulu ve motive edici bir üslup benimse. Heyecan verici gelişmeleri öne çıkar, girişimcileri harekete geçmeye ilham ver. Enerjik ol ama her iddia olgusal temele dayansın.",
}

_cached_tone_level: int | None = None


def fetch_tone_level() -> int:
    """
    Supabase site_settings tablosundan tone_level değerini çeker.
    SUPABASE_URL veya SUPABASE_SERVICE_KEY eksikse ya da hata oluşursa
    varsayılan 3 (Dengeli Samimi) döner. Run başına bir kez çağrılır.
    """
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
        level = int(result.data.get("tone_level", 3))
        level = max(1, min(5, level))
        _cached_tone_level = level
        print(f"[bilgi] Ton seviyesi: {level} ({TONE_INSTRUCTIONS[level][:50]}…)")
        return level
    except Exception as e:
        print(f"[uyarı] tone_level alınamadı, varsayılan 3: {e}")
        _cached_tone_level = 3
        return 3


def _build_system_prompt() -> str:
    """SYSTEM_PROMPT'taki {TONE_INSTRUCTION} yer tutucusunu aktif ton talimatıyla doldurur."""
    tone = fetch_tone_level()
    instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS[3])
    return SYSTEM_PROMPT.replace("{TONE_INSTRUCTION}", instruction)


# ---- İlgi puanlaması için ayrı, kısa bir sistem talimatı.
SCORE_PROMPT = (
    "Sen Start-Hub için haber seçen bir editör yardımcısısın. Start-Hub, Türkiye'deki "
    "girişimcilere yönelik bir haber ve analiz platformudur. Sana verilen haberin "
    "Türk girişim ekosistemi için ne kadar ilgi çekici olduğunu 0-100 arası bir tam "
    "sayı ile puanla. Yüksek puan = girişimcilere daha değerli. SADECE şu JSON'u ver: "
    '{"score": <0-100 tam sayı>}'
)


def _extract_json(text: str) -> dict:
    """Modelin döndürdüğü metinden ilk JSON bloğunu güvenle ayıkla."""
    # ```json ... ``` çitlerini temizle
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Gemini çıktısında JSON bulunamadı:\n" + text[:500])
    return json.loads(text[start:end + 1])


def score_item(item: dict) -> int:
    """
    Tek bir haberi Gemini'ye gönderip 0-100 arası 'ilgi puanı' alır.
    Hata durumunda 0 döner (sıralamada en sona düşer).
    """
    user_prompt = (
        f"Başlık: {item['title']}\n"
        f"Özet: {item['summary']}\n"
        f"Kaynak: {item['source_name']}\n\n"
        "Bu haberi Türk girişim ekosistemi için puanla."
    )
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=SCORE_PROMPT)
    try:
        resp = model.generate_content(user_prompt)
        data = _extract_json(resp.text)
        score = int(data.get("score", 0))
        return max(0, min(100, score))
    except Exception as e:  # pragma: no cover
        print(f"[uyarı] puanlama başarısız: {item['title']} — {e}")
        return 0


def rank_and_select(items: list[dict], limit: int = DAILY_LIMIT) -> list[dict]:
    """
    Tüm haberleri Gemini ile puanlar, en yüksek 'limit' kadarını döndürür.
    Dönüş öğelerine 'interest_score' alanı eklenir (yüksekten düşüğe sıralı).
    """
    scored = []
    for it in items:
        it = {**it, "interest_score": score_item(it)}
        scored.append(it)
    scored.sort(key=lambda x: x["interest_score"], reverse=True)
    selected = scored[:limit]
    print(f"[bilgi] {len(items)} haber puanlandı; en yüksek {len(selected)} tanesi seçildi "
          f"(puanlar: {[s['interest_score'] for s in selected]}).")
    return selected


def generate_article(item: dict) -> dict | None:
    """
    item: sources.fetch_filtered() çıktısından bir haber.
    Dönüş: yayına hazır makale sözlüğü ya da hata durumunda None.
    """
    user_prompt = (
        f"Kaynak başlık: {item['title']}\n"
        f"Kaynak özet: {item['summary']}\n"
        f"Kaynak link: {item['link']}\n"
        f"Kaynak adı: {item['source_name']}\n\n"
        "Yukarıdaki haberi Start-Hub editör üslubuyla yeniden yaz ve JSON üret."
    )
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=_build_system_prompt())

    try:
        resp = model.generate_content(user_prompt)
        data = _extract_json(resp.text)
    except Exception as e:  # pragma: no cover
        print(f"[hata] Gemini üretimi başarısız: {item['title']} — {e}")
        return None

    # Güvenlik ağı: eksik alanları kaynaktan tamamla
    data["slug"]       = slugify(data.get("slug") or data.get("title_tr", "yazi"))
    data.setdefault("source_url", item["link"])
    data.setdefault("source",     item["source_name"])
    data.setdefault("tag",        "gundem")
    if data.get("tag") not in ("gundem", "blog", "etkinlik"):
        data["tag"] = "gundem"
    if data.get("category") not in ("AI", "Girişim", "Teknoloji", "Yatırım"):
        data["category"] = "Teknoloji"

    # body_tr her zaman liste olsun
    body = data.get("body_tr")
    if isinstance(body, str):
        data["body_tr"] = [p.strip() for p in body.split("\n\n") if p.strip()]
    elif not isinstance(body, list):
        data["body_tr"] = []

    # Uygunluk filtresi: 7'nin altındaki haberler Google Sheets'e yazılmaz
    uygunluk = int(data.get("uygunluk_skoru", 10))
    if uygunluk < 7:
        print(f"[bilgi] düşük uygunluk ({uygunluk}/10), atlandı: {data.get('title_tr', item['title'])}")
        return None

    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start-Hub makale üretici — dry-run testi")
    parser.add_argument("--dry-run", action="store_true", default=True,
                        help="Sadece terminale yaz, hiçbir yere kaydetme (varsayılan: açık)")
    parser.add_argument("--title",   default="Anthropic announces next-gen Claude model",
                        help="Test haberi başlığı")
    parser.add_argument("--summary", default="New model offers powerful automation for startups.",
                        help="Test haberi özeti")
    parser.add_argument("--source",  default="TechCrunch", help="Kaynak adı")
    parser.add_argument("--link",    default="https://techcrunch.com/example",
                        help="Kaynak URL")
    args = parser.parse_args()

    item = {
        "title":       args.title,
        "summary":     args.summary,
        "link":        args.link,
        "source_name": args.source,
    }

    print("=" * 60)
    print("DRY RUN — Gemini çağrılıyor, hiçbir yere yazılmıyor")
    print(f"Model  : {GEMINI_MODEL}")
    print(f"Başlık : {item['title']} ({item['source_name']})")
    print("=" * 60)

    article = generate_article(item)

    if article is None:
        uygunluk = "(bilinmiyor — generate_article None döndürdü)"
        print("\n[SONUÇ] Bu haber uygunluk_skoru < 7 olduğu için filtrelendi.")
        print("        Google Sheets'e yazılmazdı. ✓")
    else:
        uygunluk = article.get("uygunluk_skoru", "?")
        print(f"\n[SONUÇ] Uygunluk skoru: {uygunluk}/10 — filtreden geçti ✓")
        print("        Gerçek çalışmada Google Sheets'e draft olarak eklenirdi.")
        print("\n--- Üretilen makale (JSON) ---")
        print(json.dumps(article, ensure_ascii=False, indent=2))
