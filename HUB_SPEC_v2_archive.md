# Start-Hub — Kurucu Hattı (`/hub`) Yapım Şartnamesi v2 — ARŞİV

> ⚠️ **Bu sürüm arşivdir.** Geçerli şartname `HUB_SPEC.md` (v3). Bu dosya
> yalnızca v2 kararlarının izini tutar; v3 ile çelişen yeri v3 kazanır.
> v3'te değişenler: şablon arka plana alındı, kopyalama kilidi ve kırmızı
> bayraklar kaldırıldı, "cevap geldi" tek aksiyon oldu, track yalnızca rolden
> miras, `next_action` türetiliyor, `why_this_one` zorunlu, arşiv ayrı sayfa,
> yapıştır-ayrıştır ana giriş yöntemi.

> Bu dosya `HUB_SPEC.md`'nin yerini alır. Önceki sürüm §9'da "hiçbir karar tek başına değiştirilmez" diyordu — bu doğru, bu yüzden değişiklik önce burada yapıldı, kod ikinci adım.
> **Neden v2:** v1, sıfır adayla, iki kişilik bir ekibin ihtiyacından çok daha büyük bir sistem tanımlamıştı — 10 ekran, 57 alan, 12 tablo. Bu sürüm aynı işi 3 ekran, aşamaya göre 6-8 alan ve 7 tabloyla yapar.
> **Kural aynen geçerli:** Bu şartnamedeki hiçbir karar tek başına değiştirilmez.

---

## 0. Kapsam ve kapatılmış kararlar

- İki hat (kurucu / üye) kalıyor — maliyet asimetrisi gerçek, ayrım kalkmıyor.
- Kapı A + Kapı B kalıyor, tek "Deneme" aşaması içinde iki alt-adım olarak.
- Süre (72 saat / 10 gün) varsayılan sabit, ama önceden tanımlı adımlarla uzatılabilir (bkz. §3.3).
- CSV/Excel içe aktarma v1'de var. Yapıştır-ayrıştır, GitHub taraması, kaynak kütüğü v1 dışı — ayrı dalda bekliyor (§8).
- AI taslak cümle üretimi v1'de var, tekli ve toplu. Otomatik gönderim hiçbir zaman yok.
- Excel tek yönlü giriş kapısı. Sistem tek doğruluk kaynağı; dışa senkron yok.
- Görsel dil: `admin.css`'teki mevcut token'lar (`--adm-*`) ve bileşenler (`.adm-chip`, `.adm-badge`, `.adm-btn`) birebir kullanılır, yeni stil icat edilmez. Ekran başına bir birincil (kırmızı) aksiyon kuralı geçerli.

---

## 1. Navigasyon

Sol menü üç madde: **Bugün · Adaylar · Roller.** Dişli ikonu altında: Şablonlar, Metrikler, Yetkiler/Ayarlar (birleşik).

`board.jsx`, ayrı `table.jsx`, `import.jsx`, `sources.jsx` kaldırılır. Bugün varsayılan açılış ekranı.

**Bugün ekranı — 4 blok:**
1. Mesaj atılacaklar (Havuz'da, henüz temas kurulmamış)
2. Süresi gelen takipler (Temas'ta, cevap bekleyen)
3. Karar bekleyenler (Görüşme'de, rubrik dolu, eşik kontrolü bekleyen)
4. Süresi dolan kapılar (Deneme'de, Kapı A/B süresi bitmiş)

---

## 2. Aşamalar

**Sıra:** Havuz → Temas → Görüşme → Deneme (Kapı A → Kapı B*) → Ekipte. Her aşamadan Arşiv'e dallanabilir.

*Kapı B yalnızca kurucu hattında görünür.

| Aşama | Kartın sorduğu tek soru |
|---|---|
| Havuz | Bu kişiye mesaj atalım mı? |
| Temas | Cevap geldi mi? |
| Görüşme | Üç eksende kaç puan? |
| Deneme — Kapı A | Görevi teslim etti mi? (72 saat) |
| Deneme — Kapı B (kurucu) | Görevi teslim etti mi? (10 gün) |
| Ekipte | — (bitti, kayıt kalıyor) |

`contacted` + `replied` tek "Temas" aşamasında birleşti — cevap durumu `hub_touches.outcome`'da ayrıca tutuluyor, aşama olarak tekrar tutulmuyor. `finalist` ayrı bir aşama değil, Görüşme'nin geçme kararının kendisi.

`canAdvance()` mantığı değişmiyor: sıra atlanamaz, arşiv sebebi zorunlu, bayrak varsa ilerleme kilitli.

### 2.1 Kapı kartı (Kapı A ve Kapı B — aynı bileşen)

Alanlar: **görev metni** (serbest, tek satır) · **süre rozeti** (otomatik: 72 saat ya da 10 gün, salt-okunur) · **Başlat** · sonuç: **Teslim etti / Teslim etmedi**.

Teslim etti + kurucu hattı → Kapı B açılır. Teslim etti + üye hattı → doğrudan Ekipte. Teslim etmedi → Arşiv, sebep otomatik dolar.

### 2.2 Süre uzatma

"Süre yetmedi mi?" bağlantısı → 3 hazır seçenek: **+1 gün / +3 gün / +1 hafta.** Serbest gün girişi yok, gerekçe zorunlu değil — sistem otomatik `hub_stage_log`'a not düşer (kim, ne zaman, ne kadar). `hub_gates.extended_days` alanı bu uzatmayı tutar.

### 2.3 Eşik ve bayrak (sade dil)

Eşik metni ham formül değil, cümle: *"Kapasite puanı düşük — finalist olamaz."* Rubrik butonları 1-5 rakamı değil, `AI_PRESCORE_FINISHING` tablosundaki açıklama cümlesini gösterir.

Kırmızı bayrak 6 → 4: `blame`, `no_terms`, `unrealistic`, `disrespect`. (`no_i` ve `only_experience` kaldırıldı, örtüşüyorlardı.)

---

## 3. Aday kartı

Sekme yok. Kart, adayın bulunduğu aşamanın alanlarını gösterir:

- **Havuz:** ad, tek link, kaynak, "neden bu kişi"
- **Temas:** gönderilen mesaj (salt-okunur), takip tarihi
- **Görüşme:** rubrik butonları + kırmızı bayraklar
- **Deneme:** aktif kapı kartı (§2.1)
- **Ekipte:** sözleşme/hak ediş tarihi

"Detay" akordeonu (kapalı, isteğe bağlı): beceriler, haftalık saat, rol tipi, kanıt notları.

Geçmiş, "Geçmişi göster" bağlantısına iner, varsayılan kapalı.

**Sonraki aksiyon** serbest metin değil, 6 seçenekli liste: *Mesaj at · Takip et · Görüşme ayarla · Görüş · Karar ver · Kapı başlat.*

---

## 4. Alanlar

**Görünen çekirdek (aşamaya göre değişir):** ad, link, kaynak, sorumlu, aşama, sonraki aksiyon, puan (Görüşme'den sonra), bayrak.

**Birleşenler:**
- `university` + `department` + `class_year` + `grad_year` + `edu_status` → tek **"Okul / durum"** serbest alanı
- `email` + `linkedin` + `github` → tek **"Link"** alanı, tip otomatik algılanır

**Silinenler:** `tags`, `languages`, `phone`, `city`

**Görünmeyen (DB'de kalır, otomatik):** `data_trust`, `kvkk_consent`, `kvkk_at`, `retain_until`, `source_ref`, `batch_id`, `ai_score`, `ai_score_note`, `enrichment`, `enriched_at`, `score_total`, `stage_changed_at`, `last_contact_at`, `created_by`, `updated_at`

**Yeni alanlar:**
- `draft_text` — AI'ın ürettiği taslak cümle (insan düzenleyince üzerine yazılır)
- `import_batch_label` — serbest etiket, örn. "Ekim hackathon listesi" (filtre amaçlı, ayrı tablo yok)

---

## 5. Adaylar listesi

Tek liste, konfigürasyonsuz. 7 sabit sütun: Ad · Aşama · Kaynak · Sorumlu · Puan · Bayrak · Sonraki aksiyon.

Yok: kayıtlı görünümler, sütun gizle/sırala, hücre içi düzenleme, CSV dışa aktarma, çoklu seçim/toplu işlem.

Filtre: serbest metin arama + 3 chip grubu (aşama, kaynak, sorumlu) — `.adm-chip` bileşeni.

---

## 6. Aday ekleme

**Elle tek aday:** modal, 4 alan (ad, link, kaynak, sorumlu).

**CSV/Excel içe aktarma** — 3 adım, senkron, arka plan işi yok:
1. Yükle
2. Kolon eşle — sistem başlıkları tahmin eder (`Ad Soyad` → `full_name`), "Neden bu kişi" sütunu önerilir/eşlenir
3. Önizle ve onayla — satır bazlı al/atla, onayla → Havuza düşer, hepsine aynı `import_batch_label` yazılır

Yapıştır-ayrıştır (serbest metin → regex çıkarım) ve GitHub taraması v1 dışı (§8).

---

## 7. AI taslak üretimi

**Tekli:** kartta "Taslak oluştur" → tek API çağrısı → `draft_text`'e yazılır → insan düzenler.

**Toplu:** içe aktarma sonrası "Hepsine taslak oluştur" → tarayıcıda sırayla, ayrı kuyruk/worker yok.

**Veri yeterliliği kuralı:** AI, adayın somut verisi (kaynak detayı, "neden bu kişi", link) boşsa taslak üretmez — *"Veri yetersiz, elle yaz"* uyarısı gösterir. Amaç: boş şablon cümlesi üretip kişiselleştirme yanılsaması yaratmamak.

Taslak asla otomatik gönderilmez. Kişiselleştirme satırı zorunluluğu ve kopyalama kilidi aynen kalır — AI sadece ilk taslağı yazar, gönderen her zaman insan.

---

## 8. v1 dışı — ayrı dalda bekliyor

Silinmedi, `main`'den ayrı bir dalda saklanıyor, hacim gelince geri gelir:
- Yapıştır-ayrıştır (`hub-parse.js`)
- GitHub taraması + zenginleştirme (`hub-github.js`, `hub-enrich.js`)
- Kaynak kütüğü (`hub_source_registry`, `sources.jsx`)
- `hub_import_batches` tablosu — içe aktarma artık `import_batch_label` serbest metniyle çözülüyor, ayrı tablo gerekmiyor

---

## 9. Mesajlaşma

Kanal: LinkedIn · E-posta · WhatsApp (4 → 3, SMS kaldırıldı). Şablon A/B varyantı kaldırıldı — AI tekli taslak ürettiği için gereksiz. Şablonlar, dişli ikonu altındaki "Şablonlar" ekranında kalır (menüden çıktı, kayboldu değil).

---

## 10. Roller — Prompt D dondu, temel akış ve yetki kalıyor

`0005_hub_roles.sql` sadeleşerek çalışır. `hub_role_log` kurulmaz. `hub-match.js` (eşleştirme önerisi) ertelendi.

### 10.1 Durum makinesi — talep/onay el sıkışması yok

7 → 4: **Taslak → Aranıyor → Aday sunuldu → Dolduruldu.**

Proje sahibi rolü oluşturduğunda doğrudan **Aranıyor**'a düşer — ayrı bir "talep gönder" / "üstlen" adımı yok, `requested` durumu ve buna bağlı `requested_at`/`accepted_at`/`requested_by` kolonları kaldırıldı. Kim arayacağını proje sahibi rolü oluştururken tek alanla (`assigned_to`) seçer; recruiter kuyruktan görüp ayrıca kabul etmiyor.

`presented_at` / `owner_decision` / `owner_decision_note` kalır — "proje sahibi karar verir" ilkesi buna dayanıyor.

### 10.2 Yetki — zaten var, yeni bir şey kurmuyoruz

`0009_permissions.sql`'deki hub alanı zaten üç rolü ayırıyor (`cofounder`, `recruiter`, `project_owner`), dokunmuyoruz:

| | cofounder | recruiter | project_owner |
|---|---|---|---|
| Aday havuzunun tamamı | ✓ | ✓ | yalnızca kendine sunulan |
| Rubrik puanla | ✓ | ✓ | ✓ |
| Kabul/ret ver (`decide`) | ✓ | ✗ | ✓ |
| Bayrak override | ✓ | ✗ | ✗ |
| Üye/yetki yönetimi | ✓ | ✗ | ✗ |
| Rol oluştur | ✓ | ✓ | ✓ |

Bu tablo `permission_presets`'ten okunuyor — elle senkron tutulan ayrı bir liste değil, admin panelle paylaşılan aynı katalog. `roles.jsx` ve Bugün ekranı buton/bölümleri `has_perm()` ile gösterip gizler; recruiter ve proje sahibi için ayrı sayfa yazılmaz, aynı sayfa role göre farklı görünür.

### 10.3 Form ve alanlar

`roles.jsx` formu 11 → 5 alan: proje, başlık, aranan profil, beceriler, sorumlu (= `assigned_to`).

---

## 11. Metrikler

3 metrik: kaynak başına cevap oranı · Görüşmeden Deneme'ye geçiş oranı · 90 günde hâlâ aktif. Haftalık hedef gerçekçileştirildi: Havuza 10, Temasa 6 (30/15 yerine — iki kişi haftada 30 nitelikli aday bulamaz).

---

## 12. Veritabanı

**7 tablo:** `hub_members`, `hub_open_roles`, `hub_candidates`, `hub_stage_log`, `hub_touches`, `hub_gates`, `hub_templates`.

**Düşenler:** `hub_views`, `hub_source_registry`, `hub_import_batches`, `hub_role_log`, `hub_interviews` (görüşme kaydı adayın kendi alanlarına indi).

**`hub_candidates`'a eklenen:** `draft_text` (text), `import_batch_label` (text, nullable).
**`hub_gates`'e eklenen:** `extended_days` (int, default 0).

`0004_hub_cron.sql` deploy edilmez — bayatlama hesabı istemcide `isStale()` ile yapılır, gece işi gerekmiyor. RLS politikaları değişmeden kalır.

---

## 13. Dokunulmayanlar

- `canAdvance()` reddederken sebep gösterme davranışı
- Arşiv sebebi zorunluluğu
- Kişiselleştirme satırı zorunluluğu + kopyalama kilidi
- `hub_stage_log` / `hub_touches` kayıtları (görünmez ama tutulur)
- 90 gün aktiflik metriği
- Otomatik gönderim yasağı, LinkedIn kazıma yasağı
- RLS'in tek kapı olması, ayrı Supabase istemcisi kurulmaması

---

## Özet — önce/sonra

| | v1 | v2 |
|---|---|---|
| Ekran | 10 | 3 |
| Aşama | 8 + arşiv | 5 + arşiv (Kapı A/B dahil) |
| Görünen aday alanı | 57 | 6-8 (aşamaya göre) |
| Tablo | 12 | 7 |
| Zorunlu serbest metin | 2 | 1 (kişiselleştirme) |
| İçe aktarma | 5 yöntem | 2 yöntem (elle + CSV) |
