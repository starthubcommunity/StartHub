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
   (ileri + `reason: 'geri alındı'`).

## T3c — Geri al: Deneme kartı Görüşme'yi gösterir (Arşiv'i DEĞİL)

1. Bir adayı Görüşme → Deneme'ye ilerlet, Kapı A başlat, "Süre yetmedi mi?" →
   +3 gün ile süreyi uzat.
2. **Beklenen:** kartta "Geri al" düğmesi **"Geri al (Görüşme)"** yazar —
   "Arşiv" değil. Basınca aday Görüşme'ye döner (kapı satırı `hub_stage_log`
   hedefini bozmaz).
3. Adayı arşivle, sonra "Geri al" ile Deneme'ye döndür. **Beklenen:** artık
   Deneme'deki kartta "Geri al" düğmesi **görünmez** (yeniden arşivleme sunulmaz).

## T3d — Ekibe almayı geri al (Hata 2 / C4 öncesi)

1. Bir adayı kapıları geçirip "Ekibe al" ile **Ekipte**'ye taşı — bağlı rol
   `filled` olur.
2. Kartta **"Geri al (Deneme)"** düğmesi var; basınca **onay diyaloğu** çıkar.
3. Onayla. **Beklenen (hiçbir hata çıkmadan):** aday **Deneme**'ye döner,
   `joined_at` ve `vesting_start_date` null olur, bağlı rol `filled → shortlist`
   + `filled_at` null olur, `hub_stage_log`'a `reason: 'ekibe alma geri alındı'`
   satırı düşer.

## T3e — Rol / hat üst şeritte etiket (Hata 1)

1. Bir adayı Havuz → Ekipte boyunca gezdir.
2. **Beklenen:** hat ve rol yalnızca kart başlığında `.adm-chip` etiketi olarak
   görünür; hiçbir aşamada açıkta `<select>` alanı durmaz. Kartta katlanmış
   "Rol / hat düzenle" menüsü vardır (varsayılan kapalı); açılınca rol seçimi
   herkeste, hat seçimi yalnızca cofounder'da görünür.

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

## T6 — Arşiv ayrı sayfa (Blok B — B1)

1. Bir adayı arşivle (karttan ya da listeden).
2. **Beklenen:** aday **Adaylar** listesinde artık görünmez; sayaç "N / M
   aktif aday" yalnızca aktifleri sayar. Sol menüde **Arşiv** maddesi var.
3. Arşiv sayfası: arşiv sebebine göre çipler (sayı gösterir). Bir satırda
   **"Geri al (<aşama>)"** → aday arşivlendiği aşamaya döner, Adaylar'a geri
   girer, `archive_reason` null olur.

## T7 — Hızlı filtreler (B2)

1. Adaylar listesi üstünde çipler: Benim adaylarım · Cevap bekleyenler · Karar
   bekleyenler · Hiç mesaj atılmamış · Bayatlamış — her biri **sayı** gösterir.
2. Bir çipe tıkla → liste süzülür; sayaç doğru. Tekrar tıkla → temizlenir.
3. Alt sırada arama + Aşama / Kaynak / Rol açılır menüleri.
4. **Beklenen:** çip + menü seçimi `sessionStorage`'da; sayfa yenilenince korunur.

## T8 — Satır sağ sütunu aşamaya göre (B3)

1. Farklı aşamalarda adaylar oluştur.
2. **Beklenen:** her satırın sağında aşamaya uygun tek bilgi:
   Havuz → "mesaj yok/var" · Temas → "takip GG.AA" · Görüşme → puan rozeti ·
   Deneme → "Kapı A · Ns/Ng kaldı" (süresi geçmişse kırmızı) · Ekipte →
   "katıldı GG.AA".

## T9 — Inbound: başvuru → aday (Blok C — C5)

1. Admin panel → Başvurular → bir başvuru seç. (Kullanıcı hub'da
   cofounder/recruiter olmalı; değilse düğme görünmez.)
2. **"Kurucu Hattı'na aday olarak aktar"** → "Neden bu kişi" başvuru metninden
   ön-dolu gelir, düzenle → Aktar.
3. **Beklenen:** Hub → Adaylar'da yeni aday, aşama **Havuz**, kaynak **Inbound
   (site başvurusu)**, `source_ref` = başvuru id'si.
4. Aynı başvuruya dön → düğme yerine **"Aktarıldı ✓"** yazar; tekrar aktarılamaz.
5. Aynı e-posta Hub'da zaten varsa → "Bu e-posta zaten Hub'da bir adayda kayıtlı"
   uyarısı, kayıt açılmaz.

## T10 — Gece / haftalık işler (Blok C — C1, operasyonel)

1. `supabase functions invoke hub-daily` (veya Dashboard'dan) — elle tetikle.
   **Beklenen:** JSON `{ ok:true, followUpsCreated, archivedNoReply, gatesFailed,
   staleInterview }` — sayılar veri durumuna uygun (contact aşamasında bekleyen
   varsa > 0). `contact`/`interview`/`trial` aşama adları kullanılıyor.
2. `supabase functions invoke hub-weekly` — **Beklenen:** aktif cofounder'lara
   özet maili gider (`sent[].status = 200`), satırlar `interview`/`trial`/
   `member` sayıları.
3. İkisi de doğrulanınca: Vault'a `project_url` + `service_role_key` secret'ları
   ekle → `0015_hub_cron.sql` çalıştır → `select jobname,active from cron.job
   where jobname like 'hub-%'` iki aktif job göstermeli.

## Regresyon

- [ ] `/team/` ve `/admin/` bozulmadı
- [ ] Sol menü 4 madde (Bugün / Adaylar / Arşiv / Roller) + "Yönetim"
- [ ] `hub-rules.test.mjs` tümü yeşil
- [ ] `npm run build` hatasız
- [ ] `0004_hub_cron.sql` deploy edilmemiş; `hub_import_batches` / `hub_views` yok
