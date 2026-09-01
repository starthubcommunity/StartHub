# Kurucu Hattı — Claude Code Promptları

Şartname: `HUB_SPEC.md` (artık **v2** — sadeleştirilmiş) · v1 arşivi:
`HUB_SPEC_v1_archive.md` · Proje kuralları: `CLAUDE.md`

**Durum:** Adım 1–3, Prompt A · B · C · D tamamlandı + admin rol/davet sistemi +
yetki sistemi (arayüzden tam yönetim) canlıya alındı. Şimdi **Prompt S** var —
hub sadeleştirmesi (v2). Tam metin: **`PROMPT_S.md`**.

> **Prompt D donduruldu.** v1'in 10 ekran / 57 alan / 12 tablo tasarımı iki
> kişilik ekip + sıfır aday için fazla büyüktü. v2 aynı işi 3 ekran, aşamaya
> göre 6–8 alan, 7 tabloyla yapar. Bkz. `HUB_SPEC.md` (v2) ve `PROMPT_S.md`.

---

## Dal düzeni

```
hub   → aktif geliştirme (origin/hub'a push ediliyor)
main  → canlı site, dokunulmuyor
```

⚠️ **`git add -A` hiçbir zaman kullanılmaz.** Çalışma kopyasında hub ile
ilgisi olmayan eski değişiklikler var (silinmiş `screenshots/`, `uploads/`,
`Admin Panel.html`). Commit'e girerlerse canlı site bozulur.

---

# PROMPT A — Veri temeli, kural motoru, tablo ve aday kartı

> Şartnamedeki Adım 4 + 5 + 6 + 7.
> Bittiğinde sistem **elle kullanılabilir** olacak: aday eklenir, düzenlenir,
> puanlanır, bayraklanır.

```
Adım 3 onaylandı. Şimdi PROMPT A'yı uygula: veri temeli, kural motoru,
tablo görünümü ve aday kartı. (HUB_SPEC.md'deki Adım 4-5-6-7.)

Bu büyük bir iş. TEK SEFERDE yazma — aşağıdaki dört parçayı sırayla yap,
her parçanın sonunda kendi kabul kriterini doğrula ve o parçayı commit'le.
Parça bitmeden diğerine geçme. Hepsi bitince toplu rapor ver.

═══════════════════════════════════════════════════════════
PARÇA A1 — Sabitler ve mappers
═══════════════════════════════════════════════════════════
src/hub/hub-constants.js
  Aşamalar, kaynaklar (14 değer), arşiv sebepleri, rol tipleri, veri güveni,
  kırmızı bayrak listesi (6 madde), rubrik metinleri, eşik değerleri.
  Hepsi HUB_SPEC.md §2'den. Bu dosya sabit listelerin TEK kaynağı olacak;
  hiçbir bileşen kendi listesini tanımlamayacak.

src/hub/hub-mappers.js
  mapCandidateToDb / mapCandidateFromDb ve diğer tablolar için aynısı.
  src/admin/admin-store.jsx'teki mapper desenini birebir izle.
  DB snake_case ↔ JS camelCase dönüşümü açık fonksiyonlarla.

Kabul: sabit listeler tek yerden geliyor, mapper'lar her iki yönde de
kayıpsız çalışıyor (bir nesneyi toDb→fromDb çevirince aynısı çıkıyor).
Commit: "hub: A1 - sabitler ve mappers"

═══════════════════════════════════════════════════════════
PARÇA A2 — Store
═══════════════════════════════════════════════════════════
src/hub/hub-store.jsx — Supabase CRUD + React context.
admin-store.jsx desenini izle: koleksiyonları paralel yükle, patchLocal ile
optimistic update, hata olursa geri al.

DİKKAT: nextId hack'i YOK. Tüm hub tabloları uuid default'lu — insert'te id
gönderme. (HUB_SPEC.md §4.6 madde 1.)

Kabul: tarayıcı konsolundan aday ekle/güncelle/sil çalışıyor, sayfa
yenilenince veri Supabase'den geliyor.
Commit: "hub: A2 - store"

═══════════════════════════════════════════════════════════
PARÇA A3 — Kural motoru
═══════════════════════════════════════════════════════════
src/hub/hub-rules.js — saf, yan etkisiz fonksiyonlar (§9):
  canAdvance(candidate, toStage) -> { ok, reason }
  thresholdMet(candidate) -> boolean
  isStale(candidate, now) -> { stale, level, days }
  gateStatus(gate, now) -> 'running' | 'due' | 'overdue'

En kritik kurallar:
- finalist'e geçiş: toplam >= 10 VE hiçbir eksen <= 2 VE kırmızı bayrak < 2
  (ya da rol cofounder ve override_reason dolu)
- interviewed'a geçiş: rubriğin üç ekseni de dolu
- archived'a geçiş: archive_reason zorunlu

Bu mantık BAŞKA HİÇBİR YERDE tekrarlanmayacak. Arayüz her zaman bu
fonksiyonları çağıracak; hiçbir bileşen kendi eşik kontrolünü yazmayacak.

Yanına node ile çalışan sade bir test scripti yaz (test kütüphanesi ekleme).
Kabul: 5-5-1 puanlı aday finalist olamıyor; 2 bayraklı aday cofounder
override'ı olmadan geçemiyor; sebepsiz arşivleme reddediliyor.
Commit: "hub: A3 - kural motoru"

═══════════════════════════════════════════════════════════
PARÇA A4 — Tablo görünümü + aday kartı
═══════════════════════════════════════════════════════════
src/hub/pages/table.jsx — §8.2. Sistemin asıl çalışma ekranı, Excel gibi:
  1. "+ Yeni aday" satır içi ekleme (zorunlu: full_name, bir iletişim,
     source; data_trust varsayılanı 'declared')
  2. Hücre içi düzenleme, Tab/Enter ilerleme, Esc iptal
  3. Çoklu seçim (checkbox, Shift+tık aralık) → toplu işlem: aşama,
     sorumlu, etiket, arşivle
  4. Sütun gizle/göster + sıra değiştirme, ilk sütun dondurulmuş
  5. Çoklu sütun sıralama
  6. CSV dışa aktarma (görünen sütunlar + aktif filtre)

src/hub/components/filter-bar.jsx + saved-views.jsx — §8.6 öncesi §3'teki
altı filtre grubu ve hub_views tablosuna kaydedilen görünümler.

src/hub/pages/candidate.jsx — §8.4. Sağdan açılan panel, üç sekme:
  - Özet: kimlik, eğitim + veri güveni etiketi, kanıt linkleri,
    why_this_one, sonraki aksiyon (zorunlu alan)
  - Değerlendirme: üç eksenli puan girişi, AI ön puanı (salt okunur,
    "öneri" etiketli, soluk), kırmızı bayrak kutucukları + her birinin
    altında not alanı, eşik durumu göstergesi
  - Geçmiş: temaslar, görüşmeler, kapılar, aşama günlüğü — tek zaman çizelgesi

Bileşenler src/admin/admin-ui.jsx'ten devralınacak (AIcon, Modal, Field,
Input, Select, SearchBar, ConfirmDialog, TagInput). Yeniden yazma.

Kabul: 100 satırlık veriyle hücre düzenleme ve toplu aşama değiştirme
takılmadan çalışıyor; puan girilince eşik göstergesi anında güncelleniyor;
iki bayrak işaretlenince finalist'e geçiş kilitleniyor ve sebep görünüyor.
Commit: "hub: A4 - tablo ve aday karti"

═══════════════════════════════════════════════════════════
BİTİRİRKEN
═══════════════════════════════════════════════════════════
- npm run build hatasız geçmeli
- /, /admin/, /team/ bozulmamış olmalı
- git status --porcelain: yalnızca hub dosyaları temiz olmalı,
  eski birikintiye dokunulmamalı
- Push etme, onay bekle
- Dört parçanın kabul kriterlerini tek tek nasıl doğruladığını yaz
```

---

# PROMPT B — Hat, günlük iş, mesajlaşma, kapılar

> Şartnamedeki Adım 8 + 9 + 10 + 11.
> Bittiğinde hat **uçtan uca** işler: aday bulunur, mesaj gönderilir,
> görüşülür, kapılardan geçirilir, ekibe alınır.

```
PROMPT A onaylandı. Şimdi PROMPT B: hat görünümü, Bugün ekranı, mesajlaşma
akışı ve kapılar. (HUB_SPEC.md'deki Adım 8-9-10-11.)

Yine dört parça, sırayla, her parça sonunda kabul kriteri + commit.

═══════════════════════════════════════════════════════════
PARÇA B1 — Hat görünümü
═══════════════════════════════════════════════════════════
src/hub/pages/board.jsx — §8.3. Sekiz sütunlu kanban.
- Sürükle-bırak, ama canAdvance() false dönerse bırakma REDDEDİLİR ve
  dönen reason toast olarak gösterilir. Kendi kontrolünü yazma, hub-rules.js'i çağır.
- Kartta: ad, üniversite, kaynak rozeti, toplam puan, sorumlu baş harfleri,
  bayrak sayısı (varsa kırmızı), bayatlık noktası
- Sütun başlığında sayı + bir önceki aşamadan dönüşüm oranı
- Tablo ile aynı filtre durumunu paylaşsın; görünüm değişince filtre korunsun

Kabul: rubriği dolmamış adayı görüşme sütununa bırakma reddediliyor,
sebep görünüyor.
Commit: "hub: B1 - hat gorunumu"

═══════════════════════════════════════════════════════════
PARÇA B2 — Şablonlar ve mesaj gönderme akışı
═══════════════════════════════════════════════════════════
src/hub/pages/templates.jsx — §8.5 ve özellikle §8.5b'deki yedi adımlık akış.

Kritik davranışlar — bunlar pazarlık konusu değil:
- Kişiselleştirme satırı AYRI alan ve zorunlu. Boşken "Kopyala" DEVRE DIŞI.
- "Kopyala" tek işlemde: panoya kopyalar + hub_touches kaydı oluşturur +
  adayı contacted'a taşır + 7 günlük follow_up_at kurar + şablonun
  sent_count'unu artırır
- Kopyalama anında kanal sorulur (linkedin / email / whatsapp)
- Aday kartında "Cevap geldi" → aşama replied, şablonun reply_count artar
- Şablon CRUD'u yalnızca cofounder rolünde açık
- Varyant başına cevap oranı gösterilir

Sistem HİÇBİR mesajı kendisi göndermez. "Toplu gönder" butonu yok ve
hiçbir zaman eklenmeyecek.

Kabul: kişiselleştirme boşken kopyalama kapalı; kopyalayınca aday
contacted'a geçiyor ve temas kaydı oluşuyor.
Commit: "hub: B2 - sablonlar ve temas"

═══════════════════════════════════════════════════════════
PARÇA B3 — Kapı A / Kapı B
═══════════════════════════════════════════════════════════
§2.5 ve hub_gates tablosu.
- "Kapı A başlat": görev metni + 72 saatlik sayaç, adaya gidecek metin hazır.
  Aşama gate_a olur. Süre dolunca sistem kartı otomatik işaretler.
- "Kapı B başlat": proje seçilir + 10 günlük sayaç. Aşama gate_b olur.
- "Ekibe aktar": aşama joined, hak ediş başlangıcı KAPI A'NIN İLK GÜNÜ
  olarak yazılır (geriye dönük).

DİKKAT: team sistemine SADECE referansla bağlan (startup_id + person_id yaz).
public/team/index.html tüm durumunu app_state tablosunda tek JSON bloğunda
tutuyor — o bloğu okumaya veya yazmaya ÇALIŞMA. (§4.6 madde 2.)

Kabul: 72 saati geçmiş kapı işaretleniyor; Ekibe aktar hak ediş tarihini
Kapı A başlangıcına yazıyor.
Commit: "hub: B3 - kapilar"

═══════════════════════════════════════════════════════════
PARÇA B4 — Bugün ekranı
═══════════════════════════════════════════════════════════
src/hub/pages/today.jsx — §8.1. En sona bırakıldı çünkü diğer üçünden
beslenir. Beş blok, tek sütun, her satırda tek tıkla aksiyon:
  1. Gönderilecek mesajlar (haftalık hedef göstergesi: "bu hafta 6/15")
  2. Süresi gelen takipler
  3. Bugünkü görüşmeler + takvim linki
  4. Bayatlamış kartlar
  5. Süresi dolan kapılar

Boş blok gizlenir. Hepsi boşsa: "Bugün temiz. Havuza yeni aday eklemek
ister misin?"

Bu ekranı uygulamanın VARSAYILAN AÇILIŞ sayfası yap.

Kabul: takip süresi geçmiş aday listede çıkıyor; boş blok gizleniyor;
uygulama bu sayfayla açılıyor.
Commit: "hub: B4 - bugun ekrani"

═══════════════════════════════════════════════════════════
BİTİRİRKEN
═══════════════════════════════════════════════════════════
npm run build geçmeli, /, /admin/, /team/ bozulmamalı, push etme,
dört parçanın kabul kriterini tek tek nasıl doğruladığını yaz.
```

---

# PROMPT C — Yetenek avı, metrikler, otomasyon, ayarlar

> Şartnamedeki Adım 12 + 13 + 14 + 15.
> Bittiğinde sistem **kendi kendini besler**: aday havuzu dolar, kaynaklar
> ölçülür, takipler otomatik üretilir.

```
PROMPT B onaylandı. Şimdi PROMPT C: yetenek avı, metrikler, otomasyon,
ayarlar. (HUB_SPEC.md'deki Adım 12-13-14-15.)

Yine parça parça. C1 en büyüğü — acele etme.

═══════════════════════════════════════════════════════════
PARÇA C1 — Yapıştır ve ayrıştır + CSV + inbound
═══════════════════════════════════════════════════════════
src/hub/pages/import.jsx — §8.6.3'teki yedi adımlık akış birebir.

EN KRİTİK KURAL: AI ASLA ALAN UYDURMAZ.
Metinde geçmeyen üniversite, e-posta veya link BOŞ KALIR. Çıkarım yapılan
alan data_trust='guess', metinde açıkça yazan 'declared'. Uydurma veri
filtreyi ve sonraki tüm kararları zehirler.

- Ön izleme adımı ATLANAMAZ; ayrıştırma sonucu doğrudan kaydedilmez
- Ham metin hub_import_batches.raw_text'e saklanır
- Tekrar tespiti: ad benzerliği + link eşleşmesi (e-posta, linkedin, github)
- Parti bilgisi (source, source_detail, tarih) tüm gruba tek seferde uygulanır
- CSV içe aktarma ve applications'tan inbound çekme de bu ekranda
- applications kaydını TAŞIMA veya DEĞİŞTİRME — kopyala, source_ref'e id yaz
- Her kayıtta kvkk_consent, kvkk_at, retain_until doldurulsun

Kabul: 40 satırlık hackathon sonuç metni yapıştırılınca satırlara ayrılıyor,
metinde olmayan alanlar boş kalıyor, tekrarlar tespit ediliyor, ön izlemeden
onaylanınca havuza düşüyor.
Commit: "hub: C1 - yapistir ayristir"

═══════════════════════════════════════════════════════════
PARÇA C2 — GitHub taraması, zenginleştirme, AI ön puanı
═══════════════════════════════════════════════════════════
§8.6.4, §8.6.5, §8.6.6, §8.6.7.

- GitHub REST API, kimlik doğrulamalı. Arama parametreleri arayüzden ayarlanır.
- Dakikada 30 istek sınırı: kuyruk + ilerleme çubuğu. Sınırı arayüzde yaz.
- Zenginleştirme §8.6.5'teki altı sinyali üretir → enrichment jsonb alanı
- AI ön puanı YALNIZCA bitirmişlik eksenini tahmin eder. İletişim ve kapasite
  BOŞ BIRAKILIR — onlar görüşmeden çıkar. Üçünü birden puanlamaya kalkma.
- ai_score insan puanının üstüne asla yazmaz, ayrı kolonda durur
- Ön puanın yanında güven seviyesi ve dayandığı kanıt gösterilir
- "Neden bu kişi" cümlesi §8.6.7'nin dört kuralına uyar: somut esere atıf,
  en fazla iki cümle, kişi hakkında sıfat yok, doğrulanamayan şey yok

Arayüzde §8.6.5'teki "kesinlikle çıkarılamayanlar" listesi de görünsün —
kullanıcı sistemin ne bilmediğini bilmeli.

Kabul: bir GitHub kullanıcısı tarandığında altı sinyal doluyor, ön puan
kanıtıyla görünüyor, iletişim ve kapasite boş kalıyor.
Commit: "hub: C2 - github tarama ve zenginlestirme"

═══════════════════════════════════════════════════════════
PARÇA C3 — Kaynak kütüğü ve metrikler
═══════════════════════════════════════════════════════════
src/hub/pages/sources.jsx — §8.6.8, §8.6.9
- hub_source_registry CRUD: ad, URL, tip, kontrol sıklığı, son kontrol, sorumlu
- Süresi gelen kaynaklar Bugün ekranına altıncı blok olarak eklenir
- §8.6.1'deki 12 kaynağı başlangıç verisi olarak kütüğe ekle
- Kaynak performansı: aday → cevap → görüşme → katılım zinciri
- 8 hafta boyunca görüşmeye dönüşmemiş kaynak 'paused' ÖNERİSİ alır
  (otomatik pasifleştirme YOK, sadece öneri)

src/hub/pages/metrics.jsx — §8.7'deki yedi metrik, kaynak kırılımıyla.
"90 günde hâlâ aktif" metriğini hub_stage_log'dan hesapla. Grafik
kütüphanesi ekleme; sade sayı kartları ve oran çubukları yeter.

Kabul: süresi gelmiş kaynak Bugün ekranında görünüyor; her metrik gerçek
veriden hesaplanıyor, sabit değer yok.
Commit: "hub: C3 - kaynak kutugu ve metrikler"

═══════════════════════════════════════════════════════════
PARÇA C4 — Otomasyon ve ayarlar
═══════════════════════════════════════════════════════════
§10 — mevcut supabase/functions/ desenini izle:
- hub-daily (gece 03:00): bayatlıkları hesapla, takip görevi üret, süresi
  dolan kapıları işaretle, ikinci takipten sonra sessiz kalanları
  archived/no_reply yap
- hub-weekly (pazartesi 08:00): haftalık özet — mevcut send-mail'i kullan

DİKKAT: otomatik arşivleme YALNIZCA no_reply için çalışır. Sistem başka
hiçbir aşamada kendiliğinden karar vermez.

src/hub/pages/settings.jsx — yalnızca cofounder:
- Üye yönetimi (hub_members ekle/çıkar/pasifleştir, rol, startup_ids kapsamı)
- Rubrik metinleri ve eşik değerleri
- Kırmızı bayrak listesi
- KVKK: "adayı tamamen sil" (tüm bağlı kayıtlar + ham yapıştırma metinleri dahil)

Kabul: hub-daily elle tetiklendiğinde takip görevi üretiyor ve başka hiçbir
aşamayı değiştirmiyor; recruiter rolüyle ayarlar menüde görünmüyor ve
doğrudan gidilse bile RLS yazmayı reddediyor.
Commit: "hub: C4 - otomasyon ve ayarlar"

═══════════════════════════════════════════════════════════
BİTİRİRKEN
═══════════════════════════════════════════════════════════
npm run build geçmeli, /, /admin/, /team/ bozulmamalı, push etme,
dört parçanın kabul kriterini tek tek nasıl doğruladığını yaz.
```

---

# PROMPT D — Roller, talep akışı ve iki hat

> ⚠️ **DONDURULDU** — bkz. `HUB_SPEC.md` (v2) §10 ve `PROMPT_S.md`.
> Roller ve iki hat kalıyor ama talep/onay el sıkışması (`requested` durumu,
> `requested_at`/`accepted_at`/`requested_by`, `hub_role_log`, eşleştirme
> önerisi) v2'de kaldırıldı. Aşağıdaki metin yalnızca geçmiş kaydı için duruyor;
> uygulanmaz. Bu prompt zaten uygulanmış commit'lerdeydi — v2 onu geri sarıyor.

> Şartnamedeki **§12**. Bittiğinde her şey hub'dan yürür: rol açmak, aday
> aramak, sunmak ve karar vermek. Supabase'e elle dokunmaya gerek kalmaz.

```
PROMPT C onaylandı ve kabul testi bulguları kapatıldı. Şimdi PROMPT D.

HUB_SPEC.md'ye YENİ bir bölüm eklendi: §12 "Roller, talep akışı ve iki hat".
Kod yazmadan önce §12'nin tamamını oku. §13 eski §12'dir, numarası kaydı.

Dört parça, sırayla, her parça sonunda kabul kriteri + commit.

═══════════════════════════════════════════════
PARÇA D1 — Şema ve sabitler
═══════════════════════════════════════════════
- supabase/migrations/0005_hub_roles.sql dosyasını §12.6'daki bloktan
  BİREBİR yaz (SQL'i ben çalıştıracağım)
- hub-constants.js: eşikler HAT BAZINDA tanımlansın (§12.1)
    founder: toplam >= 10 ve hicbir eksen <= 2
    member : bitirmislik >= 3 ve kapasite >= 3
             (iletisim yalnizca rol needs_communication ise zorunlu)
  Ayrıca rol durumları, hat listesi, karar değerleri.
- hub-mappers.js: hub_open_roles ve hub_candidates'in yeni alanları +
  hub_role_log için mapper
- hub-store.jsx: roles CRUD, logRoleStatus, presentCandidate, ownerDecide

Kabul: yeni alanlar iki yönde de kayıpsız dönüşüyor; eşikler tek yerden geliyor.
Commit: "hub: D1 - rol semasi ve hat sabitleri"

═══════════════════════════════════════════════
PARÇA D2 — Kural motoru: iki hat
═══════════════════════════════════════════════
hub-rules.js:
- thresholdMet(candidate, role) artık adayın track alanına göre çalışsın
- canAdvance: KURUCU hattı Kapı A + Kapı B; ÜYE hattı yalnızca Kapı A
  (üyede finalist -> gate_a -> joined; gate_b atlanır, bu bir "atlama"
  sayılmaz, hattın kendi sırasıdır)
- Üye hattında iletişim ekseni boş olabilir; rol needs_communication ise
  zorunlu olur
- presentGate(candidate, role): sunulabilir mi — eşik sağlandı mı,
  bayrak < 2 mi, role bağlı mı

Test scriptine ekle: aynı puan tablosuyla bir aday ÜYE hattında geçerken
KURUCU hattında geçemiyor; üye hattında gate_b istenmiyor.

Kabul: iki hat da doğru davranıyor, mevcut 57 test hâlâ geçiyor.
Commit: "hub: D2 - iki hat kurallari"

═══════════════════════════════════════════════
PARÇA D3 — Roller sayfası
═══════════════════════════════════════════════
src/hub/pages/roles.jsx — §12.5. Sidebar'a "Açık Roller" ekle.
- Proje bazında gruplu liste, durum rozetleri, kaç gündür açık
- Rol oluştur/düzenle: proje, başlık, rol tipi, HAT, aranan profil,
  beceriler, haftalık saat, süre, ilk teslimat, ekip büyüklüğü,
  needs_communication, aciliyet
- Durum makinesi butonları (§12.2/12.3): Talep gönder · Üstlen ·
  Aday sun · Kapat · Dondur. Her geçiş hub_role_log'a yazılır.
- Rol kartında bağlı adaylar ve huni durumu
- "Bu rol için tara" → GitHub taramasını rolün skills[] alanıyla tohumlar
  (§12.4). Kullanıcı dili elle girmez.
- Yetki (§12.7): recruiter kabul/ret VEREMEZ; project_owner yalnızca kendi
  projesinin rollerini görür

Kabul: rol açılıp talep gönderiliyor, recruiter üstleniyor, durum günlüğe
yazılıyor; "bu rol için tara" doğru parametrelerle taramayı başlatıyor.
Commit: "hub: D3 - roller sayfasi"

═══════════════════════════════════════════════
PARÇA D4 — Sunma, karar ve Bugün blokları
═══════════════════════════════════════════════
- Aday kartı: track seçimi (eşik göstergesi buna göre), bağlı açık rol,
  "Proje sahibine sun" butonu (presentGate'ten geçerse), sunulduysa
  proje sahibinin kararı ve gerekçesi
- Proje sahibi karar ekranı: kabul / ret, GEREKÇE ZORUNLU. Kabul → aday
  Kapı A'ya, rol shortlist'te kalır; aday joined olunca rol filled olur
- Aday-rol eşleştirme önerisi (§12.4): role_type + beceri örtüşmesi.
  ÖNERİ atama değildir, insan atar.
- Bugün ekranına role göre bloklar (§12.5):
    recruiter      -> "Yeni rol talepleri", "Aday bekleyen roller"
    project_owner  -> "Sana sunulan adaylar", "Açık rollerin"
- RLS: hub_cand_read politikasını §12.7'ye göre güncelle — proje sahibi
  kendisine SUNULMUŞ adayı görür, havuzun tamamını görmez.
  (Bu bir migration gerektiriyorsa 0006 olarak ayrı yaz, ben çalıştırırım.)

Kabul: recruiter aday sunuyor, proje sahibinin Bugün ekranında beliriyor,
gerekçesiz karar reddediliyor, kabul edilince aday Kapı A'ya geçiyor.
Commit: "hub: D4 - sunma karar ve bugun bloklari"

═══════════════════════════════════════════════
BİTİRİRKEN
═══════════════════════════════════════════════
npm run build hatasız, test scripti geçmeli, /, /admin/, /team/ bozulmamalı.
Push etme. Dört parçanın kabul kriterini tek tek nasıl doğruladığını yaz.
```

---

# PROMPT S — Hub sadeleştirmesi (v2)

> Prompt D'nin yerini alır. Kaynak şartname artık `HUB_SPEC.md` (v2);
> çelişki olursa o dosya kazanır. Tam 12 adımlı metin ayrı dosyada:
> **`PROMPT_S.md`**.
>
> **Durum:** `hub-simplify-v2` dalında uygulandı. Adım 1 (şema) · 2–3
> (sabitler + kural motoru, 66 test) · store+mappers · 4–11 (UI, build yeşil)
> · 12 (dok: `HUB_TEST.md`, `CLAUDE.md`). **Bekleyen:** `0010_hub_simplify.sql`
> canlıda çalıştırılacak; `hub-ai-draft` edge function deploy edilecek
> (`ANTHROPIC_API_KEY` secret); dal `main`'e merge edilmedi.

Özet:

| Adım | İş |
|---|---|
| Ön koşul | `main`'den `hub-simplify-v2` dalı; v1-dışı dosyaların (`hub-parse.js`, `hub-github.js`, `hub-enrich.js`, `hub-match.js`, `sources.jsx`) importunu kes, silme |
| 1 | `0010_hub_simplify.sql`: `draft_text`, `import_batch_label`, `extended_days`; `hub_views` + `hub_import_batches` drop; `0004_hub_cron.sql` → `_deferred/`; `0005` sadeleştir; `0009`'a dokunma |
| 2 | `hub-constants.js`: `STAGES` 8→5+arşiv, `SOURCES` 14→6, `RED_FLAGS` 6→4, `NEXT_ACTIONS` yeni, `ROLE_STATUSES` 7→4 |
| 3 | `hub-rules.js`: `canAdvance` yeni sıraya; `stageOrderFor`/`MEMBER_STAGE_ORDER` kaldır; yeni `gateDueAt()`, `canDraftAI()` |
| 4 | Nav: `Bugün · Adaylar · Roller` + dişli; `board/table/import/sources` route'ları kaldır |
| 5 | Yeni `candidates-list.jsx` (`table.jsx` yerine): 7 sabit sütun, arama + 3 chip |
| 6 | `candidate.jsx`: sekmesiz, aşamaya göre; yeni `GateCard`; `next_action` 6 seçenekli |
| 7 | Yeni `import-simple.jsx` (`import.jsx` yerine): 3 adım, senkron, SheetJS |
| 8 | Yeni `hub-ai-draft.js`: tekli + toplu taslak, `canDraftAI` kapısı |
| 9 | `templates.jsx`: kanal 4→3, A/B kaldır, `draft_text` ön-doldurma |
| 10 | `roles.jsx`: form 11→5; `requested` yok; `has_perm()` ile buton görünürlüğü |
| 11 | `metrics.jsx`: 3 kart; haftalık hedef 10/6 |
| 12 | Dok: bu güncelleme (HUB_SPEC v2, arşiv, PROMPT_S.md); `HUB_TEST.md` 5 teste in; `CLAUDE.md` dosya listesi |

---

## Yardımcı promptlar

### Bir şey ters giderse

```
Şu anki parçada sorun var: <sorunu tarif et>

Kendi başına çözüm uydurma:
1. Kök nedeni bul ve açıkla
2. HUB_SPEC.md'de bu durumu karşılayan bir karar var mı, kontrol et
3. Şartname kapsamıyorsa iki alternatif öner ve hangisini seçmemi sor —
   kod yazma

Şartnameye aykırı bir şey gerekiyorsa önce HUB_SPEC.md güncellenir,
sonra kod yazılır. Tersi olmaz.
```

### Parça bittiğinde kontrol

```
Bu parçayı bitirmeden önce doğrula ve tek tek yaz:
1. npm run build hatasız geçiyor mu?
2. /, /admin/ ve /team/ hâlâ çalışıyor mu?
3. git status --porcelain çıktısı nedir?
4. İzin verilenler dışında mevcut bir dosyaya dokunuldu mu?
5. Kabul kriteri sağlandı mı, nasıl test ettin?
6. Kural mantığını hub-rules.js dışında bir yerde tekrarladın mı?
```

### Yavaşlama / kalite düşüşü olursa

```
Dur. Bu promptun kalan parçalarını yapma.
Şu ana kadar yaptıklarını özetle, hangi kabul kriterlerinin sağlandığını
ve hangilerinin sağlanmadığını dürüstçe yaz. Yarım kalan işi commit'leme.
```
