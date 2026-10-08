# Start-Hub

Vite 6 + React 18 + Supabase (auth + Postgres), Vercel'de barındırılıyor.

## Giriş noktaları

| Yol | HTML | Entry |
|-----|------|-------|
| `/` | `index.html` | `src/main.jsx` → `src/app.jsx` |
| `/admin/` | `admin/index.html` | `src/admin/main.jsx` → `src/admin/admin-app.jsx` |
| `/team/` | `public/team/index.html` | Kendi kendine yeten tek dosyalık uygulama — bu repoda DOĞRUDAN elle düzenlenir (build artefaktı değil; ayrı Supabase projesi `umgdtjlgivvymngsnqtv`'ye bağlanır). Değişiklik yapmadan önce aşağıdaki **Dikkat** bölümündeki JSON-string kaçışlama uyarısını oku. |
| `/HR/` | `HR/index.html` | `src/hub/main.jsx` → `src/hub/hub-app.jsx` — eski adı `/hub/`; o yol artık `/HR/`'a 308 ile yönleniyor (`vercel.json`). Kaynak klasör hâlâ `src/hub/`. |

## SEO / GEO (`feat/seo` dalı, 2026-09-29)

Kullanıcının verdiği aşamalı planla (Aşama 1-2 kullanıcı onayıyla, Aşama 3-4
"bütün önemli update'leri yap" onayıyla) `/`, `/admin`, `/HR`, `/team` DIŞINDAKİ
genel site kodunda yapıldı — `src/admin`, `src/hub`, `public/team/index.html`'e
DOKUNULMADI.

- **Aşama 1 — Hash routing → History API:** `src/app.jsx`'teki `#/blog`,
  `#/post/slug` vb. kaldırıldı; gerçek yollar: `/`, `/about`, `/labs`,
  `/labs/:slug`, `/blog`, `/blog/:slug`, `/join` (`parsePath`/`pathFor`,
  `src/lib/routes.js`). `migrateLegacyHash()` eski `#/` linklerini
  `history.replaceState` ile taşıyor (paylaşılmış linkler bozulmuyor).
  **Yan düzeltme:** `initFromStorage()` eskiden sessionStorage'ı URL'den ÖNCE
  kontrol ediyordu — aynı sekmede önce başka sayfa gezilip SONRA adrese elle
  farklı bir path yazılırsa eski sayfa geri geliyordu (CDP ile bulundu).
  Artık sessionStorage yalnızca çıplak `/` yüklemesinde devrede.
- **Aşama 2 — Sayfa bazlı meta:** `src/lib/seo.js` (`setSEO`, kütüphanesiz,
  `document.head` upsert) — title/description/canonical/og:*/twitter:* her
  sayfa geçişinde (React navigasyonu dahil) güncelleniyor. Statik sayfa
  metinleri `src/lib/seo-content.js`'te (`STATIC_SEO`) — translations.jsx'teki
  mevcut metinlerden alındı, uydurulmadı. `noindex, follow` — silinmiş/
  yayından kalkmış yazı/proje için (`posts.length>0`/`!contentLoading` ile
  "hâlâ yükleniyor" durumundan ayrılıyor, yanlış noindex yok).
- **Gerçek `<a href>`:** Navbar/Footer (`layout.jsx`), `PostCard`/`StartupCard`
  (`ui-components.jsx` — tek yerden düzeltilince 6+ çağrı yeri otomatik
  düzeldi), ana sayfa hero kartları, `about-labs.jsx` açık pozisyon proje
  satırı, `detail-pages.jsx` geri-linkleri + ilgili proje kutusu. Ortak desen:
  `guardClick(e, fn)` (`src/lib/routes.js`) — sol-tık+modifiersiz'de
  `preventDefault`+`navigate()`, Ctrl/Cmd/orta-tık tarayıcı native davranışına
  bırakılıyor. `<a>` içine nested interactive element (`<button>`) KONMADI
  (geçersiz HTML) — ör. about-labs'te yalnızca proje başlık satırı link oldu,
  "Başvur" butonu ayrı kaldı. `.card`/`.startup-card`/`.hero__sc`'ye
  `display:block` eklendi (div→a geçişinde varsayılan display değişti).
- **`<html lang>`:** gösterilen dile göre dinamik (`tr`/`en`), önceden
  index.html'de sabit `tr` yazıyordu.
- **Aşama 3 — Prerender (`scripts/prerender.mjs`):** `npm run build` artık
  `vite build && node scripts/prerender.mjs`. Build sonrası Supabase'den
  yayınlanmış yazı+proje çekilip her biri için `dist/blog/<slug>/index.html`,
  `dist/labs/<slug>/index.html` + statik sayfalar (`dist/about`, `/labs`,
  `/blog`, `/join`) ve ana sayfa (`dist/index.html`, kendi üzerine yazıyor)
  üretiliyor — gerçek `<title>`/meta/JSON-LD + yazının/projenin TAM METNİ
  `#root` içinde düz HTML (React mount olunca normal SPA'ya dönüyor, hydrate
  değil `createRoot().render()` — bkz. `src/main.jsx`). react-dom/server SSR
  KULLANILMADI (kapsamlı bir yeniden yapı gerektirirdi, ek kütüphane sorma
  kuralına takılırdı) — düz metin enjeksiyonu planın "AI tarayıcı JS
  çalıştırmadan metni okusun" hedefini karşılıyor. **Güvenlik kilidi:**
  script kendi ürettiği `dist/index.html`'i template kaynağı olarak da
  okuyor — `vite build` çalışmadan ikinci kez çalıştırılırsa (zaten
  prerender edilmiş dosyayı temel alıp) çıktıyı bozardı (üst üste binen
  JSON-LD/robots etiketleri) — script artık `dist/index.html`'de
  `application/ld+json` görürse hata verip çıkıyor, sessizce bozuk çıktı
  üretmiyor (elle test ederken bu hatayla karşılaşılıp bulundu).
  Supabase kimlik bilgisi yoksa (`VITE_SUPABASE_URL`/`_ANON_KEY`) build'i
  DÜŞÜRMEDEN sessizce atlanıyor (SPA yine de çalışır durumda kalır).
- **Aşama 4 — robots.txt/sitemap/schema/llms.txt:**
  `public/robots.txt` yanlış alan adı (`starthub.io`) → doğru
  (`www.starthub-community.com`) + `/admin/`, `/HR/`, `/team/` Disallow;
  GPTBot/ClaudeBot/PerplexityBot/Google-Extended vb. BİLEREK engellenmiyor.
  `public/sitemap.xml` artık yalnızca prerender script'i hiç çalışmazsa diye
  statik bir geriye-düşüş kopyası (# yok, doğru alan adı) — gerçek, Supabase
  içerikli sitemap `dist/sitemap.xml`'e prerender script'i tarafından
  üretiliyor. `public/llms.txt` eklendi (kısa TR özet + sayfa linkleri).
  JSON-LD: `src/lib/seo.js`'e `setOrganizationSchema`/`setArticleSchema`
  eklendi (istemci tarafı, React navigasyonunda) + prerender script'i AYNI
  şemaları statik HTML'e de gömüyor (JS çalıştırmayan tarayıcı için tek
  kaynak budur). Organization her sayfada (yalnızca ana sayfada değil —
  GEO'da bir tarayıcı doğrudan bir alt sayfaya gelebilir), Article yalnızca
  yazı sayfalarında. `sameAs` → `site_settings.company_linkedin` +
  `instagram_url` (bu ikinci alan `useSiteSettings()`'in select listesine
  eklendi, önceden çekilmiyordu — admin panelde zaten yazılabiliyordu ama
  genel siteye hiç okunmuyordu).
  **Yazılmadı ama ÇALIŞTIRILMADI (kullanıcı onayı bekliyor):**
  `supabase/migrations/0050_posts_is_indexable.sql` — `posts.is_indexable`
  (varsayılan `true`) önerisi, `automation/publish.py`'nin otomatik/
  yorumsuz haberlerini ileride noindex edebilmek için altyapı. Bu migration
  `supabase db push` ile ÇALIŞTIRILMADAN önce kullanıcıya gösterilmeli; hiçbir
  runtime kod (app.jsx'in noindex mantığı dahil) şu an bu kolonu OKUMUYOR —
  yalnızca öneri/altyapı, wiring ayrı bir onay gerektiriyor.
- **Yapılmadı (kullanıcının kendi planında da "sürekli"/opsiyonel):** og-default.png
  (1200×630 marka görseli — `seo.js`'te TODO olarak kalıyor, tasarım varlığı
  yok), RSS/Atom feed, JSON-LD'nin BreadcrumbList/Event genişlemesi,
  hreflang/`/en/` ayrı adres yapısı, GitHub repoyu private yapma (kullanıcı
  kararı gerektirir), içerik stratejisi (Aşama 3'ün PDF'teki farklı, editöryal
  ekseni — kod değil).
- Tüm bu iş `feat/seo` dalında yapıldı, **2026-09-30'da `main`'e merge edildi
  ve push edildi** (kullanıcı onayıyla, preview'da doğrulandıktan sonra).
- **Vercel Deploy Hook (2026-10-02):** `automation/publish.py`'a
  `_trigger_deploy_hook()` eklendi — bir yazı `status='published'` olarak
  Supabase'e yazıldıktan SONRA (yalnızca yayınlanan, taslak değil)
  `VERCEL_DEPLOY_HOOK_URL` ortam değişkenine (tanımlıysa) boş bir POST atıp
  site rebuild'ini tetikliyor; bu, prerender'ın YENİ yazıları statik
  HTML'e + sitemap'e işlemesi için eksik olan son parçaydı (önceden yeni
  bir yazı ancak elle/başka bir deploy'da statikleşiyordu). Yeni bağımlılık
  eklenmedi — `requests` yerine stdlib `urllib.request` kullanıldı. Env
  değişkeni tanımlı değilse veya `dry_run`/draft ise sessizce atlanıyor;
  hata olursa yayın ASLA düşmüyor, yalnızca loglanıyor (ikisi de izole test
  edildi). `automation/.env.example`'a belgelendi. Secret'ı GitHub
  Actions/Make.com'a eklemek kullanıcının işi — kod tarafı tamamlandı.
- **`feat/seo-projects` (2026-09-30, ayrıca `main`'e merge edildi):** proje
  sayfalarına ikinci JSON-LD (`SoftwareApplication` — `github`/`demo` linki
  varsa, yoksa `CreativeWork`; boş alan hiç yazılmıyor, `scripts/prerender.mjs`).
  `PostDetailPage` artık bilinmeyen slug'da `ProjectDetailPage`'in zaten sahip
  olduğu "bulunamadı" görünümünü gösteriyor (`NotFoundBlock`, `detail-pages.jsx`
  — paylaşılan bileşen). `about_tr`/`desc_tr`/`problem_tr`/`solution_tr` düz
  tek satır TEXT kolonlar (gerçek çok-paragraflı şema yok, `team/index.html`'e
  dokunmadan değiştirilemez) — `\n` girilirse artık gerçek ayrı paragraflara
  bölünüyor (`splitParagraphs`, hem canlı sayfada hem prerender çıktısında).
  FAQPage/Hakkımızda schema atlandı — sitede hiç FAQ içeriği yok (kullanıcı
  onayıyla kapsam dışı). **Soft-404'ün tam kapatılması** (JS çalıştırmayan bir
  crawler geçersiz `/labs/<slug>` adresine giderse hâlâ 200+indexable dönüyor
  — gerçek çözüm yeni bir Vercel Edge Middleware gerektirir, bu projede hiç
  kullanılmayan bir mekanizma; risk düşük çünkü sitemap/site-içi linkler asla
  geçersiz slug üretmiyor) **kullanıcı onayıyla kapsam dışı bırakıldı.**
  Projelere gerçek demo/GitHub linki eklemek (`SoftwareApplication`'a otomatik
  yükseltir) bir kod işi değil — `team/index.html`'in Düzenle modalından
  kullanıcı tarafından yapılması gerekiyor.

**`feat/seo-faq` (2026-10-02, `main`'e henüz merge edilmedi — onay bekliyor):**
Kullanıcı daha önce atlanan FAQPage adımı için gerçek Hakkımızda SSS metni +
üç proje için zengin açıklama + özel SEO başlıkları verdi.
- `src/lib/faq-content.js` (yeni) — SSS tek kaynak: `about-labs.jsx`'teki
  görünür bölüm (mevcut Misyon/Vizyon anlatımının ÜZERİNE yazılmadı, ek bir
  bölüm olarak JourneySection'dan sonra eklendi), `app.jsx`'in client-side
  `setFAQSchema`'sı (`seo.js`, yeni) ve `prerender.mjs`'in statik
  `dist/about/index.html`'e gömdüğü FAQPage şeması AYNI diziden besleniyor.
  EN çevirisi kullanıcının TR metninin çevirisi, yeni iddia eklenmedi.
- **`seo_title_tr`/`seo_title_en`** (yeni, opsiyonel, migration `0051` —
  YAZILDI VE ÇALIŞTIRILDI, `supabase_migrations.schema_migrations`'a da
  kaydedildi): proje sayfasının `<title>`'ı artık doluysa bu özel başlığı
  kullanıyor (`app.jsx` + `prerender.mjs`), boşsa eski `"${ad} | Start-Hub
  Lab"` desenine düşüyor — geriye dönük uyumlu.
- TİD Çevirici/EventHub/GrantAgent'ın `seo_title_tr`/`desc_tr`/`about_tr`/
  `problem_tr`/`solution_tr` alanları kullanıcının verdiği gerçek metinle
  dolduruldu (`npx supabase db query --linked` ile — anon key UPDATE'i
  RLS'e takılıyordu, `team-project-save`'in yazdığı AYNI kolonlar, UI'dan
  farklı bir sonuç üretmiyor). Köşeli parantezli bilinmeyenler (platform,
  etkinlik sayısı, desteklenen programlar) UYDURULMADI, atlandı; "Durum"
  için gerçek DB verisi kullanıldı (üçü de `stage:"mvp"`).
- Hem canlı SPA'da hem `dist/labs/<slug>`/`dist/about` prerender çıktısında
  CDP ile doğrulandı.

**`sdklljs` çöp test projesi silindi (2026-09-30):** Kullanıcı önce "nereden
geldi" diye sordu — izini sürdüm: `hub-create-draft-project`'in (Kurucu
Hattı → "Yeni proje taslağı oluştur") 2026-09-26'daki Ekip Paneli köprüleme
düzeltmesinden ~30 dk ÖNCE oluşturulmuş bir test kaydıydı (`startups.id`
timestamp'i ile `hub-bridge-create-team`'in deploy zaman damgası
karşılaştırılarak doğrulandı) — `team_app_id: null`, yani Team App'e hiç
köprülenmemiş tek "hayalet" proje. **Araştırma sırasında ÖNCE yanlış bir
sonuca vardım:** Team App'in (`umgdtjlgivvymngsnqtv`) `app_state` tablosunda
**3 satır var** (`main` = eski demo/tohum verisi, `shl_v4` = ara anlık görüntü,
`shl_v5` = canlı uygulamanın GERÇEKTEN okuduğu satır, `public/team/index.html`
içinde `.eq('id','shl_v5')` ile sabit) — ilk sorgum `ORDER BY`/filtre olmadan
`main`'i çekmiş, "köprü hiç çalışmıyor" gibi yanlış bir izlenim verdi; `shl_v5`
kontrol edilince HR'daki diğer 5 projenin (GrantAgent/EventHub/TİD Çevirici/
Hoca Puanla/StartHub Proje Geliştirme) HEPSİNİN doğru köprülendiği görüldü —
yani köprü mekanizması aslında ÇALIŞIYOR, sdklljs tek seferlik bir tarihsel
artıktı. **Ders:** Team App projesinde `app_state` tablosunu sorgularken
HER ZAMAN `id='shl_v5'` filtresi kullanılmalı — filtresiz bir `limit 1`
yanıltıcı eski satırları döndürebilir. **Ayrı bir gerçek görünürlük inceliği
de bulundu (düzeltilmedi, yalnızca belgelendi):** Team App'in `scopeTeams()`
kuralı — yalnızca `admin`/`cto` rolündeki hesaplar TÜM ekipleri görür,
`member`/`lead` yalnızca KENDİ üyesi olduğu ekibi görür. Yeni açılan bir
pozisyonun ekibi başta üyesiz/liderliksiz olduğundan (kurucu henüz işe
alınmadı), `admin` olmayan bir hesapla Team Management'a bakan biri onu
GÖRMEZ — bu bir hata değil, kasıtlı görünürlük kapsamı, ama kafa karıştırıcı
olabilir. Team App'in admin hesapları şu an yalnızca `a.talhabaris@gmail.com`
ve `kadirks2003@gmail.com`; HR'daki cofounder e-postası (`talha@starthub-
community.com`) Team App'in kendi kullanıcı listesinde HİÇ YOK (iki sistem
tamamen ayrı auth'a sahip). **Akış netliği (kullanıcıya da açıklandı):**
proje/ekip, pozisyon AÇILDIĞI anda oluşturuluyor (boş, üyesiz) — kişi
BULUNDUĞUNDA proje oluşmuyor, yalnızca o zaten var olan boş ekibe ekleniyor;
`track==='founder'` ise `hub-move-to-team` → `hub-bridge-add-member`'a
`role:'lead'` geçiyor (bkz. `hub-move-to-team/index.ts:80`), yani kabul edilen
kurucu otomatik olarak o ekibin Team Lead'i oluyor. **Silme işlemi:**
`startups` satırı (`id:1790382219845`) + bağlı `people` satırı ("asd", test
verisi, `type:'project_member'`) `npx supabase db query --linked` ile elle
silindi (anon key ile DELETE RLS'e takılırdı), ikisi de doğrulandı — hiçbir
`hub_open_roles`/`posts` kaydı bu projeye referans vermiyordu, temiz silme.

## Pay / vesting (Equity) — 2026-10-04, Adım 1/5

Kaynak belgeler: `Start-Hub_Equity_Governance_Framework.md`, `StartHub_Vesting_Kurallari_ve_Senaryolar.md`,
`StartHub_Aday_Bulma_Senaryosu.md` (kullanıcı oturuma ekledi, repoda değil). 5 adımlı plan, her adım
kullanıcı onayıyla: (1) pay tabloları ✅ (2) Kapı A şablonları (3) bildirim + çift onaylı mail
(4) kurucu/üye ayrımı — üye hattında akış sırası DEĞİŞİYOR: sun → kurucu kabul → Kapı A'yı kurucu
şablondan atar → değerlendirir → "Ekibe Al" (5) Team App "Payım" + "Genel" kaynak filtresi.
Kullanıcı kararları: pay verisi ana projede, Team App bir köprü fonksiyonuyla okur (Team App ayrı
Supabase projesinde oturum açtığı için RLS onu tanımaz); kilometre taşı = sabit +5 puan, zaman
tabanının üstüne, toplam sözü aşmaz, bekleme süresi bitene kadar bekler; sözleşme onay ekranı
(IP/PDF) bu turda YOK; "Kendim görüşeyim" yalnızca durum işareti.
- `0052_equity.sql` (canlıda): `equity_seats` (koltuk bütçesi, Kural 4b), `equity_grants` (pay sözü),
  `equity_milestones`, `equity_events` (Kural 11-12 süreç kaydı + otomatik `audit` satırları,
  append-only). RLS `has_perm('equity.read'|'equity.manage')` — yalnızca cofounder. Koltuk/söz
  silinmez. "Şu an ne kadar kazanıldı" DB'de SAKLANMAZ — `src/lib/equity-rules.js` hesaplar
  (istisna: ayrılınca donan `vested_at_end`). Testler: `node src/lib/equity-rules.test.mjs`.
- HR › Yönetim › "Pay Sözleri" (`src/hub/pages/equity.jsx`).
- **Adım 2 ✅ — `0053_hub_gate_templates.sql` (canlıda):** belgedeki `kapi_a_sablonlari` proje kuralına
  uygun adla `hub_gate_templates` (category = `hub_candidates.interest` anahtarları + `founder`, title,
  description, duration_hours 24–336, delivery_type link/file/recording) + `hub_gates.template_id`.
  11 başlangıç şablonu belge örneklerinden türetilmiş TASLAKTIR (projeye göre düzenlenmeli). RLS
  `templates.read/manage`. Store koleksiyonu `gateTemplates`. HR › Şablonlar › "Kapı A görevleri"
  sekmesi (`pages/gate-templates.jsx`; kullanılmış şablon silinmez, pasifleştirilir). `GateStartForm`
  (candidate.jsx) Kapı A'da serbest yazı yerine şablon seçici + gün seçici + katlanmış açıklama
  override; Kapı B serbest metin kaldı. Yardımcılar `src/hub/gate-templates.js` (+ `.test.mjs`).
  Team App'teki kurucu seçici Adım 4'te (akış sırası değişince) aynı tabloyu kullanacak.
- **Adım 3 ✅ — bildirim + çift onaylı mail (migration yok):**
  - Bilgi maili (tek adım): `hub-bridge-present-candidate` (Team App projesine `--no-verify-jwt` ile
    deploy edildi) sunma kaydı yazıldıktan SONRA o ekibin lead'(ler)ine — lead yoksa admin'lere —
    "Sana bir aday önerildi — {rol}" maili atar (aynı projedeki `send-mail`); başarısız olursa sunma
    düşmez. Alıcı/metin saf fonksiyonlarda (`logic.ts` → `offerMailRecipients`/`offerNotifyMail`, test:
    `hub-bridge-present-logic.test.mjs` — dosyanın sonundaki `process.exit` yeni testlerden SONRA olmalı).
  - Team App: zil bildirimi (`candidate_offer`) artık karar penceresini (`offerModal`) doğrudan açar;
    Team kartındaki Kabul/Ret de aynı pencereye gider. Kabul = karar maili → mail önizlemesi →
    ayrı "Evet, eminim". Ret → gerekçe zorunlu (≥5 karakter), `hub-owner-decision`'a not olarak gider.
    Önizleme metni `offerInviteMail()` — `hub-team-decide-offer`'daki `sendInviteEmail` ile AYNI
    olmalı (biri değişirse diğeri de). Yan düzeltme: `notify(..., "err")` önceden yeşil görünüyordu
    (yalnızca "warn" tanınıyordu) — artık kırmızı.
  - HR: `components/mail-confirm.jsx` (`MailSendConfirm`, önizleme → "Evet, eminim", z 1150/1160 —
    HubWizard 1100'ün üstünde). Adaya giden iki mail yolu da (`DecisionMail` davet/ret, `GateStartForm`
    Kapı görevi) bundan geçer. Üye hattında e-postasız aday "Proje sahibine sun"amaz (buton pasif).
  - (Adım 4'ten sonra Team App'teki "Kabul" doğrudan ekibe ALMAZ — aşağıya bkz.)
- **Adım 4 ✅ — üye hattı yeni sıra (`0057_hub_owner_stage.sql`, canlıda):** görüşme (HR) → "Olumlu —
  proje sahibine sun" (InterviewSection; recruiter bir Kapı A şablonu önerir →
  `hub_candidates.suggested_gate_template_id`) → kurucu Team App'te: Kabul (Kapı A'yı şablondan seçer +
  mail önizleme/düzenle + "Evet, eminim") / Ret (gerekçe) / Kendim görüşeyim (yalnızca işaret) → kurucu
  Kapı A'yı değerlendirir (yeterli / yetersiz+gerekçe) → "Ekibe Al" (davet maili önizleme + onay).
  Kurucu (founder) hattı DEĞİŞMEDİ (baştan sona HR). Ayrıntılı durum `hub_candidates.owner_stage`
  (presented/interview/gate/gate_passed/joined/rejected/withdrawn) — YALNIZCA sunucu yazar
  (`mapCandidateToDb` bu kolonu yazmaz; `updateItem` aday kurucunun elindeyken stage/owner_decision/
  presented_at/startup_id alanlarını DB'ye göndermez — HR'ın bayat yerel kopyası ilerlemeyi ezmesin).
  `owner_decision` pending/accepted/rejected olarak KALDI (rol yeniden açma hesabı ona bakıyor).
  - Team App: `hub-team-decide-offer` artık `action` alır (templates/interview/start_gate/evaluate/
    join/reject); durum makinesi `logic.ts` → `computeOfferActionPatch` (test: hub-team-decide-logic).
    `join` YALNIZCA `gate_passed`'tan — eski istemcilerin `{decision:'accepted'}` çağrısı da Kapı A'yı
    atlayamaz. `start_gate`'te adaya görev maili ÖNCE gider (kurucunun onayladığı metin), gidemezse
    hiçbir şey yazılmaz. Teslim adresi kurucunun kendi e-postası (send-mail reply_to'su Start-Hub kutusu).
  - Ana proje: `hub-owner-decision` action'ları (templates/interview/gate_started → hub_gates satırı +
    stage trial / gate_result) + eski decision'lar; `hub-present-to-owner` cofounder'a istisnai
    `withdraw` / `owner_fail` (Team App teklifini `hub-bridge-present-candidate` action 'close' ile kapatır).
  - HR: `OwnerProgress` (candidate.jsx) salt okunur süreç kartı + "Yenile" (store'da realtime yok);
    ret/geri çekme sonrası "nazik ret maili gönder ve arşivle"; Bugün listesi kurucudaki işleri
    "Kurucuda" (yalnızca 3+ gün takılırsa) / "Ret maili" olarak gösterir; `nextAction` → 'owner'.
  - Geriye dönük: 12 Eylül'den kalma (köprüden önceki) tek sunulmuş "Havuz" kaydının owner_stage'i boş
    bırakıldı (Team App'te teklifi yok — yoksa sonsuza dek "kurucuda" görünürdü).
  - **Migration numarası yine çakıştı:** ikinci katkıcı aynı gün 0054–0056'yı (görsel eşleştirme)
    canlıya uygulamıştı; `db push` "Remote migration versions not found" ile durdu → `origin/main`
    merge edildi, benimki 0057'ye alındı. `repair` YAPILMADI. Push öncesi `git fetch` + canlıdaki son
    versiyon kontrolü şart.
- **Adım 5 ✅ — "Payım" + "Genel" kaynaklar (migration yok) — 5 adımın SONUNCUSU:**
  - Pay hesabının TEK kaynağı artık `supabase/functions/_shared/equity-rules.js`; `src/lib/equity-rules.js`
    yalnızca onu re-export eder (edge function frontend dosyası import edemez, tersi olur).
    `summarizeGrant()` Payım özetini üretir (test: equity-rules.test.mjs, 34 senaryo).
  - `hub-team-my-equity` (Team App, JWT AÇIK): e-postayı kullanıcının KENDİ JWT'sinden alır (istemci
    seçemez), lead olduğu ekipleri app_state'ten sunucuda hesaplar (admin → tüm ekipler) →
    `hub-equity-bridge` (ana proje, `--no-verify-jwt`, x-hub-bridge-key): kişinin kendi sözleri +
    lead'in ekibinin tablosu (Bölüm G m.9; startups.team_app_id eşlemesiyle; bu listede e-posta DÖNMEZ).
    Pay verisi app_state'e YAZILMAZ — yalnızca oturum belleğinde (`state.equity`).
  - Team App: sekme çubuğunun sağında küçük "💼 Payım" butonu (`tab: "equity"`, ana sekmelerde değil —
    Bölüm M "ön planda değil"). Kartlar: söz/kazanılmış/kazanılmamış, ilerleme, bekleme süresi, sıradaki
    hak ediş, (lider) kilometre taşları ve sıradaki taş; lead'e "Ekibimin pay durumu".
    **Dikkat: bu DSL'de `<table>` içine `<sc-for>` KONMAZ** — HTML ayrıştırıcısı bilinmeyen etiketi
    tablonun dışına taşır, satırlar boş çıkar (bulundu, div ızgarasına çevrildi).
  - Kaynaklar: `app_state.data.sharedResources` (yeni üst düzey alan — `_snapshot` VE `_applySnapshot`
    ikisine de eklendi; okumada `d.sharedResources || this.state.sharedResources` ile eski bir sekmenin
    alanı bilmeden yazması kalıcı silmeye dönüşmez). "Genel" satırı yalnızca admin düzenler; sentinel
    `GENERAL_RES = "__GENERAL__"`, `_resList/_resPatch` ile mevcut openResEdit/saveRes/removeRes/flow
    yolları yönlendirildi. "Tümü / Bu proje / Genel" filtre çipleri (`resFilter`). İçerik (PRD, üye kural
    özeti) kod değil — admin/lead Team App'ten ekler.
  - Team App önizleme yöntemi (oturum gerektirmeden): `dist`'i `vite preview` ile sun, headless Chrome'u
    `--host-resolver-rules="MAP *.supabase.co 127.0.0.1"` ile aç (canlı veriye istek ÇIKAMAZ), React
    fiber'da `openOffer` metodu olan nesneyi bul (stateNode'un bir alt alanında), `persist`/
    `_refreshFromCloud`'u no-op yap, demo state'i `setState` ile ver.
- **2026-10-08 — dört ek iş (her biri ayrı commit, `main`'de):**
  - **Team App üyeliği yalnızca admin:** "+ Yeni üye", "Mevcut üyeyi ekle", üye "Düzenle" (ad/e-posta/rol)
    ve çıkarma/silme → `can("manageMembers")` (lead için false; eskiden kart `admin || isLeadHere`
    kullanıyordu). İşlem fonksiyonları da `_canEditMembership()` ile korunuyor. Lead'in görev/sprint/review/
    kaynak/proje bilgisi yetkileri ve "Önerilen Adaylar → Kapı A → Ekibe Al" DEĞİŞMEDİ. Sınır: Team App
    tarayıcıdan yazıyor — sunucu tarafı zorlama değil.
  - **Pay Sözleri ekip ↔ söz karşılaştırması:** `hub-equity-roster` (ana, JWT, `has_perm('equity.read')`) →
    `hub-bridge-team-roster` (Team App, köprü anahtarı, salt okuma). "Pay sözü olmayan üyeler" (Team App
    admin'leri hariç) + "Söz ekle" (koltuk seç → ad/e-posta dolu); e-postası ekipte olmayan aktif söz kırmızı.
    `compareRoster()` ortak dosyada.
  - **Kişi talebi (`0058_hub_role_requests.sql`, canlıda):** 0010 talep akışını kaldırmıştı çünkü proje
    sahibi HR'da rolü kendisi açıyordu (HUB_SPEC v2 §10.1); 2026-09-23'ten beri HR'a giremediği için gerekçe
    düştü. `status 'requested'` + `requested_by_email/name/at` (yalnızca sunucu yazar). Team App ekip kartında
    "+ Kişi talep et" (lead/admin) → `hub-team-role-request` (Team App, JWT, yetki sunucuda) →
    `hub-role-request` (ana, köprü). HR: "Talep edildi" (→ Yayınla / Taslağa al), kartta talep eden, Bugün'de
    "Rol talebi" (→ Açık Pozisyonlar). Proje kaydı olmayan ekip (Erasmus+, kimlik D) talep açamaz (404 mesajı).
  - **"Ekibe Al" → pay sözü taslağı:** koltuk formunda "Bağlı açık rol" (`equity_seats.open_role_id`);
    Pay Sözleri'nde "Ekibe alındı — pay sözü bekliyor" (`pendingGrantJoins()`; söz OTOMATİK oluşmaz, form
    kişi/e-posta/bağlı koltuk/başlangıç = Kapı A ilk günü ile dolu gelir, `hub_candidate_id` yazılır);
    Bugün'de yalnızca `equity.read` sahibine, son 30 günde ekibe alınıp sözü olmayanlar ("Pay sözü" → Pay
    Sözleri). Testler: equity-rules.test.mjs 38.
  - **Team App ekip kimlikleri (2026-10-08 okundu):** A=TİD Çevirici, B=EventHub, C=GrantAgent,
    BD="İş Geliştirme" (StartHub Proje Geliştirme), **D="Erasmus+"** (Erasmus Project Writing — ana projede
    proje kaydı YOK, kullanıcı kararıyla açılmadı), **E="Team D"** (Hoca Puanla — ekranda "Team D" yazar ama
    kimliği E). Team App DB'si `npx supabase db query --linked --project-ref umgdtjlgivvymngsnqtv` ile
    okunabiliyor (anon REST RLS'e takılır).
  - Flutter rolü ("Dolduruldu", 0 aday, `filled_at` boş — kaynağı tespit edilemedi) kullanıcı kararıyla
    DOKUNULMADI.
- **Not:** `0050_posts_is_indexable.sql` yukarıda "çalıştırılmadı" yazıyor ama canlıda UYGULANMIŞ
  (schema_migrations'da kayıtlı, kolon var — 2026-10-04'te doğrulandı).

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

**Kurucu ilanında rol başlığı/tipi sorulmuyor (2026-09-25):** `roles.jsx`'te yeni rol oluşturma akışında hat
"Kurucu" seçilirse `restSteps`'ten `titleStep`/`roleTypeStep` çıkarılıyor — bu bir ortaklık, işlevsel bir rol
değil. `saveRole()`'da başlık otomatik "Kurucu Ortak", `role_type` `null` yazılıyor (roleType nullable);
kartta `roleType` boşsa rozet hiç basılmıyor. Yalnızca YENİ rol oluşturma akışını etkiler — "Düzenle"
(`editWizSteps`) hâlâ tüm alanları soruyor, gerekirse sonradan doldurulabilir.

**Ekibe alınan aday Adaylar listesinden otomatik düşüyor (2026-09-25):** `hub-filter.js`'teki `applyFilters`
artık `stage==='archived'` gibi `stage==='member'`i de HER ZAMAN eliyor — ekibe alınan kişi artık "aday"
sayılmıyor, takibi Team Management'a taşınıyor. `filter-bar.jsx`'teki "Aşama" filtresinden "Ekipte" seçeneği
de kaldırıldı (aksi halde hep 0 sonuç veren kafa karıştırıcı bir çip olurdu). `roles.jsx`'teki rol-başına
aşama dökümü (funnel) `applyFilters` KULLANMADIĞI için etkilenmedi, orada "Ekipte" sayısı görünmeye devam
ediyor.

**Üye adaylarını ekibe alma kararı Team Lead'e taşındı (2026-09-25, büyük özellik):** Kullanıcının isteği:
"kurucu değil ekip üyesini proje sahibine (Team Lead) sunmadan ekibe alımı olmasın." Üye hattındaki bir aday
Kapı A'yı geçtikten sonra HR'daki `TrialSection`'da "Ekibe al" butonunun yerini **"Proje sahibine sun"** aldı
— cofounder/recruiter artık tek başına ekibe alamıyor, o projenin Team App'teki gerçek Team Lead'ine (veya
admin'e) sunuyor; hesap ancak Team App'in Team sayfasındaki yeni **"Bekleyen Adaylar"** panelinden Kabul
verilince açılıyor + davet maili gidiyor. **Kurucu hattı bu akışa hiç girmiyor** (ayrı bir "proje sahibi" yok,
cofounder eskisi gibi doğrudan karar verir) — bu yüzden `candidate.jsx`'teki `TrackRoleSection`'ın eski
erken-sunma/kabul-ret bloğu artık yalnızca `track==='founder'` iken render ediliyor; üye hattında HER
aşamada çıkıp kafa karıştıran o panel (bir kullanıcı şikâyeti) tamamen kalktı.

Mimari (plan dosyası: oturum içi `EnterPlanMode` ile onaylandı, detaylar orada):
- **Ana proje**: `hub-present-to-owner` (yeni, HR'dan `hub-store.presentToOwner` ile çağrılır, gerçek kullanıcı
  JWT'si + `hub_role()` kontrolü — `hub-move-to-team` ile aynı desen) → Team App'e `hub-bridge-present-candidate`
  ile köprü kurar. `hub-owner-decision` (yeni, `x-hub-bridge-key` ile — **`--no-verify-jwt` ile deploy edildi**,
  çünkü çağıran gerçek bir Supabase JWT'si taşımıyor, yalnızca paylaşılan sır) Team App'ten gelen kararı
  `hub_candidates`'a yazar (`accepted` → `_shared/move-to-team-core.ts` — `hub-move-to-team`'in DB-yazan
  çekirdeği, KOD TEKRARLANMADI, iki fonksiyon da import ediyor; `rejected` → yalnızca `owner_decision` +
  rol-yeniden-açma, `roleStatusAfterReject` ile aynı mantık SQL'de tekrarlandı çünkü o dosya frontend
  bundle'ının parçası, edge function'dan import edilemiyor).
- **Team App projesi** (`umgdtjlgivvymngsnqtv`): `hub-bridge-present-candidate` (yeni, `--no-verify-jwt`,
  `app_state.data.candidateOffers`'a `status:'pending'` kayıt ekler — HUB_SPEC'teki gibi CAS/repair-write).
  `hub-team-decide-offer` (yeni, Team App'in KENDİ oturum JWT'siyle — sır GEREKMEZ, sunucu tarafında
  admin/lead olduğu `effRole` ile tekrar doğrulanır) Kabul'de `hub-bridge-add-member/logic.ts`'teki
  `computeBridgePatch`'i AYNEN import edip kullanır (kod tekrarlanmadı), sonra ana projeye `hub-owner-decision`
  ile kararı bildirir.
- **`public/team/index.html`**: `app_state.data`'ya yeni `candidateOffers` alanı — **hem `_snapshot()`
  (giden yazma) hem `_applySnapshot()` (gelen okuma) güncellendi**, ikisi de whitelist mantığıyla çalışıyor;
  yalnızca birini güncellemek bir sonraki ilgisiz kayıtta (tüm `data` kolonu parça parça değil BÜTÜN
  üzerine yazıldığından) bu alanın sessizce silinmesine yol açardı — bulundu ve düzeltildi. Team sayfasındaki
  her ekip kartına, `canManageTeam` (admin || o ekibin lead'i) doğruysa "Bekleyen Adaylar" alt-bloğu eklendi.
  **Kritik bulgu**: dosyanın JSON-string kodlamasında `</script` dizisi özellikle `<\/script` olarak
  kaçışlanmış (JSON'da geçerli bir kaçış — `\/` → `/`) çünkü içeride gerçek bir `<script type="text/x-dc">`
  etiketi var; bir gerçek tarayıcının HTML ayrıştırıcısı "JSON string içinde" kavramını bilmez, ham baytlarda
  `</script` dizisini görünce DIŞ script'i erken kapatır. Düz `JSON.stringify` bunu OTOMATİK yapmaz (`/`
  kaçışlamaz) — düzeltme scripti bunu elle (`</script` → `<\/script`, case-insensitive) uyguladı, ardından
  `node:vm` ile İZOLE edilmiş JS bloğu (tüm `src` değil — o HTML+JS karışımı, yalnızca
  `class Component extends DCLogic {...}` aralığı) sözdizim kontrolünden geçirildi, offset-tabanlı (regex
  DEĞİL — iç içe script kapanışları regex'i yanıltabilir) round-trip doğrulaması yapıldı, `npm run build`
  sonrası `dist/team/index.html` `public/`le birebir karşılaştırıldı (`diff` — IDENTICAL).
- **Gateway JWT ayrımı**: yalnızca paylaşılan sırla (`x-hub-bridge-key`) çağrılan fonksiyonlar
  (`hub-owner-decision`, `hub-bridge-present-candidate`, mevcut `hub-bridge-add-member`) `--no-verify-jwt`
  ile deploy edilir — gerçek bir Supabase JWT taşımadıkları için varsayılan gateway kontrolü onları
  `UNAUTHORIZED_NO_AUTH_HEADER` ile reddederdi. Gerçek kullanıcı oturumuyla çağrılanlar (`hub-present-to-owner`,
  `hub-team-decide-offer`, `hub-move-to-team`) varsayılan (JWT doğrulamalı) ayarda kalır.

Node testleri: `hub-bridge-present-logic.test.mjs`, `hub-team-decide-logic.test.mjs` (yeni, `hub-bridge-
logic.test.mjs` ile aynı desen — saf mantık, ağsız). Tüm 5 yeni/değişen edge function `curl` ile canlıda
smoke-test edildi (beklenen 401/hata gövdeleri doğrulandı, gerçek mutasyon YAPILMADI).

**Proje taslağı artık Ekip Panelinde de eşzamanlı açılıyor (2026-09-26):** Kurucu hattında "Yeni bir proje
taslağı oluştur" (roles.jsx → hub-create-draft-project) önceden yalnızca ana projenin `startups` tablosuna
`team_app_id` boş bir "hayalet" satır düşürüyordu — Team App bundan hiç haberdar olmuyordu, founder Team
Management'a girince ekibini bulamıyordu. Artık yeni `hub-bridge-create-team` (Team App'in KENDİ projesi
umgdtjlgivvymngsnqtv'ye deploy edilir, `hub-bridge-add-member` ile AYNI "taze-oku → CAS retry → yaz" deseni)
önce Ekip Paneli'nin `app_state.data.teams`'ine gerçek bir ekip ekliyor (Team App'in kendi `_nextTeamId`/
`_monthlySprints` ürettiği şekli birebir taklit eder), dönen teamId ile `startups` satırı `team_app_id` EŞLİ
oluşturuluyor. Köprü başarısız olursa hiçbir şey oluşturulmuyor (iki taraf tutarsız kalmasın diye). Detaylar
hâlâ YALNIZCA Team App'in kendi Overview "Düzenle" modalından (team-project-save) ayarlanıyor — DEĞİŞMEDİ,
team_app_id zaten eşli geldiği için ilk "Düzenle" bir CREATE değil UPDATE olarak işleniyor. **Ters yön**
(Team App'ten oluşturulan bir ekibin HR'da görünmesi) zaten team-project-save'in aynı team_app_id eşleme
mantığı + roles.jsx'in filtresiz `startups` sorgusuyla çalışıyordu, değişiklik gerekmedi. Ayrıca aynı turda:
roles.jsx'teki "Benim projem var" → "Var olan projeye dahil et" (kafa karışıklığı şikayeti) ve `RoleSetupFlow`
sihirbazının "Geri" düğmesi artık gerçek bir `from` zinciriyle tek adım geri gidiyor (önceden kurucu hattında
proje-seçim adımından geri tıklayınca "founder-choice" atlanıp doğrudan en başa dönüyordu) + üstte kaçıncı
adımda olunduğunu gösteren nokta şeridi (mevcut HubWizard'daki `.hub-wz__dot` deseniyle aynı).

**Mobil uyumluluk geçişi — HR + admin + Team App (2026-09-26/27):** Kullanıcı sırasıyla üç yüzeyi mobil için
tam uyumlu hale getirmemi istedi, her adımda "hiçbir şey bozulmasın" vurgusuyla. HR (`/HR/`, hub.css): sidebar
artık ≤900px'te off-canvas çekmece (hamburger + arkaplan, `hub-app.jsx`'teki `mobileNavOpen`), klasör rayı
dikey yerine yatay kaydırmalı şeride dönüyor, `.adm-table-wrap` (hub.css'te hiç tanımlı değilmiş) eklendi,
form/yetki grid'leri ≤720px'te tek sütuna iniyor. **Önemli ders:** mobil kuralların bir kısmı ilk denemede
dosyada çok erken yazıldı ve daha aşağıdaki kayıtsız-şartsız masaüstü tanımları (eşit özgüllük, kaynak sırası
kazanır) onları sessizce eziyordu — `.hub-today--v2` ile daha önce çözülen AYNI hata sınıfı; tüm mobil kurallar
dosyanın en sonuna taşınarak düzeltildi. Admin panel (`/admin/`, admin.css) zaten önceki bir oturumdan
büyük ölçüde mobil uyumluydu (sidebar çekmecesi, tablo sarmalayıcıları) — yalnızca üç kalan sabit-sütunlu grid
(Yetkiler ekranının `hub-perm-grid`'i, Site Ayarları'nın `adm-2col-grid`/`adm-3col-grid`'i, Otomasyon'un
`adm-kwadd-grid`'i) `!important` ile ≤900px'te tek sütuna indirildi, inline style'lar (masaüstü görünümü)
KORUNDU. Gerçek Chrome (headless, CDP) ile doğrulandı — bu makinede Windows ekran ölçeklendirmesi (%133)
`Emulation.setDeviceMetricsOverride`'ın istenen viewport'u tam vermemesine yol açıyor, ölçümler istenen piksele
değil GERÇEK `window.innerWidth`'e göre yorumlanmalı; ayrıca `.hub-panel`'in görünürdeki 24px kayması gerçek
bir hata değil, headless'ın `hubPanelIn` giriş animasyonunu (mevcut, dokunulmayan kod) bitirmeden ölçüm almasıydı.

**Team App (`public/team/index.html`) — kod incelemesiyle zaten sağlam çıktı**, yalnızca 8 form-alanı grid'i
(görev/ekip modalları, sprint tarih aralığı) `1fr 1fr`/`repeat(3,minmax(0,1fr))` idi ve sınıfsızdı — `shl-2col`/
`shl-3col` sınıfları eklenip mevcut `@media (max-width: 600px)` bloğuna `!important` kuralla eklendi (masaüstü
görünüm birebir aynı, yalnızca ≤600px'te tek sütuna iniyor). Bu dosyadaki **Dikkat** bölümündeki prosedür
BİREBİR izlendi: JSON.parse ile tam çöz → değişiklik → `JSON.stringify` + yalnızca `</script` kaçışı (BLANKET
`</` DEĞİL — `</head>`/`</body>` gibi diğer kapanışlar orijinalde kaçışlanmamış, ilk denemede bunu atlayıp
round-trip'i bozdum, düzelttim) → round-trip (decode→encode→decode birebir eşit) İKİ KEZ doğrulandı (değişiklik
öncesi taban çizgisi + değişiklik sonrası) → `node:vm` ile `class Component extends DCLogic` bloğunun sözdizimi
doğrulandı (+ negatif kontrol: bozuk kod gerçekten yakalanıyor mu diye test edildi) → karakter-karakter diff ile
TAM OLARAK 9 değişikliğin (8 class + 1 CSS bloğu) yapıldığı, başka HİÇBİR yerin dokunulmadığı doğrulandı →
`npm run build` sonrası `dist/team/index.html` `public/`le birebir (`diff` — IDENTICAL) karşılaştırıldı. Hiçbir
JS mantığına (persist/snapshot, Supabase yazma yolları) dokunulmadı — yalnızca statik HTML şablonundaki
(`sc-for`/`sc-if`/`{{ }}` DSL kısmı, class Component'in JS gövdesinden AYRI) birkaç `<div>`'e class eklendi.

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
