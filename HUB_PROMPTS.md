# Kurucu Hattı — Adım Adım Claude Code Promptları

Her adımı sırayla yapıştır. Bir adım onaylanmadan diğerine geçme.
Şartname: `HUB_SPEC.md` · Proje kuralları: `CLAUDE.md`

---

## Her adımdan sonra — commit deseni

⚠️ **`git add -A` KULLANMA.** Çalışma kopyasında hub ile ilgisi olmayan eski
değişiklikler var (silinmiş `public/logo-*.png`, `screenshots/`, `uploads/`).
Hepsini birden commit'lersen canlı sitede favicon ve paylaşım görseli kırılır.

Her adım sonunda yalnızca o adımda değişen dosyaları ekle:

```
git add <o adımda oluşan/değişen dosyalar>
git commit -m "hub: adim N - <kısa açıklama>"
git push
```

---

## Adım 1 — İskelet ✅ tamamlandı

```
Bu repoda yeni bir iç uygulama kuracağız: Kurucu Hattı (/hub).

Tam şartname repo kökündeki HUB_SPEC.md dosyasında. ÖNCE onu baştan sona oku,
sonra aşağıdaki çalışma kurallarına uy.

ÇALIŞMA KURALLARI

1. Şartname bağlayıcıdır. Bir şey belirsizse veya sana yanlış geliyorsa
   KOD YAZMADAN ÖNCE SOR. Sessizce kendi tasarımını uygulama.

2. Mevcut kodda yalnızca iki dosyaya dokunabilirsin:
   - vite.config.js  (yeni giriş noktası)
   - vercel.json     (/hub rewrite'ı)
   Başka hiçbir mevcut dosya değişmeyecek. /, /admin/ ve /team/ bozulmayacak.

3. Yeni bağımlılık ekleme. Özellikle react-router EKLENMEYECEK.

4. Kod stili ve proje kuralları CLAUDE.md ve HUB_SPEC.md §4'te.

5. §4.6'daki dört tuzağı oku ve tekrarlama.

NASIL İLERLEYECEĞİZ

§11'de 15 adım var. Aynı anda TEK ADIM yap. Adımı bitirince ne yaptığını
özetle, kabul kriterini nasıl doğruladığını söyle, dur ve onay bekle.

Şimdi Adım 1 ile başla: iskelet.
```

---

## Adım 2 — Şema

```
Adım 1 onaylandı. Adım 2'ye geç: veritabanı şeması.

HUB_SPEC.md §6'daki SQL bloğunu supabase/migrations/0001_hub.sql olarak yaz.
Bloğu BİREBİR aktar — kendi eklemen, "iyileştirmen" veya kolon değişikliğin olmasın.
Şemayla ilgili bir sorun görüyorsan yazmadan önce söyle.

Dosyayı oluşturduktan sonra DUR. SQL'i Supabase panelinde ben çalıştıracağım
ve doğrulama sorgusunun sonucunu sana bildireceğim.
```

**Sen ne yapacaksın:** Supabase → `SQL Editor` → `New query` → dosyanın içeriğini yapıştır → `Run`.
Sonra §6 sonundaki doğrulama sorgusunu çalıştır, `linked` sütununa bak.
**Kabul:** tablolar oluştu, RLS açık, iki `hub_members` satırı var.

---

## Adım 3 — Auth + rol kapısı

```
Adım 2 tamam, şema Supabase'de çalıştırıldı. Adım 3'e geç: auth ve rol kapısı.

HUB_SPEC.md §5.1 ve §5.2'yi uygula:
- src/lib/supabase.js'teki MEVCUT istemciyi import et. Yeni createClient ÇAĞIRMA.
- Açılış akışı §5.2'deki beş adım: oturum yok → giriş; oturum var ama rol yok →
  "erişiminiz yok" ekranı; rol var → uygulama.
- Rolü supabase.rpc('hub_role') ile çek, context'e koy, localStorage'a YAZMA.
- Giriş ekranı için src/admin/admin-app.jsx'teki AuthShell / LoginPage /
  SetNewPasswordPage desenini izle. Hub'da "Kayıt ol" bağlantısı OLMAYACAK.
- onAuthStateChange dinlenecek; SIGNED_OUT ve PASSWORD_RECOVERY ele alınacak.

Kabul kriteri §5.3'teki altı satırlık tablo. Bitirince hepsini tek tek nasıl
doğruladığını yaz.
```

---

## Adım 4 — Store, mappers, sabitler

```
Adım 3 onaylandı. Adım 4'e geç: veri katmanı.

Oluştur:
- src/hub/hub-constants.js — aşamalar, kaynaklar, arşiv sebepleri, rol tipleri,
  veri güveni, kırmızı bayrak listesi, rubrik metinleri, eşik değerleri.
  Hepsi HUB_SPEC.md §2'den. Sabit listeler tek kaynaktan gelsin.
- src/hub/hub-mappers.js — mapCandidateToDb / mapCandidateFromDb ve diğer
  tablolar için aynısı. src/admin/admin-store.jsx'teki mapper desenini birebir izle.
- src/hub/hub-store.jsx — Supabase CRUD + React context.
  admin-store.jsx desenini izle: paralel yükleme, patchLocal ile optimistic
  update, hata durumunda geri alma.

DİKKAT: id üretme hack'i (nextId) YOK. Tüm hub tabloları uuid default'lu,
insert'te id gönderme.

Kabul: tarayıcı konsolundan aday ekle / güncelle / sil çalışıyor ve sayfa
yenilenince veri Supabase'den geliyor.
```

---

## Adım 5 — Kural motoru

```
Adım 4 onaylandı. Adım 5'e geç: kural motoru.

src/hub/hub-rules.js — saf, yan etkisiz fonksiyonlar (§9):
  canAdvance(candidate, toStage) -> { ok, reason }
  thresholdMet(candidate) -> boolean
  isStale(candidate, now) -> { stale, level, days }
  gateStatus(gate, now) -> 'running' | 'due' | 'overdue'

canAdvance kontrolleri §9'da listeli. Özellikle:
- finalist'e geçiş: toplam >= 10 VE hiçbir eksen <= 2 VE kırmızı bayrak < 2
  (ya da rol cofounder ve override_reason dolu)
- archived'a geçiş: archive_reason zorunlu
- interviewed'a geçiş: rubrik üç eksen de dolu

Bu mantık BAŞKA HİÇBİR YERDE tekrarlanmayacak; arayüz hep bu fonksiyonları çağıracak.

Yanına birkaç örnek senaryoyu doğrulayan basit bir test dosyası yaz
(node ile çalışacak sade bir script yeter, test kütüphanesi ekleme).

Kabul: puanları 5-5-1 olan aday finalist olamıyor; 2 bayraklı aday cofounder
override'ı olmadan geçemiyor; sebepsiz arşivleme reddediliyor.
```

---

## Adım 6 — Tablo görünümü

```
Adım 5 onaylandı. Adım 6'ya geç: tablo görünümü — sistemin asıl çalışma ekranı.

HUB_SPEC.md §8.2'yi tam uygula. Öncelik sırası:
1. Aday ekleme — üç yol, özellikle "+ Yeni aday" satır içi ekleme.
   Zorunlu alanlar: full_name, en az bir iletişim, source. data_trust
   varsayılanı 'declared'.
2. Hücre içi düzenleme, Tab/Enter ile ilerleme, Esc iptal
3. Çoklu seçim (checkbox, Shift+tık aralık) → toplu işlem: aşama, sorumlu,
   etiket, arşivle
4. Sütun gizle/göster + sıra değiştirme, ilk sütun dondurulmuş
5. Çoklu sütun sıralama
6. CSV dışa aktarma (görünen sütunlar + aktif filtre)

Ayrıca §3'teki altı filtre grubunu içeren filtre çubuğu ve kayıtlı görünümler
(hub_views tablosu).

Optimistic UI: patchLocal ile önce yerel güncelle, sonra Supabase'e yaz, hata
olursa geri al.

Kabul: 100 satırlık veriyle hücre düzenleme, çoklu seçim ve toplu aşama
değiştirme takılmadan çalışıyor.
```

---

## Adım 7 — Aday kartı

```
Adım 6 onaylandı. Adım 7'ye geç: aday kartı.

HUB_SPEC.md §8.4 — sağdan açılan panel, üç sekme:
- Özet: kimlik, eğitim (yanında veri güveni etiketi), kanıt linkleri,
  why_this_one, sonraki aksiyon (zorunlu alan)
- Değerlendirme: üç eksenli puan girişi, AI ön puanı (salt okunur, "öneri"
  etiketli), kırmızı bayrak kutucukları + her birinin altında not alanı,
  eşik durumu göstergesi
- Geçmiş: temaslar, görüşmeler, kapılar, aşama günlüğü — tek zaman çizelgesi

Kırmızı bayraklar §2.4'teki sabit liste. İki veya daha fazla bayrak işaretliyse
kart finalist'e geçemez — bu kontrolü hub-rules.js'ten çağır, burada tekrar yazma.

Kabul: puan girildiğinde eşik göstergesi anında güncelleniyor; iki bayrak
işaretlenince finalist'e geçiş kilitleniyor ve sebep görünüyor.
```

---

## Adım 8 — Hat görünümü

```
Adım 7 onaylandı. Adım 8'e geç: hat (kanban) görünümü.

HUB_SPEC.md §8.3 — sekiz sütun (§2.2'deki aşamalar).
- Sürükle-bırak, ama canAdvance() false dönerse bırakma REDDEDİLİR ve
  reason toast olarak gösterilir.
- Kart üstünde: ad, üniversite, kaynak rozeti, toplam puan, sorumlu baş
  harfleri, bayrak sayısı (varsa kırmızı), bayatlık noktası.
- Sütun başlığında sayı + bir önceki aşamadan dönüşüm oranı.
- Tablo ile aynı filtre durumunu paylaşsın; görünüm değişince filtre korunsun.

Kabul: rubriği doldurulmamış bir adayı görüşme sütununa bırakmaya çalışınca
reddediliyor ve neden reddedildiği görünüyor.
```

---

## Adım 9 — Bugün ekranı

```
Adım 8 onaylandı. Adım 9'a geç: Bugün ekranı.

HUB_SPEC.md §8.1 — beş blok, tek sütun, her satırda tek tıkla aksiyon:
1. Gönderilecek mesajlar (haftalık hedef göstergesiyle: "bu hafta 6/15")
2. Süresi gelen takipler
3. Bugünkü görüşmeler + takvim linki
4. Bayatlamış kartlar
5. Süresi dolan kapılar

Boş blok gizlenir. Hepsi boşsa: "Bugün temiz. Havuza yeni aday eklemek ister misin?"

Bu ekranı uygulamanın VARSAYILAN AÇILIŞ sayfası yap.

Kabul: takip süresi geçmiş bir aday listede çıkıyor; blok boşken gizleniyor.
```

---

## Adım 10 — Şablonlar ve temas kaydı

```
Adım 9 onaylandı. Adım 10'a geç: şablonlar ve mesaj gönderme akışı.

HUB_SPEC.md §8.5 ve özellikle §8.5b'deki yedi adımlık akışı birebir uygula.

Kritik davranışlar:
- Kişiselleştirme satırı AYRI bir alan ve zorunlu. Boşken "Kopyala" butonu
  DEVRE DIŞI.
- "Kopyala" tıklaması tek bir işlemde şunları yapar: panoya kopyalar,
  hub_touches kaydı oluşturur, adayı contacted aşamasına taşır, 7 günlük
  follow_up_at kurar, şablonun sent_count sayacını artırır.
- Kopyalama anında kanal sorulur (linkedin / email / whatsapp).
- Aday kartında "Cevap geldi" işareti → aşama replied, şablonun reply_count artar.
- Şablon CRUD'u yalnızca cofounder rolünde açık.

Sistem HİÇBİR mesajı kendisi göndermez. "Toplu gönder" butonu yok ve olmayacak.

Kabul: kişiselleştirme boşken kopyalama kapalı; kopyalayınca aday contacted'a
geçiyor ve temas kaydı oluşuyor.
```

---

## Adım 11 — Kapı A / Kapı B

```
Adım 10 onaylandı. Adım 11'e geç: iki kapı.

HUB_SPEC.md §2.5 ve hub_gates tablosu.

- "Kapı A başlat": görev metni girilir, 72 saatlik sayaç kurulur, adaya
  gidecek metin hazırlanır. Aşama gate_a olur.
- "Kapı B başlat": proje seçilir, 10 günlük sayaç kurulur. Aşama gate_b olur.
  Team sistemine SADECE referansla bağlan (startup_id + person_id yaz);
  app_state JSON bloğunu okumaya veya yazmaya ÇALIŞMA (§4.6 madde 2).
- "Ekibe aktar": aşama joined olur, hak ediş başlangıç tarihi Kapı A'nın
  ilk günü olarak yazılır.
- Süresi dolan kapılar Bugün ekranında görünür.

Kabul: 72 saati geçmiş bir kapı Bugün ekranında beliriyor; Ekibe aktar
hak ediş tarihini Kapı A başlangıcına yazıyor.
```

---

## Adım 12 — Yetenek avı (üç parça)

Bu en büyük adım. Üçe böl, her parçayı ayrı onayla.

### 12a — Yapıştır ve ayrıştır + CSV + inbound

```
Adım 11 onaylandı. Adım 12a'ya geç: yapıştır-ayrıştır.

HUB_SPEC.md §8.6.3'ü birebir uygula — yedi adımlık akış.

En kritik kural: AI ASLA ALAN UYDURMAZ. Metinde geçmeyen üniversite, e-posta
veya link boş kalır. Çıkarım yapılan alan data_trust='guess', metinde açıkça
yazan alan 'declared' olur. Uydurma veri filtreyi ve sonraki tüm kararları
zehirler — bu kural pazarlık konusu değil.

Ayrıca:
- Ön izleme adımı ATLANAMAZ; ayrıştırma sonucu doğrudan kaydedilmez
- Ham metin hub_import_batches.raw_text'e saklanır
- Tekrar tespiti: ad benzerliği + link eşleşmesi
- Parti bilgisi (source, source_detail, tarih) tüm gruba tek seferde uygulanır
- CSV içe aktarma ve applications'tan inbound çekme de bu ekranda.
  applications kaydını TAŞIMA veya DEĞİŞTİRME — kopyala, source_ref'e id yaz.
- Her kayıtta kvkk alanları ve retain_until doldurulsun

Kabul: 40 satırlık bir hackathon sonuç metni yapıştırıldığında satırlara
ayrılıyor, metinde olmayan alanlar boş kalıyor, tekrarlar tespit ediliyor,
onaylanınca havuza düşüyor.
```

### 12b — GitHub taraması + zenginleştirme + AI ön puanı

```
Adım 12a onaylandı. Adım 12b'ye geç: GitHub taraması ve zenginleştirme.

HUB_SPEC.md §8.6.4, §8.6.5, §8.6.6, §8.6.7.

- GitHub REST API, kimlik doğrulamalı. Arama parametreleri arayüzden ayarlanır.
- Dakikada 30 istek sınırı: kuyruk + ilerleme çubuğu. Sınırı arayüzde yaz.
- Zenginleştirme §8.6.5'teki altı sinyali üretir ve enrichment jsonb alanına yazar.
- AI ön puanı YALNIZCA bitirmişlik eksenini tahmin eder. İletişim ve kapasite
  BOŞ BIRAKILIR — onlar görüşmeden çıkar. Bu üçünü de puanlamaya kalkma.
- ai_score insan puanının üstüne asla yazmaz, ayrı kolonda durur, arayüzde
  "öneri" etiketiyle soluk gösterilir.
- Ön puanın yanında güven seviyesi ve dayandığı kanıt gösterilir.
- "Neden bu kişi" cümlesi §8.6.7'deki dört kurala uyar: somut esere atıf,
  en fazla iki cümle, kişi hakkında sıfat yok, doğrulanamayan hiçbir şey yok.

Arayüzde §8.6.5'teki "kesinlikle çıkarılamayanlar" listesi de görünsün ki
kullanıcı sistemin ne bilmediğini bilsin.

Kabul: bir GitHub kullanıcısı tarandığında altı sinyal doluyor, ön puan
kanıtıyla birlikte görünüyor, iletişim ve kapasite boş kalıyor.
```

### 12c — Kaynak kütüğü

```
Adım 12b onaylandı. Adım 12c'ye geç: kaynak kütüğü.

HUB_SPEC.md §8.6.8 ve §8.6.9 — src/hub/pages/sources.jsx.

- hub_source_registry CRUD: ad, URL, tip, kontrol sıklığı, son kontrol, sorumlu
- Süresi gelen kaynaklar Bugün ekranında "kontrol zamanı" olarak belirir
  (§8.1'e altıncı blok olarak eklenir)
- Kaynak performansı: her kaynak için aday sayısı → cevap → görüşme → katılım
- 8 hafta boyunca hiç görüşmeye dönüşmemiş kaynak otomatik 'paused' önerisi alır
  (otomatik pasifleştirme YOK, sadece öneri)

§8.6.1'deki 12 kaynağı başlangıç verisi olarak kütüğe ekle.

Kabul: süresi gelmiş bir kaynak Bugün ekranında görünüyor; kaynak
performans tablosu gerçek veriden hesaplanıyor.
```

---

## Adım 13 — Metrikler

```
Adım 12 onaylandı. Adım 13'e geç: metrik paneli.

HUB_SPEC.md §8.7'deki yedi metrik, kaynak kırılımıyla.

"90 günde hâlâ aktif" metriği için gereken veriyi hub_stage_log'dan hesapla —
joined aşamasına geçiş tarihi + o kişinin sonraki aktivitesi. Bu metrik geriye
dönük hesaplanamaz, bu yüzden hesaplama mantığı bugünden doğru kurulmalı.

Grafik kütüphanesi ekleme; sade sayı kartları ve basit oran çubukları yeter.

Kabul: her metrik gerçek veriden hesaplanıyor, sabit değer yok.
```

---

## Adım 14 — Otomasyon

```
Adım 13 onaylandı. Adım 14'e geç: otomasyon işleri.

HUB_SPEC.md §10. Mevcut supabase/functions/ desenini izle.

- hub-daily (her gece 03:00): bayatlıkları hesapla, takip görevi üret,
  süresi dolan kapıları işaretle, ikinci takipten sonra hâlâ sessiz olanları
  archived/no_reply yap.
- hub-weekly (pazartesi 08:00): haftalık özet e-postası — mevcut send-mail
  fonksiyonunu kullan.

DİKKAT: otomatik arşivleme YALNIZCA no_reply için çalışır. Sistem başka
hiçbir aşamada kendiliğinden karar vermez.

Kabul: hub-daily elle tetiklendiğinde bayatlamış kartlar için takip görevi
üretiyor ve başka hiçbir aşamayı değiştirmiyor.
```

---

## Adım 15 — Ayarlar

```
Adım 14 onaylandı. Son adım, Adım 15: ayarlar.

Yalnızca cofounder rolüne açık:
- Üye yönetimi: hub_members ekle/çıkar/pasifleştir, rol değiştir,
  project_owner için proje kapsamı ata
- Rubrik metinleri ve eşik değerleri
- Kırmızı bayrak listesi
- KVKK: "adayı tamamen sil" aksiyonu (§12)

Kabul: recruiter rolüyle giriş yapıldığında bu sayfa menüde görünmüyor ve
doğrudan gidilmeye çalışıldığında RLS yazma işlemini reddediyor.
```

---

## Bir şey ters giderse

```
Şu anki adımda sorun var: <sorunu tarif et>

Kendi başına çözüm uydurma. Önce şunu yap:
1. Sorunun kök nedenini bul ve bana açıkla
2. HUB_SPEC.md'de bu durumu karşılayan bir karar var mı, kontrol et
3. Şartname bu durumu kapsamıyorsa, iki alternatif öner ve HANGİSİNİ
   seçmemi sor — kod yazma

Şartnameye aykırı bir şey yapman gerekiyorsa önce HUB_SPEC.md güncellenir,
sonra kod yazılır. Tersi olmaz.
```

## Adım bittiğinde kontrol listesi

```
Bu adımı bitirmeden önce şunları doğrula ve tek tek bana yaz:

1. npm run build hatasız geçiyor mu?
2. /, /admin/ ve /team/ hâlâ çalışıyor mu?
3. Bu adımda hangi dosyalar oluştu/değişti? (git status --porcelain çıktısı)
4. İzin verilenler dışında bir mevcut dosyaya dokunuldu mu?
5. Adımın kabul kriteri sağlandı mı, nasıl test ettin?
```
