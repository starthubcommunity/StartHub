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

`hub_stage_log` zaten `from_stage` tutuyor; v3 arayüzünü ekler.

- Aşama değişikliğinden sonra kartta **"Geri al"** görünür.
- Geri alma: adayı `from_stage`'e döndürür, `hub_stage_log`'a
  `reason: 'geri alındı'` ile **yeni satır** yazar (eski satır silinmez).
- Arşivleme de geri alınabilir (`archive_reason` → null).
- **Geri alınamaz:** kapı sonucu (`passed`/`failed`) ve `moveToTeam`. Bu ikisi
  için düğme gösterilmez; sebebi kısa bir ipucuyla belirtilir.

---

## 3. Aday kartı

Sekme yok. Kart, adayın bulunduğu aşamanın alanlarını gösterir.

**Üst şerit (her aşamada, form değil, etiket):** ad · **rol** · **hat** ·
kaynak · sorumlu · aşama. Rol ve hat burada birer `.adm-chip` — aşama değiştikçe
tekrar sorulmaz.

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
bırakır) geri bağlanır. Akış:

1. Yapıştır (hackathon sonuç sayfası, etkinlik listesi, tablo)
2. Ayrıştırılmış satırlar tabloda görünür — satır bazlı al/atla
3. Kaynak + parti etiketi + **tüm partiye uygulanacak ortak "neden bu kişi" cümlesi**
   (ör. "Teknofest 2026 ulaşım kategorisi finalisti")
4. Onayla → Havuz

**Tekilleştirme** (önizlemede ve elle eklerken):
- E-posta tam eşleşme → kesin tekrar
- GitHub kullanıcı adı / LinkedIn slug eşleşme → kesin tekrar
- Ad benzerliği (`similar() > 0.8`) + aynı okul → olası tekrar, uyar

Tekrar bulununca: **atla** veya **mevcut kartı güncelle** (yeni kayıt açma).

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
Üstte ilerleme (7/20), altta günlük sayaç, `Ctrl+Z` geri al. Kısayollar sadece bu
ekranda, input odaktayken devre dışı.

---

## 7. AI taslak üretimi

**Tekli:** kartta mesaj alanında "Taslak oluştur / Yeniden yaz (AI)" → tek API
çağrısı → `draft_text` → insan düzenler.

**Toplu:** içe aktarma sonrası **"Hepsine taslak oluştur"** → tarayıcıda sırayla,
ilerleme çubuğuyla, ayrı kuyruk/worker yok.

**Girdi (v3):** `whyThisOne` ve `sourceDetail` **birincil kaynak**. GitHub verisi
varsa ek girdi, zorunlu değil. Sistem promptundaki "somut bir esere atıf yap"
kuralı korunur ama eser GitHub reposu olmak zorunda değil (proje, başvuru,
etkinlik, yayın).

**Veri yeterliliği (`canDraftAI()`):** `sourceDetail` / `whyThisOne` / `evidence`
hepsi boşsa taslak üretilmez — *"Veri yetersiz, elle yaz."* v3'te `why_this_one`
zorunlu olduğu için bu alan pratikte her adayda dolu olur.

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

### 9.2 Görüşme kararı maili

Görüşme sonrası karar verilince ilgili mail **hazır gelir, kullanıcı onaylayıp
gönderir** (otomatik gitmez — aday iletişimi):
- Olumlu → denemeye davet
- Olumsuz → nazik ret

`send-mail` (Resend) üzerinden. Adayın e-postası yoksa düğme "e-posta yok" der,
karar yine verilebilir. Gönderilen ret maili `hub_touches`'a `channel: 'email'`
kaydı olarak düşer.

### 9.3 Kapı A/B görev maili

Kapı başlatılırken "Görevi mail ile gönder" seçeneği: görev metni + son teslim
tarihi mailde gider, `startGate` aynı anda çalışır (süre mail gönderilince
başlar). Mail gönderilmeden de kapı başlatılabilir (elden iletildiyse).

### 9.4 "Ekibe al" — gerçek team entegrasyonu

`moveToTeam` bugün sadece aşamayı `member` yapıyor. v3'te tek düğme sırayla:
1. `people` kaydı oluştur (Team app tablosu) — ad, e-posta, `startup_id`
2. İlgili takıma üye olarak ekle (rol: member)
3. `invite-member` fonksiyonunu `area: 'team'` ile çağır → hesap açılır, markalı
   şifre belirleme maili gider
4. `hub_candidates.person_id`'yi geri yaz (kolon yoksa ekle)

**Team tablo yapısı varsayılmaz — önce incelenir.** Adımlardan biri patlarsa
kısmi durum kullanıcıya gösterilir ("hesap açıldı, takıma eklenemedi"), sessizce
yutulmaz. `moveToTeam` geri alınamaz (§2.4).

### 9.5 Inbound bağlantısı

Admin panelindeki Başvurular ekranına **"Kurucu Hattı'na aday olarak aktar"**:
- `hub_candidates`: `source: 'inbound'`, `source_ref: applications.id`, `stage: 'pool'`
- Ad, e-posta, link başvurudan taşınır
- `why_this_one` başvuru metninden ön-doldurulur, düzeltilebilir
- Açık rol seçimi opsiyonel
- Aynı başvuru iki kez aktarılamaz (`source_ref` kontrolü)
- `has_perm('candidates.write')` yoksa düğme görünmez

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

`roles.jsx`, Bugün, Arşiv, inbound düğmesi `has_perm()` ile gösterilir/gizlenir.

---

## 11. Kaynaklar ve metrikler

`hub_source_registry` + `sources.jsx` geri bağlanır. Kaynak = "hackathon" değil,
**"Teknofest 2026 ulaşım kategorisi"** düzeyinde (`source_detail`).

**Metrikler (`metrics.jsx`) — 3 metrik:**
- Kaynak başına **cevap oranı ve işe alım sayısı** (aday sayısı değil)
- Görüşmeden Deneme'ye geçiş oranı
- 90 günde hâlâ aktif (uzun vadede gerçek üretim verisinden — §12.6)

Haftalık hedef: Havuza 10, Temasa 6.

---

## 12. Otomatik işler ve uzun vade

Mevcut altyapı: `supabase/functions/send-mail` (Resend),
`invite-member` (`area: 'team' | 'admin' | 'hub'`). **Yeni mail altyapısı kurulmaz.**

### 12.1 Gece / haftalık işler

`hub-daily` + `hub-weekly` yazılmış, zamanlanmamış. Elle tetikle, çıktı doğrula,
`hub-daily` içindeki aşama adlarını 0011 ile gelen değerlere göre düzelt
(`contacted` → `contact`, `interviewed` → `interview`). `0004_hub_cron.sql`'i
`_deferred/`'den çıkar, `<PROJECT_REF>` doldur, servis anahtarını Vault'tan oku,
deploy et.

`hub-daily` sorumlulukları: süresi gelen takipleri üret; `no_reply` adayları
arşivle; süresi geçen kapıları `failed` yap; **KVKK: `retain_until` geçmiş ve
`member` olmamış kayıtları sil/anonimleştir** (§12.3).

### 12.2 Takip zinciri (E2)

`hub_touches.step_no`, `hub_templates.sequence_key`. `hub-daily` gün 4 ve gün 8'de
sıradaki mesajı hazırlayıp Bugün ekranına **görev olarak** düşürür. Gönderim yine insanla.

### 12.3 KVKK saklama (E3)

`kvkk_consent`, `kvkk_at`, `retain_until` kolonları kullanılmaya başlanır.
`hub-daily` süresi geçmiş ve `member` olmamış kayıtları siler/anonimleştirir. İlk
mesaj şablonuna aydınlatma bağlantısı eklenir. `candidates.purge` yetkisi silme
akışına bağlanır.

### 12.4 Eski adayları yeni role hatırlat (E4)

Yeni rol `sourcing`'e düşünce, arşivdeki `no_time` / `below_bar` sebepli ve benzer
beceri etiketli adayları Bugün ekranında öner. `hub-match.js` burada — ama havuz
100+ adaya ulaşmadan açılmaz.

### 12.5 GitHub taraması (E5, opsiyonel araç)

`hub-github.js` + `hub-enrich.js` geri bağlanabilir: token tarayıcıda tutulmaz,
edge function proxy'sine taşınır; ayrı ekran değil, aday ekleme yöntemlerinden
biri; `enrichment` rubriğin yerine geçmez, sadece ön puan önerir.

### 12.6 Team'den Hub'a geri besleme (E6)

Team'deki tamamlanan görev sayısı ve CTO onayları Hub'a akar. "90 günde hâlâ
aktif" metriği `stage_log` yerine gerçek üretim verisinden hesaplanır. §9.4
kurulmadan yapılamaz.

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

`0004_hub_cron.sql` §12.1'de deploy edilir. RLS politikaları değişmeden kalır.

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
| Geri alma | yok | var (kapı/team hariç) |
| Team entegrasyonu | yok (sahte) | gerçek (`people` + `invite-member`) |
