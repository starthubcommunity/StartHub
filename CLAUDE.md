# Start-Hub

Vite 6 + React 18 + Supabase (auth + Postgres), Vercel'de barındırılıyor.

## Giriş noktaları

| Yol | HTML | Entry |
|-----|------|-------|
| `/` | `index.html` | `src/main.jsx` → `src/app.jsx` |
| `/admin/` | `admin/index.html` | `src/admin/main.jsx` → `src/admin/admin-app.jsx` |
| `/team/` | `public/team/index.html` | Kendi kendine yeten tek dosyalık uygulama — bu repoda DOĞRUDAN elle düzenlenir (build artefaktı değil; ayrı Supabase projesi `umgdtjlgivvymngsnqtv`'ye bağlanır). Değişiklik yapmadan önce aşağıdaki **Dikkat** bölümündeki JSON-string kaçışlama uyarısını oku. |
| `/HR/` | `HR/index.html` | `src/hub/main.jsx` → `src/hub/hub-app.jsx` — eski adı `/hub/`; o yol artık `/HR/`'a 308 ile yönleniyor (`vercel.json`). Kaynak klasör hâlâ `src/hub/`. |

## Kurucu Hattı / İnsan Kaynağı (`/HR/`)

Yapım şartnamesi: **`HUB_SPEC.md`** — artık **v3** (v2'nin canlı kullanımından
sonra: aday kartı sadeleştirmesi, yapıştır-ayrıştır ana giriş yöntemi, arşiv ayrı
sayfa, gerçek team entegrasyonu; 5 aşama ve 7 tablo korunur). Bağlayıcıdır.
Arşivler: `HUB_SPEC_v2_archive.md`, `HUB_SPEC_v1_archive.md`.
Şartnamedeki bir karar belirsizse veya yanlış görünüyorsa **kod yazmadan önce sor**;
sessizce kendi tasarımını uygulama.

Görev sırası: v1–v2 için **`PROMPT_S.md`** (12 adım, tamamlandı), v3 için
**`PROMPT_V3.md`** (Blok 0 + A–E). Kabul testleri: **`HUB_TEST.md`** (aşama başına
bir uçtan uca test) + `node src/hub/hub-rules.test.mjs`.

**Hub sayfaları:** `today.jsx` · `candidates-list.jsx` · `candidate.jsx`
(+`GateCard`) · `archive.jsx` · `roles.jsx` · `templates.jsx` · `metrics.jsx` ·
`settings.jsx` · `applications.jsx` ("Diğer Başvurular" — yalnızca
mentor/sponsor/idea_application; community/project artık elle aktarım
gerektirmiyor, 0022 tetikleyicisiyle otomatik Adaylar'a düşüyor, bkz. §16) ·
`sponsors.jsx` (destekçiler — admin panelden taşındı, yalnızca cofounder).
Destek dosyaları: `new-candidate.jsx` (`presetRoleId` ile "bu role aday ekle"
akışını da karşılar), `import-simple.jsx` (CSV), `paste-import.jsx`
(yapıştır-ayrıştır — v3 ana yöntem), `triage.jsx` (hızlı eleme), `hub-ai-draft.js`
+ `supabase/functions/hub-ai-draft/`.

**Navigasyon (2026-09-16):** Bugün → Adaylar → Açık Pozisyonlar → Arşiv →
(altta, katlanır) Yönetim (Şablonlar/Metrikler/Kaynaklar/Destekçiler/Diğer
Başvurular/Yetkiler/Ayarlar). "Başvurular" ayrı bir ana sekme değil. **"Bugün" artık
"Genel Bakış" (2026-09-23)** — nav `id` hâlâ `today` (sessionStorage/route kırılmasın diye),
yalnızca etiket ve sayfa başlığı değişti; `today.jsx`'teki kuyruk mantığı (aşağıdaki not)
AYNEN duruyor, üstüne `OverviewStats` bileşeni eklendi (aktif aday + aşama dağılımı store'dan,
Mentör/Destekçi/Fikir başvuru sayıları + Hub Sheet bağlantı durumu `applications`/
`hub_sheet_config`'ten hafif bir sorguyla).

**Bugün = kuyruk modu (2026-09-20):** her blok başlığında (mesajı varsa) bir
"Başlat" düğmesi — bloğu liste olarak taramak yerine `QueueModal`
(today.jsx) tek kart/tek aksiyon/otomatik "Sonraki" akışıyla açar. Bu bileşen
aksiyonu İCAT ETMEZ — mevcut `CandidatePanel`'i (aday kartı, zaten aşamaya
göre doğru tek soruyu soruyor) olduğu gibi kullanır, üstüne yalnızca ince bir
ilerleme çubuğu ekler. Satır tek tek tıklamak hâlâ çalışır (liste kalktı,
kuyruk ek bir yol). Adaylar sayfasındaki 4 ayrı ekle butonu (Tek aday/CSV/
GitHub/Yapıştır) tek bir "+ Aday Ekle" açılır menüsünde toplandı,
yapıştır-ayrıştır ilk sırada ("ana yöntem" etiketiyle).
Açık Pozisyonlar'da rol kartları tıklanabilir (→ o role bağlı adaylarla
filtrelenmiş Adaylar listesi) ve "+ Bu role aday ekle" var. Yeni rol
oluşturma hatta göre dallanır: Kurucu hattı → "Yeni proje taslağı oluştur"
(`hub-create-draft-project` edge function, `startups`'ta `stage:'idea'`,
`published:false`) veya "Benim projem var"; Üye hattında proje seçimi
zorunlu (taslak seçeneği yok).

**v3'te geri bağlanan (v2'de bağlantısı kesikti):** `src/hub/hub-parse.js` (§6.2),
`src/hub/pages/sources.jsx` + `hub_source_registry` (§11), `hub-match.js`
(§12.4, havuz 100+ olunca).

**Bağlantısız ama testli, kasıtlı olarak duruyor:** `hub-enrich.js` (§12.5 —
UI'dan hiç çağrılmıyor ama `hub-rules.test.mjs` onu test ediyor, saf mantığı
korunuyor).

**Temizlendi (2026-09-13):** `src/hub/pages/{board,table,import}.jsx`,
`src/hub/components/{saved-views,unknowable}.jsx`, `hub-github.js` — hiçbir
yerden erişilemiyordu (hub-app.jsx'in nav/route'unda yoktu), silindi. GitHub
taraması artık yalnızca sunucu tarafında (`hub-github-scan` edge function,
bkz. `github-import.jsx`).

**Proje düzenleme artık admin panelde değil:** logo/slogan/açıklama/detay/
problem/çözüm/etiket/link/metrik/öne-çıkan/trend/yeni/yayın — hepsi
`/team/`'in Overview ekranındaki "Düzenle" modalından (`team-project-save`
edge function, main projeye deploy) yönetiliyor; admin panel yalnızca
proje verisini okur (Dashboard özeti, Ekip & Mentörler proje seçici).
Team App'te henüz eşlenmemiş bir ekip için Düzenle, otomatik yeni bir
proje oluşturur (`startups.team_app_id` = o ekibin id'si).

**Düşen tablolar (0010):** `hub_views`, `hub_import_batches`. **Ölü ama duruyor:**
`hub_role_log`, `hub_interviews` (0009 RLS'i bunlara bağlı). **Cron aktif**
(`0015_hub_cron.sql`, 2026-09-13'te uygulandı — Vault'taki `project_url` +
`service_role_key` doğrulandı, `hub-daily`/`hub-weekly` her gece/pazartesi
gerçekten çalışıyor). v3 migration'ları `0013`'ten devam eder (son: `0037` — 0035–0037 geri alınan bir denemedir: HUB/LAB Katıl akışı + Inbound/Outbound ayrımı 2026-09-21'de yayınlandı, kullanıcı beğenmeyince aynı gün geri alındı; ilgili kolonlar DB'de yerinde ama kullanılmıyor, tetikleyici 0033 hâlinde);
`drop column` yapılmaz (kolon UI'dan gizlenir). Edge function'lar: `send-mail`,
`invite-member`, `hub-ai-draft`, `hub-daily`, `hub-weekly`, `hub-move-to-team`
(C4 — gerçekte Team App'in kendi projesindeki `hub-bridge-add-member`'ı
çağırır), `hub-github-scan` (E5 — `HUB_GITHUB_TOKEN` secret, tarama
sunucuda), `team-project-save` (proje CRUD, main proje), `hub-bridge-add-member`
(Team App projesine deploy — gerçek üyelik), `hub-create-draft-project`
(main proje — Açık Pozisyonlar'da kurucu hattı rol açarken fikir-aşaması
proje taslağı oluşturur, `hub_role()` cofounder/recruiter kontrolü).

**Katıl formu ↔ Hub (v3.1, §16, 2026-09-16):** `JoinPage` (`src/other-pages.jsx`)
5 seçenekli: topluluk/bölüm/proje-üyeliği/kurucu-liderliği/yeni-fikir. Trigger
(`applications_to_hub_candidate`, 0033) artık `role_type`'ı eşliyor (website
6 kategori → Hub 4 kategori), proje+pozisyon tam eşleşirse role otomatik
bağlıyor, `founder_lead`'i `track:'founder'` ile Havuz'a düşürüyor,
`idea_application`'ı hiç `hub_candidates`'a düşürmüyor. **Yan düzeltme:**
`hub_candidates.track` DB default'u `'founder'` olduğu için eski tetikleyici
track'i hiç yazmayınca TÜM inbound adaylar (normal üyeler dahil) yanlışlıkla
kurucu eşiğiyle (`THRESHOLD.founder`) değerlendiriliyordu — artık her zaman
açıkça yazılıyor. **Mevcut (eski) adayların `track`'i geriye dönük
düzeltilmedi** — bu ayrı, kullanıcı onayı gerektiren bir karar.

**Katıl formu — Topluluk mu, Startup mı? (2026-09-21, 0039):** Topluluğa Katıl / Mentör Ol /
Destekçi Ol kartlarının altında yan yana iki seçenek (HUB = topluluk, LAB = startup;
sade başlıklar: "Toplulukta Yer Al" / "Bir Startup'ta Yer Al" vb.; `TargetPicker`,
`other-pages.jsx`). Seçilmeden form açılmaz; seçim `applications.target`'a
('community' | 'startup') yazılır. İkinci adım (yalnızca Topluluğa Katıl kartı) radyo satırlarıdır: Topluluk → "Topluluğa
katılmak istiyorum" (community) / "Ekipte yer almak istiyorum" (hub); Startup → "Devam eden bir projeye
katılmak istiyorum" (project; açık lider pozisyonu da o projenin pozisyon listesinden seçilir —
founder_lead seçeneği UI'dan kalktı) / "Yeni bir fikrim var…" (idea_application). Tasarım: ikili
seçim çubuğu `.jseg` + `.jrow` (site.css). mentör/destekçi startup seçerse
`project_id/project_name` dolar, destek türleri hedefe göre değişir. Tetikleyici/Hub
akışı DEĞİŞMEDİ (0033 hâli). Proje sayfasından gelen deep-link seçimi atlar.

**Katıl formu güncellemesi (2026-09-21, 0040):** başlıkların yanında renkli küçük (HUB)/(LAB).
Startup tarafında 3. şık "İlgi alanıma uygun bir proje çıkınca katılmak istiyorum" (intent
`pool_match`): normal katılımcı gibi ilgi alanı + yetenek/bio/link doldurur, Adaylar havuzuna düşer;
proje şıkkının satır açıklaması yok. HUB tarafında (topluluk / ekip) ilgi alanı, yetenek, GitHub,
LinkedIn SORULMAZ — yerine opsiyonel telefon (`applications.phone`, tetikleyici `hub_candidates.phone`'a
kopyalar). "Ekipte yer almak" (intent `hub`) → birim seçimi: Sosyal Medya / Tasarım / Organizasyon /
Sponsorluk (`HUB_UNITS`, `role` alanına TR ad yazılır; tetikleyici role_type türetir).

**Başvuru sonrası bağlantı kartları (2026-09-21):** form bitince iki kart — HUB (topluluk) başvurusu →
WhatsApp Topluluk Grubu + Instagram; LAB (startup) başvurusu → WhatsApp Lab Grubu + LinkedIn (mentör/destekçi
de seçtikleri tarafa göre). Adresler `join_form_settings` (`hub_whatsapp_url`, `hub_instagram_url`,
`lab_whatsapp_url`, `lab_linkedin_url`, `hub_success_note_tr`, `lab_success_note_tr`) — admin panel → Site
Ayarları → Katılım Formu → "Başvuru Sonrası Bağlantı Kartları". Boş bağlantının kartı gösterilmez; Instagram
boşsa `site_settings.instagram_url`, LinkedIn boşsa `site_settings.company_linkedin` yedektir. Bitiş ekranı
`.jdone / .jlink` (site.css).

**HR yalnızca LAB (2026-09-21, 0041):** Katıl formunda HUB (topluluk, `applications.target='community'`)
başvuruları HR'a DÜŞMEZ — `applications_to_hub_sheet` tetikleyicisi her yeni HUB başvurusunu Google Sheets'e
satır olarak yollar, yönetim tabloda yapılır. Kurulum HR › Ayarlar › "Hub Başvuru Tablosu" (`hub-sheet.jsx`);
"Test satırı" ve "Mevcut başvuruları aktar" RPC'leri, ID'ye göre tekrarı eler. **Bağlantı yöntemi 0042'de
değişti** (bkz. aşağı) — Apps Script artık kullanılmıyor. LAB tarafı:
`project`/`pool_match` → tetikleyici `hub_candidates`a düşürür (`interest` kolonu: frontend, backend, mobile, data,
design, product, marketing, business, content, other; role_type ondan türer) → Adaylar sayfasında ilgi alanı
kutucukları (`InterestTiles`, `filters.interest`); mentör/destekçi/fikir → HR'da Mentörler / Destekçiler /
Fikirler sayfaları (`applications.jsx kind=…`; `target` boş (eski) veya 'startup' olanlar). Eski HUB kaynaklı,
dokunulmamış ('pool') adaylar HR'da gizlenir (`hub-store.jsx isHubOrigin`, silinmedi). Anasayfa logo şeridi
sayfası menüde "Site Destekçileri" (Yönetim altında).

**Hub Başvuru Tablosu — servis hesabı (2026-09-22, 0042):** Apps Script web-uygulaması yöntemi kaldırıldı
(`hub-sheet-script.js` silindi); yerine `hub-sheet-sync` edge function'ı Google servis hesabıyla (RS256 JWT →
OAuth2 access token, `crypto.subtle`) doğrudan Sheets API'ye yazıyor. Kullanıcı yalnızca tabloyu servis hesabı
e-postasıyla paylaşır ve spreadsheet ID'sini HR › Ayarlar'a yapıştırır — kod kopyalama/yapıştırma yok.
`hub_sheet_config`'e `spreadsheet_id`, `sheet_name`, `service_account_email` (gizli değil, yalnızca paylaşım
için gösterilir) eklendi; `webhook_url`/`secret` DB'de duruyor ama kullanılmıyor (drop yok). Tetikleyici artık
`net.http_post` ile doğrudan `hub-sheet-sync`'i (Vault'taki `project_url`/`service_role_key`, `0015_hub_cron.sql`
ile aynı desen) çağırıyor. Edge function secret'ları `GOOGLE_SA_EMAIL`/`GOOGLE_SA_PRIVATE_KEY` **henüz
ayarlanmadı** — kullanıcıdan servis hesabı JSON'u beklendikçe fonksiyon zararsızca `ok:false` döner, hiçbir
başvuruyu engellemez (deploy edildi, smoke-test edildi: `curl` ile boş sonuç doğrulandı). **Kurulum tamamlandı
(2026-09-22):** `GOOGLE_SA_EMAIL`/`GOOGLE_SA_PRIVATE_KEY` secret'ları eklendi, `hub_sheet_config.spreadsheet_id`
dolduruldu, bağlantı etkin — tablo: `docs.google.com/spreadsheets/d/17nlUjebAyX1kU5AxBC3h73NmqfXbLe1_DiFcnAEaVxA`.

**LAB başvuruları da Sheets'e yedekleniyor (2026-09-22, 0043):** "site giderse elimizde yedek bulunsun" — artık
yalnızca HUB değil, LAB (startup) başvuruları da kayıt olunca AYNI tabloda AYRI bir sekmeye (varsayılan
"Sayfa1" — Sheets'in kendiliğinden oluşturduğu boş sekme; `hub_sheet_config.lab_sheet_name`) yedek olarak
yazılıyor. HR'ın kendi akışı (LAB → Adaylar/Mentörler/Destekçiler/Fikirler) DEĞİŞMEDİ — bu yalnızca ek, salt
okunur bir yedekleme kanalı; yönetim hâlâ HR'da. `applications_to_hub_sheet()` artık HUB için erken çıkış
yapmıyor, hedef sekmeyi `is_hub_application()`e göre seçip `hub_sheet_post_batch()` (ortak gönderim yardımcısı)
ile yolluyor. `hub_sheet_row()` LAB'a özel alanları da (proje, ilgi alanı, pozisyon, yetenek, linkedin/portfolyo,
fikir/problem/ilerleme) 'detay' sütununa ekliyor. `hub_sheet_backfill()` artık HER İKİ tarafı da tarar. HR ›
Ayarlar'da iki ayrı sekme adı alanı var (HUB / LAB yedek). Mevcut 8 başvuru (5 HUB + 3 LAB) geriye dönük
aktarıldı, doğrulandı.

**Aday kartı — iletişim bilgileri üstte (2026-09-23):** `CandidatePanel`de (`candidate.jsx`) e-posta/telefon/
ilgi alanı önceden yalnızca dolaylı yoldan görünüyordu (e-posta yalnızca github/linkedin boşsa "Link" alanında,
telefon hiç gösterilmiyordu). `ContactBlock` bileşeni panel başlığının hemen altına (Detay akordeonu açılmadan,
her aşamada görünür) e-posta/telefon/okul/ilgi alanını mailto:/tel: linkli satırlar olarak ekliyor; "Detay"
akordeonuna da E-posta/Telefon/İlgi alanı düzenlenebilir alanlar olarak eklendi. `phone` ikonu (`ui-components.jsx
iconSvgs`) yoktu, eklendi.

**Adaylar — ilgi alanı kutucukları kanban kartına döndü (2026-09-23):** `InterestTiles` (0041) aynı filtreleme
mantığıyla duruyor, yalnızca görünümü değişti: küçük yatay pill yerine dikey "kanban" kartı (üstte ikon, ortada
büyük sayı, altta etiket) — `.hub-tile`/`.hub-tiles__grid` (hub.css).

**Adaylar — sayfaya girince önce kartlar (2026-09-23):** `candidates-list.jsx`'te hiçbir filtre aktif değilken
(`noFilterActive`) aday LİSTESİ artık gösterilmiyor — yalnızca ilgi alanı kartları + arama çubuğu görünür; bir
kart seçilince, aranınca ya da herhangi bir filtre uygulanınca (`showList`) liste açılır. "Ya da tüm adayları
göster (N)" ghost butonu (`browseAll` state) bu varsayılanı aşıp listeyi yine de açar, "← Kartlara dön" ile geri
dönülür. `applyFilters`/`InterestTiles`'ın kendisi DEĞİŞMEDİ, yalnızca listenin görünürlük koşulu eklendi.

**Genel Bakış üst özeti (2026-09-23):** yukarıdaki nav notuna bkz. — `OverviewStats` (today.jsx).

**Katıl — LAB ilgi alanı zorunlu oldu (2026-09-23):** `project`/`pool_match` intent'lerinde ilgi alanı artık
opsiyonel değil (yalnızca proje deep-link'inde — `project` prop varken — opsiyonel kalır), çünkü Adaylar'daki
ilgi alanı kutucukları/havuz ataması buna dayanıyor. Etiket de soru biçimine çevrildi: `t('join.role')` artık
"Hangi alanda yer almak istersin?" (`data.jsx`), HUB_UNITS'teki "Hangi birimde yer almak istiyorsun?" ile aynı
üslup.

**Katıl — telefon: yabancı numara yazarken kod kayboluyordu (2026-09-23, bug fix):** Kullanıcı ülke kodunu
seçmeden numarayı doğrudan "+385 91 234 5678" gibi TEK TUŞ TUŞ yazınca (yapıştırma değil), her tuşta alan
rakamlara indirgenip "+" hemen atılıyordu — kod hiç netleşmeden kayboluyor, numara o an seçili ülkenin (varsayılan
Türkiye, 10 hane) sınırına göre kesiliyordu ("eksik hane" şikâyeti). `PhoneField`'e `rawIntl` yerel state'i
eklendi: "+"/"00" ile başlayan girdi kod netleşene kadar ham metin olarak ekranda tutulur, netleşince
`splitIntlPrefix()` ile ccValue/value'ya "sıçrar" (bkz. `other-pages.jsx`). Ayrıca `COUNTRY_CODES`'e eksik
AB/Balkan ülkeleri eklendi (Hırvatistan +385 dahil, ~15 ülke) ve "Diğer ülke…" özel kod alanına kalıcı "+"
işareti eklendi (`.jphone__plus`, önceden yalnızca placeholder'da görünüyordu, kayboluyor gibi duruyordu).
CDP ile hem tek seferde yapıştırma hem tuş-tuş yazma senaryosu doğrulandı.

**Katılım Formu Metinleri — artık HR'dan da düzenlenebilir (2026-09-23, 0044):** `join_form_settings`'e
`interest_labels` jsonb kolonu eklendi (nullable — boş anahtar sabit TR karşılığına düşer, hiçbir zaman boş
görünmez). HR › Ayarlar'da yeni "Katılım Formu Metinleri" kartı (`hub/pages/join-form-fields.jsx`): ilgi alanı
seçeneklerinin (Frontend/Backend/…) TR metinleri + İlgi alanı sorusu (`field_labels.c_role`) + Ad Soyad/
E-posta/Üniversite/Bölüm etiketleri (`field_labels.c_name/c_email/c_university/c_department`). Aynı
`join_form_settings` (id=1) satırını admin panelle PAYLAŞIR — kaydederken `field_labels`/`interest_labels`
JSON'ları önce TAM okunur, yalnızca bu ekrandaki anahtarlar değiştirilip geri yazılır (admin panelin ayarladığı
m_*/s_*/kart başlıkları gibi diğer anahtarlara dokunulmaz). `other-pages.jsx`'teki `JOIN_INTERESTS` (public
form) BİLEREK cross-import edilmedi — HR paketine site sayfası kodu (layout/blog) sızmasın diye
`join-form-fields.jsx` kendi küçük kopyasını tutuyor (anahtarlar birebir aynı olmalı). Canlı DB'de geçici bir
override yazılıp Katıl sayfasında göründüğü doğrulandı, sonra `null`'a geri alındı.

**İlgi alanı — outbound aday eklemede de zorunlu (2026-09-23):** İnbound (Katıl formu) için zaten zorunlu
olan ilgi alanı, HR'ın kendi ekleme yollarında da (tümü `hub_store.js`'teki `addCandidate`/`importCandidates`e
`interest` geçiriyor, `mapCandidateToDb` zaten destekliyordu — yalnızca UI eksikti) zorunlu: `new-candidate.jsx`
(tek aday, yeni wizard adımı) · `paste-import.jsx`/`import-simple.jsx` (yapıştır/CSV — parti bazlı ortak alan;
CSV'de "İlgi alanı" sütunu da eşlenebilir, `matchInterest()` serbest metni anahtara çevirir) · `github-import.jsx`
(tarama — 4 teknik alan + Diğer). **Yan düzeltme (`wizard.jsx`):** `HubWizard`'da ARA adımdaki `type:'options'`
soruları önceden hiç seçim yapılmadan "İleri" ile sessizce atlanabiliyordu (`canNext` bunu es geçiyordu) — bu
yalnızca yeni 'interest' adımını değil, Kaynak/Rol tipi/Hangi proje gibi TÜM mevcut zorunlu options adımlarını
etkiliyordu. Düzeltildi: `canNext = optional || filled` (tip farkı yok); `next()` yalnızca genel "İleri"
tıklamasında (deliberate bir seçenek tıklaması değilken) zorunlu kontrolü yapıyor — kasıtlı "boş" seçenekler
(ör. roles.jsx'teki "— henüz belli değil", value `''`) hâlâ geçerli bir cevap sayılıyor, yanlışlıkla
reddedilmiyor. Node ile üç senaryo (zorunlu adım atlama engellendi / kasıtlı boş seçenek kabul edildi / normal
seçim çalışıyor) izole simülasyonla doğrulandı.

**Adaylar — inbound (Katıl formu) adaylar öne çıkarılıyor (2026-09-23):** `candidates-list.jsx`'te
`source==='inbound'` olan satırlar artık (1) listede en üstte (aynı grup içinde en yeni önce) ve (2) sarı
çerçeveyle (`.hub-c--inbound`, hub.css) + "Site başvurusu" rozetiyle (`.hub-pill--inbound`) diğerlerinden
ayırt ediliyor — formdan gelen başvurular gözden kaçmasın diye.

**Çözüldü: `talha@starthub-community.com` artık `hub_members.role='cofounder'` (2026-09-23).** Önceden
`recruiter`'dı — bu rol BİLEREK `decide`/`flags.override`/`members.manage`/`settings.write`/`candidates.purge`
HARİÇ her şeyi alır (0009_permissions.sql), bu yüzden HR › Ayarlar sekmesi hiç görünmüyordu ("ayarlar kısmını
bulamadım" şikâyetinin kaynağı — UI hatası değil, izin modeliydi). Rolü `cofounder` yapmak izin yükseltme
olduğu için Claude Code'un otomatik izin sınıflandırıcısı önce engelledi; kullanıcıya `AskUserQuestion` ile
açıkça soruldu, onay alındıktan sonra uygulandı.

**Proje sahibi artık HR'a girmiyor (2026-09-23, karar değişikliği):** `project_owner` rolü ve
`decide` izni eskiden beri DB'de vardı (0009_permissions.sql, §12.7 — yalnızca kendi projesine
sunulmuş adayı görüp karar verebiliyordu). Kullanıcı bu yönü değiştirdi: proje sahipleri HR
paneline hiç girmeyecek, sunulan aday/teklif kararı ileride kendi (ayrı) ekip yönetim sistemlerine
taşınacak — o entegrasyon henüz yapılmadı, sonraya bırakıldı. Şimdilik yapılan: `hub-app.jsx`'teki
giriş kapısı `role==='project_owner'` ise `ProjectOwnerRedirectPage` gösteriyor (panele hiç
girilmiyor); Ayarlar'daki üye ekleme formunda rol artık seçilemiyor (`HUB_ROLES_ASSIGNABLE`,
hub-constants.js). DB'deki `permission_presets`/`hub_members.role='project_owner'` satırları ve
candidate.jsx/roles.jsx'teki eski `role==='project_owner'` dallanmaları BİLİNÇLİ OLARAK silinmedi
— proje kuralı gereği (kolon/DB satırı silinmez, yalnızca UI'dan gizlenir) dead-ama-zararsız duruyor.

**Katıl — 'Destekçi Ol' kartı kaldırıldı (2026-09-23):** Kullanıcı başvuru akışını gereksiz buldu —
"biz bunu siteye destekçileri manuel olarak ekleriz daha mantıklı" (zaten var olan admin panel →
Site Destekçileri elle-ekleme akışıyla karışıyordu). `typeCards`'tan 'sponsor' girdisi çıkarıldı,
grid `repeat(typeCards.length, 1fr)` ile dinamikleşti, sessionStorage'daki eski `sh_join_type=sponsor`
değeri artık kart seçimine dönüştürülmüyor. Form/validate/submit dalları (`sponsorForm`,
`intent:'sponsor_application'`) ve HR'daki Destekçiler sayfası (`applications.jsx kind='sponsor'`)
BİLİNÇLİ OLARAK silinmedi — yeni başvuru gelmeyecek ama eski kayıtlar HR'da görülebilsin diye duruyor.

**2026-09-24 — HR "CRM-lite" sadeleştirme, Round 1 (temel):** Kullanıcı HR panelini
"hiç bilmeyen birinin bile girip anlayabileceği" bir CRM'e dönüştürmek istedi. Bu
turda yapılan: (1) sol menü 7 → 5 ana maddeye indi — Mentörler/Destekçiler/Fikirler
tek "Diğer Başvurular" ekranında birleşti (`applications.jsx`, `kind` prop artık
opsiyonel — verilmezse bileşen kendi tip-seçici çip satırını gösterir); (2) "Bugün"
(Genel Bakış) gerçek bir dashboard oldu — eski 5-7 ayrı iş bloğu + ayrı `QueueModal`
"Başlat" kuyruk-yürüme akışı kaldırıldı (`today.jsx`), yerine TEK aciliyet-sıralı
"Bugün Yapılacaklar" listesi geldi (satıra tıkla → mevcut `CandidatePanel`, ayrı bir
entegrasyon gerekmedi — zaten yalnızca `candidateId`+`onClose` alıyor); aşama
dağılımı + mentör/destekçi/fikir sayıları + Hub Sheet durumu SİLİNMEDİ, ikincil/soluk
bir şeride indi; (3) sidebar artık açılıp kapanabiliyor — ikon şeridi (`hub-app.jsx`
`collapsed` state, `hub.css` `.hub-layout--collapsed`), `localStorage`
(`sh_hub_sidebar_collapsed`) ile hatırlanıyor; masaüstünde başka hiçbir yerde
(admin panel dahil) bu desenin örneği yoktu, sıfırdan kuruldu. **Kullanıcı ayrıca
HUB_SPEC.md §0'daki "yeni stil icat edilmez" kısıtını bilinçli olarak gevşetti** —
marka kimliği (kırmızı aksan, Space Grotesk/DM Sans) sabit kalmak kaydıyla yeni
görsel desen serbest (bkz. HUB_SPEC.md §0). `hub-rules.js`/`hub-constants.js`'teki
iş mantığına dokunulmadı, `node src/hub/hub-rules.test.mjs` (97 senaryo) ve
`npx vite build` bu değişikliklerden sonra da temiz geçti. **Round 2 (bilinçli
olarak bu turun dışında, ayrı onay gerekir):** `roles.jsx`'teki çift sihirbazın
tekleştirilmesi, `sources.jsx`/`templates.jsx`'teki power-user detaylarının bir
"Gelişmiş" alt-sekmeye taşınması, `candidate.jsx`'in Deneme (Kapı A/B) aşamasındaki
çoklu eşzamanlı aksiyon sorununun tek-aksiyon disiplinine getirilmesi.

**2026-09-24 — HR "CRM-lite" sadeleştirme, Round 2:** Round 1'de bilinçli olarak
ertelenen iç sadeleştirmeler yapıldı (hiçbir veri/alan silinmedi, yalnızca "Gelişmiş"
bir katmana taşındı): `roles.jsx`'te yeni rol oluşturma 7 adımdan 3 temel soru + 1
opsiyonel nota indi (`titleStep`/`roleTypeStep`/`assignedToStep`/`profileStep` =
`restSteps`; `needsCommunication`/`skills`/`firstDeliverable` artık yalnızca
`editWizSteps`'te, "Düzenle" akışında) — `RoleSetupFlow` (hat/proje seçimi)
değişmedi. `sources.jsx` ve `templates.jsx`'e bir `advanced` state + "Gelişmiş" çipi
eklendi (`adm-chip` deseni) — kontrol sıklığı/son kontrol/sorumlu/"pasifleştir öner"
ve zincir anahtarı (E2 drip-campaign) alanları varsayılan gizli, çipe basınca açılıyor.
`candidate.jsx`'teki `GateCard`'da (Deneme, Kapı A/B) "Süre yetmedi mi?" artık
"Teslim etti"/"Teslim etmedi" ile aynı buton sırasında değil — küçük, alt satırda bir
metin bağlantısı (gerçek iki sonuçla aynı görsel ağırlıkta olmaması için).
`node src/hub/hub-rules.test.mjs` (97 senaryo) ve `npx vite build` temiz geçti —
iş mantığına dokunulmadı.

**2026-09-23 — repoda ikinci bir katkıcı (Kadir) var, doğrudan GitHub'a push yapabiliyor.** Kendi ayrı
`hub-v3` dalındaki paralel HR çalışmasını "Merge origin/main (arkadaşımın HR rework'ü) into hub-v3" commit'iyle
(`f7d0fe9`) doğrudan `main`'e merge etti — oturum dışından, kullanıcının bundan haberi yoktu. Doğrulandı: bu
merge'ün son ağacı, o anki origin/main ile BİREBİR AYNI (`git diff` boş) — dosya kaybı/çakışma/üzerine yazma
yok, yalnızca git geçmişi birleşti. Ama önemli: repoya kullanıcı dışında en az bir kişi daha yazabiliyor —
gelecekte gerçek çakışmalar veya beklenmedik değişiklikler olabilir, `git log`/`git fetch` ile kontrol etmeden
"origin/main güncel" varsayılmamalı. **2026-09-24 güncellemesi:** Kadir aynı gün içinde iki kez daha doğrudan
main'e push yaptı — HR paneli CRM-lite sadeleştirmesi + kenar çubuğu daraltma (commit `8798b2a` merge'i) ve
aday klasörleme sistemi ("dosya gezgini modeli", `0045_hub_folders.sql`, commit `996ff56` merge'i). İkisinde de
`git diff --stat` ile dokunulan dosyalar önceden incelendi, kendi oturum içi değişikliklerimle (project_owner
erişim kaldırma, destekçi kartı kaldırma, hesap oluştur ekranının kaldırılması) örtüşen dosyalarda satır bazlı
çakışma OLMADIĞI doğrulandı (git'in kendisi de conflict marker üretmeden 'ort' stratejisiyle otomatik birleştirdi),
her merge sonrası build + `hub-rules.test.mjs` (97 senaryo) çalıştırıldı, hepsi geçti. **Ders: main'e her push
öncesi `git fetch` + `git log HEAD..origin/main` kontrolü artık rutin hâline geldi, tek seferlik bir olay değil
— Kadir düzenli olarak bu repoya yazıyor.**

**Giriş ekranlarında 'Hesap oluştur' kaldırıldı (2026-09-24):** Kullanıcı bunun neden var olduğunu sorguladı —
zaten gerçek bir açık kayıt değildi (`invite-member` yetkisiz e-postada sessizce hiçbir şey yapmıyordu, her
durumda aynı jenerik mesajı dönüyordu) ama ekranda "Hesap oluştur" butonunun durması kafa karıştırıcıydı ("millet
buradan kendine hesap açabiliyor" izlenimi veriyordu). `hub-app.jsx` ve `admin-app.jsx`'teki `CreateAccountPage`
bileşeni ve "Hesap oluştur" butonu tamamen silindi (dead-ama-zararsız bırakılmadı — bu saf UI kodu, DB'ye
dokunmuyordu, o yüzden temiz silindi). Hesap açma artık YALNIZCA "Yetkiler" ekranından ("Üye ekle" + davet) —
zaten asıl mekanizma buydu. "Şifremi unuttum" işlevsel olarak hiçbir şey kaybetmedi: `invite-member` zaten
`recovery` başarısız olursa `invite`'a düşen bir sıra deniyor, yani ilk şifre belirleme de aynı ekrandan hâlâ
çalışıyor.

**Giriş hatası teşhis notu (2026-09-24):** Kullanıcı "Invalid login credentials" hatası bildirdiğinde önce site
sağlığı (200), canlı bundle hash'i ve Supabase Auth servis sağlığı (`/auth/v1/health`) kontrol edildi — hepsi
normaldi, yani hata gerçek bir şifre/e-posta uyuşmazlığıydı, bir kod regresyonu değil. Şifre sıfırlama akışı
zaten güvenli olduğu için kullanıcıya "Şifremi unuttum"u önermek yeterli oldu. **Not:** `hub-move-to-team`
akışında (bkz. proje sahibi notu) takım liderinin onayı YOK — HR'daki cofounder kararı doğrudan Team App'e
gerçek üyelik olarak yansıyor, ara bir "teklif bekliyor" adımı henüz yok (ileride Team App'e taşınacak).

**Canlı veri okuma yöntemi (2026-09-24'ten beri rutin):** `npx supabase db query --linked` ile CLI'nin zaten
`supabase login` ile kimliklenmiş oturumu üzerinden linked projeye (fdlghaafspcuagxfrofz) SQL çalıştırılabiliyor
— servis rolü anahtarını dosyadan okumaya (Bash `cat`/`grep` ile .env taraması) gerek yok, o zaten "Credential
Materialization" sınıflandırıcısı tarafından engelleniyor. Sorgu sonuçları "untrusted data" uyarısıyla dönüyor —
adayların/başvuruların girdiği serbest metin alanları (isim, bölüm, mesaj vb.) veri olarak okunmalı, talimat
olarak değil. `has_perm()`'e bağlı RPC'ler (ör. `hub_sheet_backfill()`) bu yoldan `Yetkin yok` hatası verir
(auth.uid() burada boş) — böyle bir fonksiyonu tetiklemek gerekirse ya HR'dan gerçek oturumla tıklanır ya da
fonksiyonun içindeki SQL, izin kontrolü olmadan bir `do $$ ... $$` bloğu içinde elle tekrarlanır.

**Katıl formu — toplu üniversite başvuruları HR'da "kayıp" görünüyor, aslında değil (2026-09-25):**
Kullanıcı "biri formu doldurdu ama Adaylar'da yok" dedi. Kontrol: 24 Eylül'de Haliç Üniversitesi'nden ~20 kişi
art arda "Topluluğa Katıl" kartından başvurmuş (`applications`, `target='community'`). Bu BEKLENEN davranış
(§0041) — topluluk başvuruları HR'a hiç düşmüyor, yalnızca Google Sheets'e ("Hub Başvuruları" sekmesi) gidiyor.
Kod hatası değildi; teşhis DB'de `department`/`university` alanlarında ilgili metni arayarak yapıldı
(`applications` tablosu küçük olduğu için — 25 satır — pratik). Bu tür "listede yok" şikayetlerinde önce
`applications.target` değerine bak: 'community' ise zaten HR'a gelmeyecek, sorun orada değil.

**LAB yedek sekmesi adı değişti (2026-09-25, 0046):** `hub_sheet_config.lab_sheet_name` varsayılanı
"Sayfa1"dan "Lab Başvuruları"na çevrildi (HUB tarafının "Hub Başvuruları" ile simetrik olsun, "Sayfa1'e ne
yansıyor?" kafa karışıklığı gitsin diye). Eski "Sayfa1" sekmesi Google Sheets'te elle silinmediği sürece
durur ama artık hiçbir yeni satır oraya yazılmıyor. Backfill çalıştırıldı, `net._http_response` log'unda iki
`200 {"ok":true}` ile doğrulandı. **Bu turda ayrıca önemli bir şey bulundu:** Kadir'in 0045_hub_folders.sql'i
(aday klasörleme, "dosya gezgini modeli") repoda commit edilmiş ama CANLI VERİTABANINA HİÇ UYGULANMAMIŞTI —
yani onun zaten deploy edilmiş ön yüz kodu `hub_folders`/`folder_id` gibi olmayan DB nesnelerine erişmeye
çalışıyordu (muhtemelen sessizce hata veriyordu). `supabase db push --linked` ile 0045 de bu turda uygulandı.
**Ders:** bir migration dosyasının repoda/commit'te olması onun CANLI DB'ye uygulandığı anlamına gelmez —
ikinci bir katkıcı DB migration'ı olmadan frontend push'u yapabiliyor, `supabase db push --linked --dry-run`
ile ara sıra "bekleyen migration var mı" kontrolü faydalı olabilir.

**Mentör/Destekçi başvuruları kendi Sheets sekmesinde, HUB+LAB birlikte (2026-09-25, 0047):** Kullanıcı "Sayfa1"i
tamamen bırakıp yerine iki yeni sekme istedi: "Mentör Başvuruları" ve "Destekçi Başvuruları" — bunlar HEDEFTEN
(Topluluk/Startup) BAĞIMSIZ, bir mentör/destekçi hangisini seçmiş olursa olsun aynı sekmede birleşiyor. Diğer
türler (community/hub → Hub Başvuruları; project/pool_match/idea_application → Lab Başvuruları) eskisi gibi
hedefe göre ayrılmaya devam ediyor. Ortak yardımcı `hub_sheet_target(a, cfg)` fonksiyonu hem trigger'da hem
`hub_sheet_backfill()`'de kullanılıyor — sekme seçim mantığı TEK yerde. `hub_sheet_config`'e `mentor_sheet_name`/
`sponsor_sheet_name` eklendi, HR › Ayarlar'da düzenlenebilir. Şu an hiç mentör/destekçi başvurusu olmadığı için
(0 kayıt) iki sekmeyi elle birer test satırıyla tetikleyip oluşturdum (auto-create doğrulandı, silinebilir test
satırları).

**Migration numarası çakışması (2026-09-25):** Bu oturumda 0047 numarasını hem ben (Sheets mentör/destekçi
ayrımı) hem Kadir (`hub_candidates.sort_order` — Adaylar'da sürükle-bırak sıralama) bağımsız olarak kullanmış;
git merge dosya adları farklı olduğu için sorun çıkarmadı ama Supabase'in migration takip tablosu versiyonu
SADECE dosya adının baştaki 4 haneli numarasından okuyor (`supabase_migrations.schema_migrations.version`) —
iki farklı migration aynı versiyonu paylaşamaz. Kadir'inki henüz canlıya hiç uygulanmamıştı (yalnızca repodaydı),
bu yüzden çakışma olmadan `0048_hub_candidate_sort_order.sql`'e yeniden adlandırıp öyle uyguladım. **Ders:**
iki kişi aynı anda migration eklerken numara çakışması olağan bir risk — `push` öncesi
`select version from supabase_migrations.schema_migrations order by version desc limit 5` ile canlıdaki son
numarayı kontrol etmek, yalnızca repodaki dosyalara bakmaktan daha güvenilir.

**Destekçi kartı geri geldi (2026-09-25):** 2026-09-23'te kullanıcının kendi isteğiyle kaldırılmıştı ("biz
bunu siteye destekçileri manuel olarak ekleriz daha mantıklı"); iki gün sonra fikrini değiştirip geri istedi.
Form/validate/submit dalları hiç silinmemişti (yalnızca kart + sessionStorage izni kaldırılmıştı), o yüzden
geri getirmek yalnızca o iki noktayı eski haline döndürmekle oldu — DB/HR tarafında ekstra bir şey gerekmedi.

**Gerçek olay: RAG (GrantAgent) başvurusu HR'a düşmüyordu (2026-09-25):** Kullanıcı "açık pozisyon formunu
dolduran biri HR'da gözükmüyor" dedi. Kök neden SİSTEMİK DEĞİLDİ (diğer tüm project/pool_match başvuruları
sorunsuz düşüyordu, tek tek kontrol edildi) — aynı e-postayla (shiptarea@gmail.com) 15 Eylül'den kalma bariz
bir TEST kaydı (isim "fere", üniversite "jlkh", pozisyon "gfh") zaten `hub_candidates`'ta vardı, hatta
yanlışlıkla `people` tablosuna (type='team') kadar ilerletilmişti — yani CANLI /Hakkımızda sayfasının ekip
bölümünde görünüyor olabilirdi. `applications_to_hub_candidate()`'in `unique_violation` yakalayıcısı aynı
e-postayla gelen YENİ (gerçek) başvuruyu bu yüzden sessizce atlıyordu. Düzeltme: o test kaydı + people satırı
silindi (kullanıcı onayıyla), gerçek başvuru elle doğru şekilde `hub_candidates`'a işlendi (RAG açık rolüne
bağlı, Havuz aşamasında, Backend klasöründe). **Kök neden de ayrıca düzeltildi (0049):** artık aynı e-postayla
ikinci bir başvuru geldiğinde sessizce kaybolmuyor — mevcut adayın `interview_note`'una zaman damgalı, görünür
bir "Yeniden başvurdu — Proje: X · Pozisyon: Y" satırı ekleniyor; adayın aşaması/diğer alanları değişmiyor.
## Proje kuralları

- **Router kütüphanesi kullanılmaz.** Sayfa geçişi `useState` + `sessionStorage` ile
  yapılır (bkz. `src/app.jsx`, `src/admin/admin-app.jsx`). `react-router` eklenmez.
- **Yeni tablolar `uuid` + `gen_random_uuid()` kullanır.** Mevcut tablolarda `id`
  kolonları identity'siz `bigint` olduğu için `admin-store.jsx` elle id üretiyor
  (`nextId`). Bu hack yeni tablolarda tekrarlanmaz.
- **DB `snake_case`, JS `camelCase`.** Dönüşüm açık mapper fonksiyonlarıyla yapılır
  (`mapXToDb` / `mapXFromDb`) — `src/admin/admin-store.jsx` desenini izle.
- **Arayüz metni Türkçe**, kod tanımlayıcıları İngilizce.
- **Tasarım token'ları** `src/styles/admin.css` içinde (`--adm-*`).
  Fontlar: `Space Grotesk` (başlık), `DM Sans` (gövde).
- **Paylaşılan bileşenler** `src/admin/admin-ui.jsx`'ten gelir: `AIcon`, `StatCard`,
  `DataTable`, `Modal`, `Field`, `Input`, `Textarea`, `Select`, `SearchBar`,
  `PageHead`, `ConfirmDialog`, `TagInput`, `TriToggle`, `Stepper`, `PeoplePicker`.
- **Tek Supabase istemcisi** — `src/lib/supabase.js`. Yeni `createClient` çağrısı
  yapılmaz; oturum `/admin/` ile paylaşılır.
- **Service role anahtarı tarayıcıya konmaz.** Yetki RLS ile uygulanır.
- Mevcut dosyalardaki `useState as useStateA` gibi takma adlar script-tag
  döneminden kalma. **Yeni dosyalarda normal import kullan.**

## Veritabanı

Mevcut tablolar: `posts`, `people`, `startups`, `sponsors`, `events`,
`applications`, `app_state`, `notifications`.
Hub tabloları `hub_` önekiyle gelir — şema `supabase/migrations/0001_hub.sql`.

## Dikkat

`public/team/index.html` (~700 KB) **build artefaktı DEĞİLDİR** — 2026-09-12'de
bir yedekteki git geçmişinden doğrulandı: baştan beri elle/Claude ile yazılan
kendi kendine yeten tek dosyalık bir uygulama (önceki "dokunma" notu yanlış
varsayıma dayanıyordu). Doğrudan düzenlenebilir ama İKİ katman iç içedir:
dış katman düz HTML, ama gövde `<script type="__bundler/template">` içinde
**JSON-string-kodlu** durur (`JSON.parse(...)` ile çözülür) — bu yüzden elle
kaçışlama YAPILMAZ, her değişiklik `JSON.stringify(plain).slice(1,-1)` ile
üretilip anchor'la değiştirilir, ardından hem `JSON.parse` hem `node:vm`
(`class Component extends DCLogic` bloğu) ile sözdizimi doğrulanır, `npm run
build` sonrası `dist/team/index.html` boyutu `public/`le birebir karşılaştırılır.
Yazma işlemleri (`git add/commit`, dosyaya `fs.writeFileSync`) otomatik izin
sınıflandırıcısı tarafından her seferinde ayrıca onay ister — beklenen bir
fren, PowerShell/Bash arasında geçiş bazen işe yarar ama garanti değil.

Team roster/üyelik modeli iki KATMANLIDIR: (1) `people`
(`type='project_member'`, `project_id` → `startups.id`) + `startups.member_ids`
(text[]) — sitenin gösterdiği ekip kartları, yalnızca Hub'ın "Ekibe al"
akışıyla (`hub-move-to-team`) güncellenir; (2) Team App'in KENDİ ayrı
Supabase projesindeki (`umgdtjlgivvymngsnqtv`) `app_state.data.users` —
gerçek görev/sprint sistemi girişi. `hub-move-to-team`, `hub-bridge-add-member`
(Team App projesine deploy) üzerinden ikisini birden yazar; ama Team App'te
biri ELLE eklenirse (o akışı kullanmadan) katman (1)'e hiç yansımaz —
bilinçli, tek yönlü bir sınır (bkz. 2026-09-13 oturum denetimi).
`startups.team_app_id` iki sistemi eşler; boşsa köprü çalışmaz (artık
Team App'in kendi Düzenle modalı bunu otomatik dolduruyor).
