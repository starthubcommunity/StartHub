# Start-Hub İçerik Otomasyonu

RSS tarama → anahtar kelime filtresi → **Gemini Flash** ile Türkçe içerik üretimi →
**Google Sheets** editöryel takvim (draft → approved → published) → onaylananları
`/posts/[slug].json` olarak repoya yazma. Tümü **GitHub Actions** ile her sabah otomatik.

```
RSS  ──►  filtre  ──►  Gemini  ──►  Google Sheets  ──►  onay  ──►  posts/*.json
(5 kaynak)  (9 kelime)  (taslak)    (Yayın Planı)      (editör)    (+ index.json)
```

---

## ⚠️ Önce şunu oku — dürüst durum

Bu paket **test edilmemiş bir iskelettir**. Tasarım ortamında yazıldı; burada
çalıştırılamadı, gerçek API'lere bağlanmadı. Sen kendi repo'nda kurup secret'ları
bağlayıp çalıştırınca düzeltme gerektirebilir. Kör güven verme — adım adım test et
(`workflow_dispatch` ile elle tetikle, logları izle).

İki ayrı parça var:
1. **Admin panelindeki "İçerik Otomasyonu" sekmesi** — çalışan kontrol yüzeyi
   (ayarlar, RSS listesi, filtre kelimeleri, editöryel takvim, Gemini promptu).
   "Hattı Çalıştır" bir sabah çalışmasını *simüle eder* ve yazıyı sitenin posts
   verisine ekler. Bu kısım canlı ve gerçek.
2. **`automation/` Python hattı + GitHub Actions** — backend iskeleti (bu klasör).
   Asıl RSS çekme ve Gemini çağrıları burada çalışır.

---

## ‼️ Kritik: site şu an JSON OKUMUYOR

Hattı kurmadan önce bunu çözmen gerekiyor, yoksa sistem boşa çalışır.

- Mevcut durumda yazılar `data.jsx` içinde **JS dizisi** (`const posts = [...]`) olarak gömülü.
- Admin paneli değişiklikleri `/posts/*.json` dosyalarına değil, tarayıcının
  **`localStorage`'ına** (`sh_admin_data`) yazıyor.
- Bu otomasyon ise `/posts/[slug].json` + `posts/index.json` üretir.

**Site o dosyaları okuyana kadar** otomasyonun yayınladığı yazılar sitede görünmez.
Geçiş için iki seçenek:

**A) Build-time (önerilen, en basit):** GitHub Actions yazıyı eklerken
`posts/index.json` + `posts/*.json` üretsin; küçük bir script bunları okuyup
`data.jsx`'teki `posts` dizisini yeniden yazsın (ya da bir `posts.generated.js`
üretip `data.jsx` onu import etsin). Site statik kalır, ekstra fetch yok.

**B) Runtime fetch:** `data.jsx` açılışta `fetch('posts/index.json')` ile listeyi,
yazı detayında `fetch('posts/[slug].json')` ile içeriği çeksin. Daha dinamik ama
GitHub Pages'te CORS/yol ayarına dikkat. Mevcut `applyAdminOverrides()` mantığının
yanına bir `applyPublishedPosts()` eklenebilir.

> Hangisini seçersen seç, `publish.py`'deki post şeması
> (`id, slug, title, summary, content, category, source_url, source_name, tags, date, read_time`)
> ile sitenin `posts` öğesi şemasını (`title_tr, excerpt_tr, body_tr, tag, source...`)
> eşlemen gerekir. Şu an bu eşleme YOK — küçük bir dönüştürücü yazmalısın.

---

## Kurulum

### 1. Dosyaları repo'ya koy
```
repo-kök/
├─ .github/workflows/content-automation.yml
├─ automation/
│  ├─ config.py  sources.py  generate.py
│  ├─ calendar.py  publish.py  run.py
│  └─ requirements.txt
└─ posts/                # ilk çalıştırmada otomatik oluşur
```

### 2. Gemini API anahtarı
- https://aistudio.google.com → API key oluştur (ücretsiz tier: günlük ~1500 istek).
- Repo → Settings → Secrets and variables → Actions → **`GEMINI_API_KEY`**.

### 3. Google Sheets
- https://sheets.google.com → **"Start-Hub Yayın Planı"** adlı sayfa.
- İlk satıra başlıklar: `id | title | slug | category | planned_date | status | source_url | content_file`
- Google Cloud → servis hesabı oluştur → JSON anahtarı indir.
- Sayfayı servis hesabının e-postasıyla **paylaş (Editör)**.
- JSON'un TAMAMINI tek satır secret olarak ekle: **`GOOGLE_SHEETS_CREDENTIALS`**.

### 4. GitHub yazma izni
- `GITHUB_TOKEN` Actions tarafından otomatik sağlanır (workflow'da `permissions: contents: write` ayarlı).
- Başka repoya yazacaksan klasik PAT oluşturup `GH_TOKEN` + `GH_REPO` ver.

### 5. Test
- Actions sekmesi → "Start-Hub Content Automation" → **Run workflow** → mode: `generate`.
- Sheets'e draft düştü mü? Bir satırı elle `approved` yap.
- Tekrar çalıştır → mode: `publish`. `posts/` altına `.json` düştü mü?

---

## Çalışma modları
```bash
python run.py generate   # sadece RSS+Gemini -> Sheets'e draft
python run.py publish    # sadece approved satırları -> posts/*.json
python run.py all        # ikisi (varsayılan, cron bunu çağırır)
```

## Zamanlama
`content-automation.yml` → `cron: "0 5 * * *"` = **08:00 TRT** (UTC+3).
Saati değiştirmek için cron'u UTC'ye göre ayarla.

## Ücretsiz tier sınırları
| Servis | Sınır | Bu hat için |
|---|---|---|
| GitHub Actions | 2000 dk/ay | günde ~2-3 dk → bol bol yeter |
| Gemini Flash | ~1500 istek/gün | günde 2 haber → çok rahat |
| Google Sheets API | 300 istek/dk | sorun yok |

## Güvenlik
- Hiçbir anahtarı koda gömme — hepsi GitHub Secrets.
- Servis hesabı JSON'unu repoya **commit etme**.
- Gemini çıktısını yayınlamadan önce editör onayı (`approved`) zorunlu tutman önerilir
  (panelde "Otomatik Onay" KAPALI tut).
