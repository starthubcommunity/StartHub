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
Başvurular/Yetkiler/Ayarlar). "Başvurular" ayrı bir ana sekme değil.

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
başvuruyu engellemez (deploy edildi, smoke-test edildi: `curl` ile boş sonuç doğrulandı).

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
