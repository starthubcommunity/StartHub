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

## T11 — Görüşme kararı maili (Blok C — C2)

1. Görüşme aşamasındaki bir kartta rubriği doldur (eşik geçsin). Altta
   **"Görüşme kararı"** → **Olumlu — denemeye davet**.
2. **Beklenen:** hazır mail metni görünür (`{{ad}}` dolu). Gönder'e basmadan
   mail gitmez. "Gönder ve Deneme'ye al" → mail adaya ulaşır (gerçek kontrol),
   aday **Deneme**'ye geçer, `hub_touches`'a `channel='email'` kaydı düşer.
3. E-postası olmayan bir adayda mail kutucuğu kapalı; "Mailsiz Deneme'ye al"
   ile karar yine verilebilir.
4. Başka bir adayda **Olumsuz — nazik ret** → ret metni + arşiv sebebi seçimi →
   "Gönder ve arşivle" → mail gider, aday **Arşiv**'e düşer, `hub_touches`'a
   `channel='email'` kaydı.
5. Eşik sağlanmayan adayda "Olumlu" düğmesi pasif, sebep görünür.

## T12 — Kapı görev maili (C3)

1. Deneme aşamasında "Kapı A başlat" → görev metni yaz, "Görevi mail ile gönder"
   açık bırak → metni gözden geçir → "Mail gönder ve Kapı A'yı başlat".
2. **Beklenen:** görev + son teslim tarihi adaya mail olarak gider (gerçek
   kontrol), `hub_gates` kaydı `due_at` ile oluşur, `hub_touches`'a
   `channel='email'` kaydı. Kutucuk kapatılırsa mail gitmez, kapı yine başlar.

## T13 — Ekibe al (C4)

1. Bağlı rolü + e-postası olan, kapıları geçmiş bir adayda "Ekibe al".
2. **Beklenen:** aday **Ekipte**; `hub_candidates.person_id` (text) dolu;
   `people`'da `type='project_member'`, `project_id`=startup kaydı;
   `startups.member_ids`'te o `people.id`; adaya **markalı davet maili** gider,
   linkten şifre belirleyip `/team/`'e girip takımını görebiliyor.
3. Bir adım patlarsa "Kısmen aktarıldı — …" uyarısı (sessiz yutma yok).
4. Yetkisiz (project_owner) çağrıda fonksiyon 403 döner.

## T13b — "Ekibe al" onayı: projesiz aday uyarısı (C4 düz. 2)

1. Bir açık role **bağlı olmayan** bir adayda "Ekibe al".
2. **Beklenen:** onay paneli açılır, kırmızı uyarı: "Bu aday bir projeye bağlı
   değil… hiçbir takımı göremez." Panelde açık rol seçimi var.
3. Rol seçip "Ekibe al" → aday role bağlanır (`linkCandidateRole`), sonra
   ekibe alınır. Rol seçmeden "Yine de devam et" → engellenmez, uyarı verilmişti.
4. Zaten role bağlı adayda panel sakin bilgi metni gösterir, "Ekibe al" ilerler.

## T14 — Yapıştır ve ekle (Blok D — D1)

1. Adaylar → **"Yapıştır ve ekle"** → bir hackathon sonuç / etkinlik listesini
   yapıştır → "Ayrıştır".
2. **Beklenen:** satırlar tabloda; ad/link/okul/bağlantı sütunları. Bulunamayan
   alan **boş** (uydurulmuyor). Adı çıkarılamayan satır kırmızı + seçimi kapalı.
3. Satırları gözden geçir → İleri → Kaynak + parti etiketi + **ortak "Neden bu
   kişi"** (boşsa "Ekle" pasif) + opsiyonel rol → "N adayı ekle".
4. **Beklenen:** seçili adaylar Havuz'a düşer, hepsinde aynı `import_batch_label`,
   `source` seçilen değer, `why_this_one` = ortak cümle. `hub-rules.test.mjs`
   yapıştırma senaryoları yeşil.

## T15 — Tekilleştirme (Blok D — D2)

1. Havuzda e-postası/GitHub'ı olan bir aday varken, aynı e-posta/GitHub'ı içeren
   bir satırı **Yapıştır ve ekle** ile getir.
2. **Beklenen:** önizlemede o satırda "tekrar" rozeti + seçim menüsü
   (mevcudu güncelle / yeni kayıt / atla), varsayılan "güncelle".
3. "Güncelle" ile onayla → **yeni kart açılmaz**; mevcut kartın boş alanları
   (link, okul, kanıt) dolar. Sonuç ekranı "N eklendi · M güncellendi" der.
4. Aynı ad + aynı okul (link yok) → "olası" rozeti, varsayılan "yeni kayıt".
5. **Tek aday** eklerken aynı e-posta/GitHub → "Zaten kayıtlı (…)" uyarısı,
   kayıt açılmaz.
6. CSV içe aktarmada da aynı "Tekrar" sütunu çalışır.

## T16 — AI taslağı: "neden bu kişi"den + toplu (Blok D — D4)

1. **Tekli:** GitHub'ı olmayan, "neden bu kişi"si dolu bir adayın kartında
   "Taslak oluştur" → anlamlı, spesifik bir cümle (o esere/işe atıf, sıfat yok).
2. **Toplu:** Yapıştır ve ekle ile 10-20 aday ekle → sonuç ekranında
   **"N adaya taslak oluştur (AI)"** → ilerleme çubuğu dolar, taslaklar
   `draft_text`'e yazılır. "neden bu kişi"si olmayan/veri yetersiz olan atlanır
   ("… atlandı — veri yetersiz").
3. **Beklenen:** hiçbir taslak otomatik gönderilmez; hepsi kartta düzenlenebilir.
   `HUB_GEMINI_API_KEY` yoksa net hata.

## T17 — Hızlı eleme (Blok D — D3)

1. Adaylar → **"Hızlı eleme"** (filtre yoksa "hiç mesaj atılmamış" ile açılır).
2. Tam ekran, tek aday. Kartta: ad, okul, bağlı rol, **nerede bulundu**
   (kaynak + detay), **neden bu kişi**, bağlantılar, düzenlenebilir AI taslağı.
   Teknik adayda GitHub sinyalleri küçük bir satır (yoksa hiç).
3. Klavye ile — fareye dokunmadan — 20 adaylık partiyi geç: **M** gönder ·
   **A** atla · **E** ele. Her "M" `hub_touches` kaydı oluşturur, aday Temas'a
   geçer. Input'a odakken M/A/E yazı olarak girer, aksiyonu tetiklemez.
4. **Ctrl+Z** → son aksiyonu geri alır ('ele' → arşivden çıkar; 'M' → touch
   silinir, Havuz'a döner). Üstte ilerleme (N/20) ve bugünkü gönderim sayısı.
5. Parti bitince özet ("N mesaj · M elendi · K atlandı").

## T18 — Blok D düzeltmeleri (canlı)

1. **Dedup (D2 düz.1):** Aynı listeyi ikinci kez yapıştır (ortak "neden bu kişi"
   değişmiş olsa da). **Beklenen:** e-postasız/linksiz, yalnızca ad+okul içeren
   satırlar bile "olası tekrar" rozeti alır, varsayılan aksiyon **"mevcudu
   güncelle"**. Onayla → yeni kayıt açılmaz, "N eklendi · M güncellendi".
   TR karakter (Yılmaz/Yilmaz, İTÜ/itü) eşleşiyor.
2. **canDraftAI (D3 düz.2):** yalnızca takım adı + okulu olan adayda "Taslak
   oluştur" → **üretmiyor**, "Veri yetersiz — elle yaz". Somut cümle (sayı içeren
   veya ≥5 kelime) olan adayda üretiyor.
3. **Triage M (D3 düz.3):** hızlı elemede M → aday **Temas**'a geçiyor, takip
   tarihi kuruluyor (kart akışıyla birebir). Touch kaydı `note`'unda taslak var.
4. **Triage bildirimi (D3 düz.4):** "Mesaj kaydedildi" bildirimi üst-ortada
   çıkıyor, M/A/E düğmelerini kapatmıyor, ~1.8 sn sonra kayboluyor, tıklamayı
   geçiriyor (`pointer-events:none`).

## Regresyon

- [ ] `/team/` ve `/admin/` bozulmadı
- [ ] Sol menü 4 madde (Bugün / Adaylar / Arşiv / Roller) + "Yönetim"
- [ ] `hub-rules.test.mjs` tümü yeşil
- [ ] `npm run build` hatasız
- [ ] `0004_hub_cron.sql` deploy edilmemiş; `hub_import_batches` / `hub_views` yok
