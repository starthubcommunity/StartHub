# Kurucu Hattı — Kabul Testleri (v3)

> `HUB_SPEC.md` (v3) temelli. Aşama başına bir uçtan uca test. Otomatik kural
> senaryoları için `node src/hub/hub-rules.test.mjs` (tümü yeşil olmalı).

## T1 — Havuz: aday ekle + AI taslak

1. Adaylar → "Aday ekle" → ad + link + kaynak + **"neden bu kişi" (zorunlu)** + sorumlu.
2. **Beklenen:** "Neden bu kişi" boşken sihirbaz son adımı ilerletmez / kayıt
   pasiftir. Dolunca aday **Havuz**'a düşer.
3. Kartı aç → "Mesaj" alanında "Taslak oluştur".
4. **Beklenen:** `draft_text` dolar. "Neden bu kişi", kaynak detayı ve link
   boşsa buton "Veri yetersiz" der, çağrı yapılmaz.

## T2 — Havuz → Temas: "Mesajı attım" (kopyalama kilidi yok)

1. Havuz'daki adayın kartında "Mesaj" alanı doğrudan görünür ve düzenlenebilir.
   İstersen "Şablondan başla" ile bir şablon metni yükle, üstüne yaz.
2. "Kopyala" → panoya kopyalar, **başka hiçbir şey olmaz** (`hub_touches` kaydı
   oluşmaz, aşama değişmez).
3. "Mesajı attım" → kanal sor (LinkedIn / e-posta / WhatsApp, son kullanılan
   varsayılan) → bir kanal seç.
4. **Beklenen:** `hub_touches` kaydı düşer (`channel` doğru, `template_id` null
   olabilir), aday **Temas**'a geçer, 7 günlük `follow_up_at` atanır.
   Şablon hiç seçilmeden de gönderilebilir.

## T2b — Temas → Görüşme: tek düğme

1. Temas aşamasındaki kartta cevapla ilgili **tek** düğme var:
   "Cevap geldi, görüşmeye geç".
2. **Beklenen:** son `hub_touches.outcome = replied` **ve** aday **Görüşme**'ye
   geçer; `hub_stage_log`'a **tek** satır düşer.

## T3 — Görüşme: rubrik + eşik (kırmızı bayrak YOK)

1. Adayı Görüşme'ye al. Kartta üç eksene puan ver — butonlar 1–5 rakamı yerine
   `AI_PRESCORE_FINISHING` cümlesini gösterir. Puanlar **kilitlenmez**; ikinci
   kez değiştirilebilir.
2. Kartta kırmızı bayrak arayüzü **yoktur** — yerine tek serbest "Görüşme notu".
3. **Beklenen:** eşik göstergesi düz cümle döndürür. Rubrik eksik ya da eşik
   sağlanmıyorsa **Deneme**'ye taşıma yine reddedilir (bayrak kilidi kalktı,
   rubrik/eşik kapısı durur).

## T3b — Geri alma (undo)

1. Bir adayı yanlışlıkla bir sonraki aşamaya ilerlet.
2. Kartta **"Geri al (<önceki aşama>)"** düğmesine bas.
3. **Beklenen:** aday önceki aşamaya döner; `hub_stage_log` iki satır içerir
   (ileri + `reason: 'geri alındı'`). Ekipte aday için düğme yok, "geri alınamaz"
   ipucu görünür.

## T4 — Deneme: Kapı A + süre uzatma

1. Görüşme eşiği geçen adayı **Deneme**'ye taşı → "Kapı A başlat (72 saat)".
2. Kapı kartında süre rozeti görünür.
3. "Süre yetmedi mi?" → **+3 gün** → `hub_gates.extended_days = 3`,
   `hub_stage_log`'a otomatik not düşer (insan metni girmez), rozet güncellenir.
4. "Teslim etti" → kurucu hattında **Kapı B** açılır; üye hattında doğrudan
   "Ekibe aktar" görünür. "Teslim etmedi" → Arşiv, sebep otomatik.

## T5 — Ekipte + Roller + Metrikler

1. Kapı(lar) geçince "Ekibe aktar" → aday **Ekipte**, `vesting_start_date`
   = Kapı A'nın ilk günü. Bağlı rol `filled` olur.
2. Roller ekranı: "Rol oluştur" → 5 alan → kaydet → rol doğrudan **Aranıyor**.
   "Talep gönder" / "Üstlen" butonu YOK.
3. Metrikler: 3 kart (cevap oranı / görüşme→deneme / 90 gün aktif) + kaynak
   kırılımı tablosu. Hepsi gerçek veriden, sabit değer yok.

## Regresyon

- [ ] `/team/` ve `/admin/` bozulmadı
- [ ] Sol menü 3 madde + "Yönetim" (Şablonlar / Metrikler / Yetkiler / Ayarlar)
- [ ] `hub-rules.test.mjs` tümü yeşil
- [ ] `npm run build` hatasız
- [ ] `0004_hub_cron.sql` deploy edilmemiş; `hub_import_batches` / `hub_views` yok
