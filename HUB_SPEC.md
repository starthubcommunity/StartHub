# Start-Hub — Kurucu Hattı (`/hub`) Yapım Şartnamesi v3

> Bu dosya `HUB_SPEC_v2_archive.md`'nin yerini alır. v2 kuralı aynen geçerli:
> **bu şartnamedeki hiçbir karar tek başına değiştirilmez** — değişiklik önce
> burada yapılır, kod ikinci adımdır.
>
> **Neden v3:** v2 canlıda kullanıldı. Aday kartı hâlâ çok karar sordu
> (şablon seç, kopyala-kilit, kırmızı bayrak, track, elle `next_action`),
> outbound'da veri liste halinde geldi (CSV değil), arşiv aktif listeyi
> kirletti. v3 aynı 5 aşamayı ve 7 tabloyu korur; kartı sadeleştirir,
> yapıştır-ayrıştırmayı ana giriş yöntemi yapar, arşivi ayrı sayfaya alır.
>
> **v2 → v3 değişen kararlar:**
>
> | Konu | v2 | v3 | Sebep |
> |---|---|---|---|
> | Şablon | Mesaj akışının merkezinde | Arka planda, opsiyonel başlangıç metni | Her adaya farklı mesaj yazılıyor |
> | Kopyalama kilidi | Kopyalamadan ilerlenemez | Kaldırıldı; ayrı "Mesajı attım" aksiyonu | Mail/WhatsApp'tan gidince kopyalama gerekmiyor |
> | Cevap geldi | İki ayrı aksiyon | Tek aksiyon: "Cevap geldi, görüşmeye geç" | Fark pratikte kullanılmıyor |
> | Kırmızı bayraklar | 4 bayrak, 2'sinde kilit | Kaldırıldı, yerine serbest not | Kararı insan verir; kilit engel üretiyordu |
> | Rubrik puanı | Bir kez girilir | Her zaman düzenlenebilir | Görüşme sonrası fikir değişebiliyor |
> | Hat (track) | Aday kartında ayrıca sorulur | Yalnızca rolden miras (`inheritedTrack`) | Aynı soru her aşamada tekrarlıyordu |
> | `next_action` | Elle seçilen alan | Türetilir, alan kaldırılır | Elle seçilen alan unutulunca yanlış |
> | `why_this_one` | İsteğe bağlı | **Zorunlu** (aday eklerken) | AI taslağının ve eleme kararının tek girdisi |
> | Arşiv | Adaylar listesinde karışık | Sol menüde ayrı sayfa | Aktif liste kirleniyordu |
> | GitHub taraması | v1 dışı | Opsiyonel kaynaklardan biri | Adayların çoğunun GitHub izi yok |
> | Yapıştır-ayrıştır | v1 dışı | **v3'te var, ana giriş yöntemi** | Outbound'da veri liste halinde geliyor |

---

## 0. Kapsam ve kapatılmış kararlar

- İki hat (kurucu / üye) kalıyor — maliyet asimetrisi gerçek, ayrım kalkmıyor.
- Kapı A + Kapı B kalıyor, tek "Deneme" aşaması içinde iki alt-adım olarak.
- Süre (72 saat / 10 gün) varsayılan sabit, önceden tanımlı adımlarla uzatılabilir (§2.2).
- 5 aşama + arşiv. **Aşama sayısı artırılmaz** (8→5 indirildi, geri alınmaz).
- AI taslak cümle üretimi kalır, tekli ve toplu. **Otomatik gönderim hiçbir zaman yok.**
- Sistem tek doğruluk kaynağı; dışa senkron yok. İçe aktarma tek yönlü kapı.
- Görsel dil: `admin.css`'teki `--adm-*` token'ları ve `.adm-chip` / `.adm-badge` /
  `.adm-btn` bileşenleri birebir kullanılır. Yeni stil icat edilmez.
  **Ekran başına bir birincil (kırmızı) aksiyon.**
- Sabit listeler yalnızca `hub-constants.js`'te. Hiçbir bileşen kendi listesini tanımlamaz.

---

## 1. Navigasyon

Sol menü: **Bugün · Adaylar · Arşiv · Roller.** Dişli ikonu altında: Şablonlar,
Metrikler, Kaynaklar, Yetkiler/Ayarlar.

`board.jsx`, `table.jsx`, `import.jsx` menüde yok. Bugün varsayılan açılış ekranı.
**Arşiv** v3'te ayrı sayfa (`archive.jsx`) — Adaylar listesi `archived` göstermez.

**Bugün ekranı — 4 blok:**
1. Mesaj atılacaklar (Havuz'da, henüz temas kurulmamış)
2. Süresi gelen takipler (Temas'ta, cevap bekleyen)
3. Karar bekleyenler (Görüşme'de, rubrik dolu)
4. Süresi dolan kapılar (Deneme'de, Kapı A/B süresi bitmiş)

---

## 2. Aşamalar

**Sıra:** Havuz → Temas → Görüşme → Deneme (Kapı A → Kapı B*) → Ekipte.
Her aşamadan Arşiv'e dallanabilir.

*Kapı B yalnızca kurucu hattında.

| Aşama | Kartın sorduğu tek soru |
|---|---|
| Havuz | Bu kişiye mesaj atalım mı? |
| Temas | Cevap geldi mi? |
| Görüşme | Üç eksende kaç puan? |
| Deneme — Kapı A | Görevi teslim etti mi? (72 saat) |
| Deneme — Kapı B (kurucu) | Görevi teslim etti mi? (10 gün) |
| Ekipte | — (bitti, kayıt kalıyor) |

`contact` eski `contacted`+`replied`'ı kapsar — cevap durumu `hub_touches.outcome`'da
tutulur, aşama olarak tekrar tutulmaz.

### 2.1 `canAdvance()` — v3'te sadeleşti

- Sıra atlanamaz (kurucu + `override_reason` hariç). Geri gitmek serbest.
- Arşiv sebebi zorunlu.
- **Yalnızca kırmızı bayrak kilidi kaldırıldı.** Görüşme→Deneme geçişinde rubrik
  tamlığı ve puan eşiği **hâlâ engelleyici kontroldür** — eşik cümlesi ("kapasite
  puanı düşük") bilgi olarak da gösterilir. Kaldırılan tek şey: 2+ kırmızı bayrak
  varken geçişin kilitlenmesi ve bunu açan cofounder override'ı.
- `override_reason` / "cofounder override" mekanizması artık yalnızca **aşama
  atlama** için var (bayrak override'ı yok).

### 2.2 Kapı kartı (Kapı A ve Kapı B — aynı bileşen)

Alanlar: **görev metni** (serbest) · **süre rozeti** (otomatik 72s / 10g, salt-okunur) ·
**Başlat** · **"Görevi mail ile gönder"** seçeneği (§9.3) · sonuç: **Teslim etti / Teslim etmedi**.

Teslim etti + kurucu → Kapı B açılır. Teslim etti + üye → doğrudan Ekipte.
Teslim etmedi → Arşiv, sebep otomatik (`gate_failed`).

**Süre uzatma:** "Süre yetmedi mi?" → **+1 gün / +3 gün / +1 hafta.** Serbest gün
girişi yok. Sistem `hub_stage_log`'a otomatik not düşer. `hub_gates.extended_days`
birikimli tutar.

### 2.3 Eşik (sade dil, kilitsiz)

Eşik metni ham formül değil cümle: *"Kapasite puanı düşük."* Rubrik butonları
1–5 rakamı yerine `AI_PRESCORE_FINISHING` açıklama cümlesini gösterir.

**Kırmızı bayraklar (`RED_FLAGS`, `flag_notes`, `override_reason` bayrak dalı,
`THRESHOLD.blockAtRedFlags`) v3'te kaldırıldı.** Yerine aday kartında tek serbest
**"Görüşme notu"** alanı (`interview_note`). DB kolonları (`red_flags`,
`flag_notes`, `override_reason`) **düşürülmez**, sadece UI'dan çıkar — gerçek
`drop column` ayrı bir migration'da ve teyitle.

### 2.4 Geri alma (undo) — v3'te yeni

`hub_stage_log` zaten `from_stage` tutuyor; v3 arayüzünü ekler. Hedef **saf
fonksiyondan** gelir (`undoPlan(candidate, stageLog)`): en yeni **gerçek
ilerleme** satırı bulunur; `extendGate`'in `trial→trial` satırları ve önceki
geri-alma satırları (`reason` ∈ {`geri alındı`, `ekibe alma geri alındı`,
`arşivden geri alındı`}) atlanır. Bu satırın `to_stage`'i adayın şu anki
aşamasıyla uyuşmuyorsa geri alma sunulmaz.

- Aşama değişikliğinden sonra kartta **"Geri al (<önceki aşama>)"** görünür.
- Geri alma: adayı `from_stage`'e döndürür, `hub_stage_log`'a **yeni satır** yazar
  (eski satır silinmez).
- **Arşiv kartı** → arşivlendiği aşamaya döner, `archive_reason` → null.
  Zaten arşivden çıkmış bir kartta "Geri al" **görünmez** (yeniden arşivleme
  değildir).
- **Ekibe alma (`member`) geri alınabilir** — C4 (Team entegrasyonu) henüz yok,
  etki Hub içinde: aşama `trial`'a döner, `joined_at` + `vesting_start_date`
  temizlenir, bağlı rol `filled → shortlist` + `filled_at` null olur,
  `hub_stage_log`'a `reason: 'ekibe alma geri alındı'`. **Onay diyaloğu**
  gösterilir (birden çok kayıt etkilenir).
  > **C4 durumu:** `moveToTeam` artık `people` roster kaydı + `startups.member_ids`
  > + auth hesabı + davet maili yapıyor (`hub-move-to-team` edge function). Geri
  > alma **yalnızca Hub tarafını** geri sarar (aşama, `joined_at`,
  > `vesting_start_date`, rol). Roster kaydı, takım üyeliği ve açılan hesap
  > **elle** temizlenir. Team tarafını da geri alan bir akış ileride eklenebilir.
- **Geri alınamaz:** kapı sonucu (`passed`/`failed`) — bu bir aşama değişikliği
  değil (`hub_gates` satırında tutulur), geri alma hedefi üretmez.

---

## 3. Aday kartı

Sekme yok. Kart, adayın bulunduğu aşamanın alanlarını gösterir.

**Üst şerit (her aşamada, form değil, etiket):** ad · aşama · **hat** · **rol** ·
kaynak · türetilen sonraki aksiyon. Rol ve hat burada birer `.adm-chip` — hiçbir
aşamada seçim alanı olarak render **edilmez**, aşama değiştikçe tekrar sorulmaz.
Düzenleme kartta **katlanmış küçük bir menüde** ("Rol / hat düzenle", varsayılan
kapalı): rol bağlama yazma yetkisi olan herkeste (sunma akışı buna bağlı), hat
geçersiz kılma yalnızca **cofounder**'da.

- **Havuz:** tek link, kaynak detayı, **"neden bu kişi"** (zorunlu).
- **Temas:** mesaj alanı (§9), takip tarihi, **"Cevap geldi, görüşmeye geç"** tek düğme.
- **Görüşme:** rubrik butonları (her zaman düzenlenebilir) + **"Görüşme notu"** serbest alanı.
  Eşik cümlesi görünür; rubrik/eşik Deneme'ye geçişi hâlâ kapılar (§2.1). Karar
  verilince görüşme kararı maili hazır gelir (§9.2).
- **Deneme:** aktif kapı kartı (§2.2).
- **Ekipte:** hak ediş tarihi, **"Ekibe al"** (§9.4).

"Detay" akordeonu (kapalı): beceriler, haftalık saat, rol tipi, kanıt notları.
Geçmiş: "Geçmişi göster" bağlantısına iner, varsayılan kapalı.

**Sonraki aksiyon** artık **türetilir** — elle seçilen alan değil. `hub-rules.js`:

```
nextAction(candidate, touches, gates) → { key, label }
```

Kurallar: Havuz → "mesaj at"; Temas + cevap yok → "takip et"; Temas + cevap var →
"görüşme ayarla"; Görüşme + puan eksik → "görüş"; Görüşme + puan tam → "karar ver";
Deneme + kapı yok → "kapı başlat"; Deneme + kapı sürüyor → "sonucu bekle".

`next_action`, `next_action_at`, `next_action_link` kolonları **düşürülmez**,
yazma durur.

---

## 4. Alanlar

**Görünen çekirdek (aşamaya göre değişir):** ad, link, kaynak, kaynak detayı,
sorumlu, aşama, rol, hat, puan (Görüşme'den sonra), görüşme notu, türetilen sonraki aksiyon.

**Birleşenler:**
- `university` + `department` + `class_year` + `grad_year` + `edu_status` → tek **"Okul / durum"**
- `email` + `linkedin` + `github` → tek **"Link"** alanı, tip otomatik algılanır

**Silinenler (UI):** `tags`, `languages`, `phone`, `city`, `track` seçimi (rolden
miras), `next_action` seçimi (türetiliyor), kırmızı bayrak arayüzü

**Görünmeyen (DB'de kalır, otomatik):** `data_trust`, `kvkk_consent`, `kvkk_at`,
`retain_until`, `source_ref`, `batch_id`, `ai_score`, `ai_score_note`, `enrichment`,
`enriched_at`, `score_total`, `stage_changed_at`, `last_contact_at`, `created_by`,
`updated_at`, `person_id` (§9.4)

**Yeni / etkin alanlar:**
- `why_this_one` — **zorunlu** (aday eklerken). Placeholder: *"Ne yapmış? Somut bir
  iş, proje veya sonuç yaz."* AI taslağının birincil girdisi.
- `interview_note` — Görüşme'de tek serbest not (kırmızı bayrakların yerine)
- `draft_text` — AI taslağı (insan düzenleyince üzerine yazılır)
- `import_batch_label` — serbest parti etiketi (filtre amaçlı, ayrı tablo yok)
- `source_detail` — kaynağın spesifik hali ("Teknofest 2026 ulaşım kategorisi")
- `evidence` (jsonb) — bağlantılar: GitHub, kişisel site, proje sayfası, makale

---

## 5. Adaylar listesi ve Arşiv

**Adaylar listesi:** tek liste, konfigürasyonsuz. `stage === 'archived'`
**gösterilmez** (Adaylar sayısı yalnızca aktif adaylar).

**Hızlı filtre çipleri** (`.adm-chip`, üstte, **sayı gösterir**):
- Benim adaylarım (`ownerId === currentMember.id`)
- Cevap bekleyenler (Temas + son touch `pending`)
- Karar bekleyenler (Görüşme + rubrik tam) veya (`presentedAt` dolu + karar yok)
- Hiç mesaj atılmamış (Havuz + touch yok)
- Bayatlamış (`isStale()`)

Altında serbest arama + üç açılır menü (aşama, kaynak, rol). Çip seçimi
`sessionStorage`'da kalır.

**Satır sağ sütunu aşamaya göre değişir:** Havuz → "mesaj yok"; Temas → takip
tarihi; Görüşme → puan; Deneme → kalan süre (geçmişse `--adm` tehlike rengi);
Ekipte → katılım tarihi.

**Arşiv sayfası (`archive.jsx`):** aynı satır bileşeni, arşiv sebebine göre
filtre, **"Havuz'a geri al"** (§2.4 undo mantığı).

**Yok:** kayıtlı görünümler, sütun gizle/sırala, hücre içi düzenleme, CSV dışa
aktarma, çoklu seçim/toplu işlem.

---

## 6. Aday ekleme

### 6.1 Elle tek aday

Modal. Alanlar: ad, link, kaynak, kaynak detayı, sorumlu, **"neden bu kişi" (zorunlu —
boşsa kaydet pasif)**. Rol seçimi opsiyonel.

### 6.2 Yapıştır-ayrıştır — **v3'te ana giriş yöntemi**

`hub-parse.js` (regex + TR üniversite listesi, LLM yok, bulamadığı alanı boş
bırakır) `paste-import.jsx`'e bağlandı (Adaylar → **"Yapıştır ve ekle"**, birincil
aksiyon). Akış:

1. Yapıştır (hackathon sonuç sayfası, etkinlik listesi, tablo)
2. Ayrıştırılmış satırlar tabloda görünür — satır bazlı al/atla. **Adı
   çıkarılamayan satır** (`_unparsed`) kırmızı zeminli ve seçimi **kapalı** gelir
   (boş satır sessizce havuza girmesin).
3. Kaynak + parti etiketi + **tüm partiye uygulanacak ortak "neden bu kişi"
   cümlesi** (zorunlu) + opsiyonel açık rol
4. Onayla → Havuz (`store.importCandidates`, hepsine aynı `import_batch_label`)

**Tekilleştirme** (`hub-parse.findDuplicate` → `{ id, reason, certain }`):
- E-posta tam eşleşme → **kesin** (`certain: true`)
- GitHub kullanıcı adı / LinkedIn slug eşleşme → **kesin**
- Ad benzerliği (`similar() ≥ 0.85`, `NAME_DUP`) **veya** bir ad diğerinin tüm
  kelimelerini kapsıyorsa (2+ kelime; ayrıştırma fazladan kelime kattığında)
  → **olası** (`certain: false`). Aynı okul ŞART DEĞİL (yapıştırılan listelerde
  e-posta/link genelde yok); varsa `reason` "benzer ad + aynı okul" olur.
  TR normalizasyonu: `strip()` İ/I/ı→i, ş→s vb. + `toLowerCase` (locale-bağımsız).
- **Parti-içi mükerrer:** önizleme yalnızca mevcut havuza bakar; aynı partide iki
  kez geçen kişi için `importCandidates` büyüyen bir havuza (mevcut + bu partide
  açılanlar) karşı tekrar `findDuplicate` çalıştırır — ikinci kayıt açılmaz.

**Yapıştır / CSV önizlemesi:** tekrar bulunan her satırda "Tekrar" sütunu — rozet
(`tekrar` / `olası`) + seçim: **mevcudu güncelle** / **yeni kayıt** / **atla**.
Varsayılan: **tekrar bulunan her satır → "güncelle"** (aynı listeyi ikinci kez
yapıştırınca yeni kayıt yığılmasın). "Güncelle" mevcut kartta yalnızca **boş
alanları** doldurur + yeni kanıt linklerini ekler; aşama/puan/not dokunulmaz.
`importCandidates` `{ created, updated }` döner.

**Elle tek aday:** kesin mükerrer yeni kayıt açtırmaz — uyarı verir, kullanıcı
mevcut kartı listeden açar. (Olası mükerrer elle eklemede engellenmez.)

### 6.3 CSV/Excel içe aktarma

`import-simple.jsx` kalır (ikincil). "Neden bu kişi" sütunu eşlenmemişse tüm
partiye tek ortak cümle istenir. Hepsine aynı `import_batch_label`.

### 6.4 Hızlı eleme ekranı (`triage.jsx`)

Tam ekran, tek aday, üç aksiyon. Filtrelenmiş listeden başlar (varsayılan: "hiç
mesaj atılmamış"). Kartta **kaynaktan bağımsız**: ad, şehir/okul, bağlı rol,
**nerede bulundu** (`source` + `source_detail`), **neden bu kişi**, bağlantılar
(`evidence` + `link`), AI mesaj taslağı (düzenlenebilir). Teknik adayda GitHub
sinyalleri **küçük ek satır**, omurga değil.

Aksiyonlar: **Mesaj gönder (M) · Atla (A) · Ele (E)**. Her basışta sonraki aday.
Üstte ilerleme (7/20), üstte günlük gönderim sayacı, `Ctrl+Z` geri al. Kısayollar
sadece bu ekranda, input odaktayken M/A/E devre dışı (Ctrl+Z yine çalışır).

- **Mesaj gönder** → **yalnızca** `store.sendTouch` (aday kartındaki "Mesajı
  attım" ile birebir aynı yol — mantık kopyalanmaz): `hub_touches` kaydı (taslak
  metni `note`'a), Havuz→Temas, +7 gün takip. Kanal: son kullanılan.
- **Atla** → aday dokunulmadan sıradakine geç (Havuz'da kalır).
- **Ele** → `advanceStage('archived', reason:'hızlı eleme',
  archive_reason:'below_bar')`.
- **Geri al** → 'ele' → `undoLastStage`; 'mesaj gönder' → `undoSend` (son touch
  silinir + Temas'a çıkmışsa Havuz'a döner); 'atla' → yalnızca imleç geri.

Giriş: Adaylar listesinde **"Hızlı eleme"** düğmesi; aktif filtre varsa onun
sonucuyla, yoksa `no_message` çipiyle başlar. Kuyruk açılışta dondurulur.

---

## 7. AI taslak üretimi

**Tekli:** kartta mesaj alanında "Taslak oluştur / Yeniden yaz (AI)" → tek API
çağrısı → `draft_text` → insan düzenler.

**Toplu:** içe aktarma (yapıştır + CSV) sonuç ekranında **"N adaya taslak
oluştur (AI)"** (`components/bulk-draft.jsx`) → tarayıcıda `for` döngüsüyle
sırayla, ilerleme çubuğu, ayrı kuyruk/worker yok. `canDraftAI()` geçmeyen aday
atlanır ("… atlandı — veri yetersiz").

**Girdi (v3):** `whyThisOne` ve `sourceDetail` **birincil kaynak**. GitHub verisi
varsa ek girdi, zorunlu değil. Sistem promptundaki "somut bir esere atıf yap"
kuralı korunur ama eser GitHub reposu olmak zorunda değil (proje, başvuru,
etkinlik, yayın).

**Veri yeterliliği (`canDraftAI()` — Blok D düz. 2):** yalnızca isim/takım + okul
**yetersizdir** (kişinin ne yaptığı belli değil). "Somut" sayılması için: kanıt
linki VAR, **ya da** `whyThisOne`/`sourceDetail` metni ≥ 5 kelime, **ya da** bir
sayı (yıl/derece/sayaç) içeriyor ve ≥ 3 kelime. Geçmezse *"Veri yetersiz, elle
yaz."* Edge function'da aynı kontrol + üretilen metin < 5 kelimeyse `""` +
`insufficient` döner (arayüz "elle yaz" gösterir).

**Taslak asla otomatik gönderilmez.** AI ilk taslağı yazar; gönderen her zaman insan.

---

## 8. Bağlantısı kesik dosyalar (v3'te geri gelenler)

v2'de "ayrı dalda bekliyor" denenler — v3'te bağlanıyor:
- `hub-parse.js` → §6.2 (bağlandı)
- `hub_source_registry` + `sources.jsx` → §11 (bağlandı)
- `hub-github.js` + `hub-enrich.js` → §12.5 opsiyonel araç (token edge function proxy'de)
- `hub-match.js` → §12.4 (havuz 100+ adaya ulaşınca)

Hâlâ dışarıda: `hub_import_batches` tablosu (`import_batch_label` serbest metniyle
çözülüyor), `hub_views`.

---

## 9. Mesajlaşma ve mailler

Kanal: LinkedIn · E-posta · WhatsApp. Şablon A/B varyantı yok.

### 9.1 Aday kartında mesaj alanı (v3)

- Kart açılınca mesaj metni **doğrudan görünür ve düzenlenebilir**. Sıra:
  `draft_text` varsa o, yoksa "Taslak oluştur" düğmesi.
- Şablon seçimi ana akıştan çıkar. Küçük **"Şablondan başla"** bağlantısı kalır;
  şablonlar `templates.jsx`'te durmaya devam eder (silinmez).
- Üç yardımcı aksiyon: **Düzenle · Yeniden yaz (AI) · Kopyala.**
- Ana aksiyon: **"Mesajı attım"** → `sendTouch`: temas kaydı oluşur, aday
  Havuz'daysa Temas'a geçer, `follow_up_at` +7 gün.
- Kanal seçimi (LinkedIn / e-posta / WhatsApp) **"Mesajı attım" anında** sorulur,
  önceden değil. Son kullanılan kanal varsayılan.
- **Kopyalama artık hiçbir şeyi tetiklemez** — sadece panoya kopyalar.
- `hub_touches` kaydında `channel` doğru, `template_id` null olabilir.

### 9.2 Görüşme kararı maili  *(C2)*

Görüşme aşamasındaki kartta **"Görüşme kararı"** bloğu (rubrik + notun altında):
- **Olumlu — denemeye davet** → mail metni hazır gelir (şablon `sourceType='invite'`
  varsa o, yoksa gömülü varsayılan; `{{ad}}` doldurulur). Onaylanınca aday
  `trial`'a geçer (rubrik/eşik kapısı geçerli).
- **Olumsuz — nazik ret** → hazır ret metni; onaylanınca aday arşive (`we_passed`
  / `below_bar` seçilir).

`send-mail` (Resend) üzerinden, **otomatik değil** — kullanıcı metni düzenleyip
Gönder'e basar. Adayın e-postası yoksa mail kutucuğu kapalı gelir, karar yine
verilebilir. Gönderilen mail (davet **veya** ret) `hub_touches`'a
`channel: 'email'`, `outcome: 'pending'`, `note: <konu>` kaydı olarak düşer.
Aşama değişmeden önce mail gönderilir — mail patlarsa aşama değişmez.

### 9.3 Kapı A/B görev maili  *(C3)*

`GateStartForm` (Kapı A ve B başlatma): görev metni + **"Görevi mail ile
gönder"** kutucuğu (aday e-postası varsa varsayılan açık) + düzenlenebilir
konu/metin. Metin boş bırakılırsa görev + son teslim tarihinden otomatik
oluşturulur. Tek akış:
- Mail açık → `sendCandidateMail` (`send-mail` + `hub_touches` `channel:'email'`)
  sonra `startGate`. `due_at` bu anda hesaplanır — süre mail gönderilince başlar.
- Mail kapalı / e-posta yok → yalnızca `startGate` (görev elden iletildi).

### 9.4 "Ekibe al" — gerçek team entegrasyonu  *(C4)*

Şema (canlı döküm): `people.id` **text** (default yok), `people.project_id`
bigint → `startups.id`; `startups.member_ids` **text[]** (`people.id`
değerlerini tutar); `app_state.data` boş — takım/roster modeli **`people` +
`startups.member_ids`** üzerinde, `app_state`'e dokunulmaz.

`moveToTeam` → **`hub-move-to-team` edge function** (servis rolü; client RLS
`people`/`startups` yazamaz). Adımlar, her biri ayrı `try/catch`, patlayan adım
`warnings`e:
1. Aşama → `member` (+ `joined_at`, `vesting_start_date` = Kapı A ilk günü)
2. `people` kaydı — `id = crypto.randomUUID()`, `name`, `role_tr/en` = rol
   başlığı, `type = 'project_member'` (proje varsa; yoksa `'team'`),
   `project_id` = rolün `startup_id`'si
3. `startups.member_ids` dizisine `people.id` eklenir (`team` sayacı bir artar)
4. `invite-member` (`area:'team'`) → auth hesabı + tek kullanımlık link;
   markalı davet maili `send-mail` ile gider
5. `hub_candidates.person_id` geri yazılır (kolon: 0016 — text), bağlı rol → `filled`

Yetki: fonksiyon çağıranın JWT'siyle `hub_role()` kontrol eder (cofounder/recruiter).
Kısmi durum kullanıcıya gösterilir ("Kısmen aktarıldı — …"), sessizce yutulmaz.
Env: `SUPABASE_ANON_KEY` / `SERVICE_ROLE_KEY` / `SUPABASE_URL` platformdan gelir.

**"Ekibe al" onayı (`TeamMoveConfirm`):** düğme doğrudan tetiklemez; bir onay
paneli açılır. Aday bir açık role **bağlı değilse** güçlü uyarı gösterilir
("Bu aday bir projeye bağlı değil. Ekibe alırsan hesabı açılır ama hiçbir
takımı göremez.") + aynı panelde açık rol seçimi (`sourcing`/`shortlist`).
Kullanıcı rol seçerse önce `linkCandidateRole`, sonra `moveToTeam`. Rol
seçmeden **"Yine de devam et"** ile ilerleyebilir — engelleme yok, uyarı var.

> **`/team/` boş durumu (repo dışı):** `public/team/index.html` bundler
> çıktısı — kaynağı repoda YOK, minified. Takımı olmayan bir kullanıcı giriş
> yapınca panel çöküyor ("Bir sorun oluştu"). Boş durum ("Henüz bir projeye
> atanmadınız…" + Çıkış) o bundle'ın kaynağında düzeltilmeli; Hub tarafından
> yapılamaz.

### 9.5 Inbound bağlantısı

Admin panelindeki Başvurular ekranı → başvuru detay panelinde
**"Kurucu Hattı'na aday olarak aktar"**:
- `hub_candidates`: `source: 'inbound'`, `source_ref: <applications.id>` (text),
  `stage: 'pool'`
- Ad → `full_name`, e-posta → `email`, LinkedIn/portfolyo → `link` (tip
  otomatik), üniversite + bölüm → `university`
- `why_this_one` başvuru metninden (`intent` / proje / beceriler / bio)
  ön-doldurulur, kullanıcı düzeltebilir — **boşsa Aktar pasif**
- Açık rol seçimi opsiyonel (yalnızca `sourcing` / `shortlist` roller)
- Aynı başvuru iki kez aktarılamaz — insert öncesi `source_ref` kontrolü +
  aktarılmış başvurular "Aktarıldı ✓" gösterir
- Düğme yalnızca **hub yazma yetkisi olan** (cofounder / recruiter) kullanıcıya
  görünür; asıl kapı RLS (`hub_cand_write`). Admin app'in yetki alanı ayrı
  olduğu için kontrol `hub_role()` RPC'si ile yapılır.
- Aday e-postası zaten Hub'da varsa (`hub_cand_email_uq`) anlaşılır hata verir,
  kayıt açılmaz

### 9.6 Otomatik mailler (aday iletişimi DEĞİL — süreç maili)

İzin verilen tek otomatik mail sınıfı: sistemin kendi bildirim/karşılama
mailleri. `hub-weekly` özeti aktif cofounder'lara; `invite-member` karşılama
maili. Aday iletişimi (ilk mesaj, takip, ret) **her zaman insan onaylı**.

---

## 10. Roller

`0005_hub_roles.sql` sadeleşmiş hâliyle çalışır. Durum makinesi:
**Taslak → Aranıyor → Kısa liste → Dolduruldu.** Rol oluşturulunca doğrudan
**Aranıyor**'a düşer (talep/onay el sıkışması yok). `assigned_to` tek alanla
seçilir. `presented_at` / `owner_decision` / `owner_decision_note` kalır.

`roles.jsx` formu 5 alan: proje, başlık, aranan profil, beceriler, sorumlu.

Aday role bağlanınca **`track` rolden miras alınır** (`inheritedTrack`). Rol
atanmamış adayın track'i varsayılan kalır ve **sorulmaz**. Yalnızca cofounder,
aday kartındaki küçük menüden track'i elle değiştirebilir.

### 10.1 Yetki

`0009_permissions.sql` / `permission_presets` / `has_perm()` üç rolü ayırır:

| | cofounder | recruiter | project_owner |
|---|---|---|---|
| Aday havuzunun tamamı | ✓ | ✓ | yalnızca kendine sunulan |
| Rubrik puanla | ✓ | ✓ | ✓ |
| Kabul/ret ver (`decide`) | ✓ | ✗ | ✓ |
| Aşama atlama override | ✓ | ✗ | ✗ |
| Track elle değiştir | ✓ | ✗ | ✗ |
| Üye/yetki yönetimi | ✓ | ✗ | ✗ |
| Rol oluştur | ✓ | ✓ | ✓ |
| `candidates.purge` (KVKK silme) | ✓ | ✗ | ✗ |

`roles.jsx`, Bugün, Arşiv `has_perm()` ile gösterilir/gizlenir. Admin'deki
inbound düğmesi `hub_role()` ile (admin app'in yetki alanı ayrı — §9.5).

---

## 11. Kaynaklar ve metrikler  *(E1)*

`sources.jsx` geri bağlandı → **Yönetim → Kaynaklar** (`perm: 'sources.read'`).
Sadece **kütük** (nereden avlanılıyor) + verim; GitHub taraması E5'e taşındı.
`store` koleksiyonlarına `sources` eklendi. Kütük satırı: ad (spesifik) · tip ·
sıklık · son kontrol · sorumlu · **Aday / Cevap % / İşe alım** · durum. 8 haftadır
cevap+işe alım yoksa "pasifleştir öner".

**Metrikler (`metrics.jsx`) — 3 kart + kaynak verimi:**
- 3 kart: cevap oranı · Görüşme→Deneme · 90 günde aktif (değişmedi).
- "Kaynak verimi" tablosu: `hub-metrics.sourceStats` — anahtar **`source_detail`**
  ("Teknofest 2026 ulaşım kategorisi"), yoksa `source`. Sütun: Aday · Temas ·
  **Cevap %** · **İşe alım**. İşe alıma / cevaba göre sıralı (verimli üstte).
  Aday sayısı artık omurga değil.

Haftalık hedef: Havuza 10, Temasa 6.

---

## 12. Otomatik işler ve uzun vade

Mevcut altyapı: `supabase/functions/send-mail` (Resend),
`invite-member` (`area: 'team' | 'admin' | 'hub'`). **Yeni mail altyapısı kurulmaz.**

### 12.1 Gece / haftalık işler  *(C1 — kod hazır, cron kurulumu elle)*

`hub-daily` + `hub-weekly` aşama adları 0011'e göre düzeltildi
(`contacted`→`contact`, `interviewed`→`interview`, `finalist`/`gate_*`→`trial`,
`joined`→`member`). Cron `0015_hub_cron.sql` ile kurulur (eski
`_deferred/0004_hub_cron.sql` silindi): Vault'a `project_url` +
`service_role_key` secret'ları eklenir, önce fonksiyonlar elle tetiklenip
gerçek sayı döndürdüğü doğrulanır, sonra migration çalıştırılır.

`hub-daily` sorumlulukları: süresi gelen takipleri üret; `no_reply` adayları
arşivle; süresi geçen kapıları `failed` yap; **KVKK: `retain_until` geçmiş ve
`member` olmamış kayıtları sil/anonimleştir** (§12.3).

### 12.2 Takip zinciri (E2) — *kod hazır*

`hub_touches.step_no` (1 ilk mesaj · 2 gün-4 · 3 gün-8), `hub_templates.sequence_key`
(zincir grubu) — migration **0020**.

`hub-daily` `contact` aşamasındaki, cevap gelmemiş adaylar için:
- İlk mesajdan **≥ 4 gün** geçti ve `step_no` en fazla 1 ise → adım 2 hazırla.
- **≥ 8 gün** ve `step_no` ≤ 2 ise → adım 3 hazırla.
- **≥ 12 gün** ve adım 3 de yapıldıysa → `archived` / `no_reply`.

"Hazırla" = önceki `pending` touch `no_reply` olur; yeni `pending` touch
(`step_no`, `follow_up_at = now`, `note` = zincir metni) eklenir → Bugün ekranı
"Süresi gelen takipler" bloğunda görünür (`#2` / `#3` + "taslak hazır"); aynı
metin `candidate.draft_text`'e yazılır (kart açılınca hazır). **Gönderim yine
insanla** — hub-daily hiçbir mesaj göndermez.

Zincir metni: `sequence_key` gruplu şablonlar (ada göre sıralı, adım N için
(N-1). şablon); yoksa gömülü hatırlatma. Şablon editöründe "Zincir anahtarı"
alanı var.

### 12.3 KVKK saklama (E3) — *kod hazır*

- `hub-daily` §5: `retain_until < bugün` **ve** `stage != 'member'` olan kayıtları
  **tamamen siler** (touches/gates/stage_log FK cascade). Rapor: `kvkkPurged`.
  Ekipte adaya dokunulmaz. `retain_until` yeni adaylarda +1 yıl (0001 default /
  `importCandidates`).
- **Aydınlatma:** `{{kvkk}}` şablon değişkeni → `KVKK_NOTICE_LINE`
  (`hub-constants`). Şablon editörü ilk-temas şablonunda `{{kvkk}}` yoksa uyarır.
  Aday kartı "Mesaj" alanı, Havuz'da metinde KVKK URL yoksa **"Satırı ekle"**
  düğmesi gösterir.
- **Silme yetkisi:** UI purge yolları (`candidates-list` satır aksiyonu +
  `settings` KVKK bölümü) `has_perm('candidates.purge')` ile; satır aksiyonuna
  ek koruma eklendi.

### 12.4 Eski adayları yeni role hatırlat (E4) — *kod hazır*

`hub-match.js` geri bağlandı. `suggestArchivedFor(role, candidates)`: arşivde,
sebep `no_time` / `below_bar`, `matchScore ≥ 2` adaylar. Bugün ekranında
**"Yeni rol için arşivden aday"** bloğu — `sourcing` roller için, aday başına en
iyi rol, tıklayınca kart. **Yalnızca havuz ≥ `MATCH_MIN_POOL` (100)** olunca
görünür (altında gürültü). Yeniden bağlama insanın işi (kart menüsü).

### 12.5 GitHub taraması (E5, opsiyonel araç) — *kod hazır*

- **`hub-github-scan` edge function** (yeni): arama + kişi başına profil/repo
  çekimi + `computeEnrichment` / `prescoreFinishing` / `whyThisOne` **sunucuda**.
  Token `HUB_GITHUB_TOKEN` secret'ı — **tarayıcıya inmez**. Yetki: `hub_role()`
  cofounder/recruiter. Edge timeout için `limit ≤ 8`, derin analiz yok.
- **`github-import.jsx`** (yeni): Adaylar → aksiyon menüsünde **"GitHub"**
  (`scan.run` yetkisi) — ayrı ekran değil. Parametre formu → Tara → önizleme
  (ön puan + "neden bu kişi" + kanıt repoları) → `importCandidates` (source
  `github`). Ardından "Hepsine taslak" (bulk-draft).
- Eski `hub-github.js` / `hub-enrich.js` (tarayıcı) artık **kullanılmıyor**
  (`hub-enrich`'in saf fonksiyonları hâlâ testli). Eski `sources.jsx`'teki
  `GitHubScan` E1'de kaldırıldı; `components/unknowable.jsx` bağlantısız.
- `enrichment` → `ai_score` **öneri**; `score_communication` / `score_capacity`
  boş kalır (görüşmeden). Rubriğin yerine geçmez.

### 12.6 Team'den Hub'a geri besleme (E6) — *plumbing hazır, veri kaynağı bekliyor*

**Kontrat:** `active90(candidates, stageLog, now, { productionByPerson })` —
`productionByPerson` `{ [person_id]: { lastActiveAt?, tasksDone?, ctoApproved? } }`
verilirse "aktif" = son 90 günde aktiflik **veya** tamamlanmış görev **veya** CTO
onayı (kişi C4'te yazılan `hub_candidates.person_id` ile eşleşir). Verilmezse eski
davranış: hâlâ `member` aşamasında mı. Dönüşteki `source` (`production` /
`stage_log`) metrik kartında gösterilir.

**Eksik:** `/team/` bu sözlüğü henüz üretmiyor — `app_state.data` boş `{}`,
bundle repo dışı (§12.7). O taraf `{ personId: {...} }` verisini bir tabloya ya
da `app_state.data.hubFeedback`'e yazdığında `metrics.jsx` onu okuyup
`productionByPerson` olarak geçirir; kod yolu hazır. §9.4 (C4) kuruldu.

### 12.7 `/team/` paneli — boş üyelik durumu  *(repo dışı, Fix 1)*

> `public/team/index.html` bir **build artefaktıdır**; kaynağı bu repoda **yok**.
> Bu bölüm, o bundle'ın kaynağı bulunduğunda uygulanacak değişikliğin
> şartnamesidir — Hub tarafından yapılamaz.

**Sorun:** Panel, giriş yapan kullanıcının bir takıma bağlı olduğunu varsayıyor.
C4 ile ekibe alınan ama henüz bir projeye bağlanmamış kullanıcı (veya
`startups.member_ids`'te id'si olmayan herhangi biri) girişte boş/eksik veri
alıyor ve panel çöküyor ("Bir sorun oluştu, tekrar dene").

**Değişiklik:**
1. **Kaldırılacak varsayım:** "giriş yapan kullanıcının en az bir takım
   üyeliği/projesi vardır". Üyelik sorgusu boş dönebilir — bu bir hata değil,
   geçerli bir durum.
2. **Boş durumda gösterilecek** (çökme yerine): sakin bir ekran —
   *"Henüz bir projeye atanmadınız. Bir kurucu sizi bir takıma eklediğinde
   projeniz burada görünecek."* + **Çıkış** düğmesi. Panelin geri kalanı
   (proje seçici, görev listesi, vb.) render edilmez.
3. **Sonradan eklenince:** kullanıcı bir takıma eklendikten sonra **yeniden
   giriş** ya da **sayfa yenileme** ile normal panel açılmalı — ekstra bir adım,
   davet veya elle işlem gerekmemeli. (Üyelik verisi her açılışta yeniden
   sorgulandığı için otomatik düzelir.)

Kapsam dışı: gerçek zamanlı güncelleme (kullanıcı açıkken eklenirse anında
görme) gerekmez; yenileme yeterli.

---

## 13. Veritabanı

**7 tablo:** `hub_members`, `hub_open_roles`, `hub_candidates`, `hub_stage_log`,
`hub_touches`, `hub_gates`, `hub_templates`.

**Geri bağlanan:** `hub_source_registry` (§11).

**`hub_candidates` — v3 etkinleşen / eklenen:** `why_this_one` (zorunlu, uygulama
katmanı), `interview_note` (text), `source_detail` (text), `evidence` (jsonb),
`person_id` (§9.4, yoksa eklenir).

**`hub_candidates` — düşürülmeyen ama yazması duran:** `red_flags`, `flag_notes`,
`override_reason` (bayrak dalı), `next_action`, `next_action_at`, `next_action_link`.
Gerçek `drop column` ayrı migration + teyit.

**`hub_touches`:** `step_no` (E2). **`hub_templates`:** `sequence_key` (E2).

Migration'lar **`0013`'ten** devam eder. Her migration idempotent (`if not exists`,
`drop … if exists`) ve tek konulu. `drop column` yapılmaz — kolon UI'dan gizlenir,
gerçek drop ayrı migration'da ve teyitle.

`0015_hub_cron.sql` §12.1'de kurulur. RLS politikaları değişmeden kalır.

---

## 14. Dokunulmayanlar

- `canAdvance()` reddederken sebep gösterme davranışı
- Arşiv sebebi zorunluluğu
- `hub_stage_log` / `hub_touches` kayıtları (görünmez ama tutulur)
- 90 gün aktiflik metriği
- Otomatik aday-iletişimi yasağı, LinkedIn kazıma yasağı
- RLS'in tek kapı olması, ayrı Supabase istemcisi kurulmaması
- Router kütüphanesi kullanılmaması (`useState` + `sessionStorage`)
- Yeni tablolarda `uuid` + `gen_random_uuid()`

---

## 15. Yapılmayacaklar (bilinçli ret)

- LinkedIn/GitHub DOM okuyan tarayıcı eklentisi / bookmarklet
- GitHub `.patch` dosyalarından gizli e-posta toplama
- Aşama sayısını artırmak (8→5, geri alınmaz)
- Ücretli e-posta bulma servisleri (Hunter.io, Proxycurl)
- Adayı dışarıya açan parola korumalı paylaşım linki
- Otomatik mesaj gönderimi (dizi mesajları dahil)
- Takvim entegrasyonu, teklif/sözleşme modülü, işe başlangıç kontrol listesi
- Kayıtlı görünümler, sütun konfigürasyonu, hücre içi düzenleme

---

## Özet — v2 → v3

| | v2 | v3 |
|---|---|---|
| Ekran | 3 | 4 (+ Arşiv) |
| Aday kartında karar noktası | şablon + kopya-kilit + bayrak + track + next_action | mesaj + karar + rubrik |
| Zorunlu serbest metin | 1 (kişiselleştirme) | 1 (`why_this_one`) |
| `next_action` | elle | türetilir |
| Kırmızı bayrak | 4, 2'sinde kilit | yok (serbest not) |
| Ana içe aktarma | CSV | yapıştır-ayrıştır |
| Geri alma | yok | var — ekibe alma dâhil (C4 öncesi); kapı sonucu hariç |
| Team entegrasyonu | yok (sahte) | gerçek (`people` + `invite-member`) |
