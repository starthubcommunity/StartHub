# Kurucu Hattı — Kabul Testleri (v2)

> `HUB_SPEC.md` (v2) temelli. Aşama başına bir uçtan uca test. Otomatik kural
> senaryoları için `node src/hub/hub-rules.test.mjs` (66 senaryo yeşil olmalı).

## T1 — Havuz: aday ekle + AI taslak

1. Adaylar → "Aday ekle" → ad + GitHub linki + kaynak + sorumlu → kaydet.
2. Listede görünür, aşama **Havuz**.
3. Kartı aç → "Neden bu kişi" doldur → "Taslak oluştur".
4. **Beklenen:** `draft_text` dolar. "Neden bu kişi", kaynak detayı ve link
   boşsa buton "Veri yetersiz" der, çağrı yapılmaz.

## T2 — Temas: mesaj taslağı → aşama ilerler

1. Havuz'daki adayın kartında "Mesaj taslağı" → şablon seç, kanal seç,
   kişiselleştirme satırını yaz → "Kopyala".
2. **Beklenen:** panoya kopyalanır, `hub_touches` kaydı düşer, aday
   **Temas**'a geçer, 7 günlük takip tarihi atanır. Kişiselleştirme satırı
   boşken "Kopyala" devre dışıdır.
3. "Cevap geldi" → `hub_touches.outcome = replied` (aşama değişmez).

## T3 — Görüşme: rubrik + eşik

1. Adayı Temas → **Görüşme**'ye taşı (Adaylar listesinden ya da karttan).
2. Kartta üç eksene puan ver. Bitirmişlik butonları 1–5 rakamı yerine
   `AI_PRESCORE_FINISHING` cümlesini gösterir.
3. **Beklenen:** eşik göstergesi düz cümle döndürür. Rubrik eksik ya da eşik
   sağlanmıyorsa **Deneme**'ye taşıma reddedilir, sebep gösterilir.
   2+ kırmızı bayrak varsa yalnızca kurucu, override gerekçesiyle geçirir.

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
- [ ] `hub-rules.test.mjs` 66/66
- [ ] `npm run build` hatasız
- [ ] `0004_hub_cron.sql` deploy edilmemiş; `hub_import_batches` / `hub_views` yok
