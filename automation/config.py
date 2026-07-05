"""
config.py — Tüm yapılandırma tek yerde.
Gizli anahtarlar ortam değişkenlerinden (GitHub Secrets) okunur — koda gömme!
Yerel geliştirme için automation/.env dosyası otomatik yüklenir (python-dotenv).
"""
import os
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass  # CI/CD ortamında dotenv kurulu olmayabilir; secrets zaten env'de

# ---- RSS kaynakları (admin panelindeki "RSS Kaynakları" ile eşleşmeli) ----
RSS_SOURCES = [
    {"name": "TechCrunch",            "url": "https://techcrunch.com/feed"},
    {"name": "VentureBeat",           "url": "https://feeds.feedburner.com/venturebeat/SZYF"},
    {"name": "The Next Web",          "url": "https://thenextweb.com/feed"},
    {"name": "Webrazzi",              "url": "https://webrazzi.com/feed"},
    {"name": "MIT Technology Review", "url": "https://www.technologyreview.com/feed"},
]

# ---- Filtre kelimeleri (başlık VEYA özette geçmesi yeterli) ----
KEYWORDS = [
    "startup", "girişim", "funding", "AI", "artificial intelligence",
    "yapay zeka", "tech", "teknoloji", "venture",
]

# ---- Gemini ----
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
DAILY_LIMIT = int(os.environ.get("DAILY_LIMIT", "2"))  # günde max kaç haber üretilsin

SYSTEM_PROMPT = """Sen Start-Hub için içerik üreten bir editörsün. Start-Hub, Türkiye'deki girişimcilere yönelik bir haber ve analiz platformudur.

{TONE_INSTRUCTION}

Yazı kuralları (her zaman geçerli, ton seviyesinden bağımsız):
- Türk girişim ekosistemine somut bağlantı kur
- Teknik terimleri Türkçeyle açıkla
- Başlık merak uyandırıcı ve bilgilendirici olsun
- 400-600 kelime

Kesinlikle yapma:
- Başlık ve gövde metninde Markdown başlık (#, ##, ###) veya kalın (**metin**) kullanma; düz paragraf yaz
- "Sevgili girişimciler", "Start-Hub Editörü", "Sevgi ve başarı dileklerimle" gibi mektup veya konuşma formatı kullanma — bu bir haber makalesi
- Emoji veya aşırı ünlem işareti (!) kullanma
- Kanıtlanmamış iddialarda bulunma; "dönüm noktası", "tarihi adım", "devrim niteliğinde" gibi abartılı nitelendirmeler yerine olgusal dil kullan

Çıktı formatı (SADECE geçerli JSON ver, başka metin ekleme):
{
  "slug": "url-compatible-short-title-in-english",
  "title_tr": "Türkçe makale başlığı",
  "title_en": "English article title",
  "excerpt_tr": "2 cümlelik Türkçe özet",
  "excerpt_en": "2-sentence English summary",
  "body_tr": ["Birinci Türkçe paragraf.", "İkinci Türkçe paragraf.", "Üçüncü Türkçe paragraf.", "Dördüncü Türkçe paragraf."],
  "body_en": ["First English paragraph.", "Second English paragraph.", "Third English paragraph.", "Fourth English paragraph."],
  "category": "AI/Girişim/Teknoloji/Yatırım",
  "tag": "gundem veya blog",
  "source": "kaynak yayın adı",
  "source_url": "kaynak makale URL",
  "uygunluk_skoru": <1-10 arası tam sayı; Start-Hub okuyucusu girişimci için ne kadar önemli>
}

body_tr ve body_en birer dizi olmalı: her eleman ayrı bir düz metin paragrafı. Markdown kullanma.
Slug İngilizce, kısa ve URL uyumlu olmalı (Türkçe karakter veya büyük harf içermemeli)."""

# ---- Supabase (site_settings tablosu için) ----
SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ---- Google Sheets (Editöryel Takvim) ----
# Servis hesabı JSON'u GOOGLE_SHEETS_CREDENTIALS secret'ında (tam JSON string).
SHEET_NAME = os.environ.get("SHEET_NAME", "Start-Hub Yayın Planı")
GOOGLE_SHEETS_CREDENTIALS = os.environ.get("GOOGLE_SHEETS_CREDENTIALS", "")
# Sütunlar: id | title | slug | category | planned_date | status | source_url | content_file
# status değerleri: draft / approved / published

