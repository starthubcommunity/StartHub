# Start-Hub

Vite 6 + React 18 + Supabase (auth + Postgres), Vercel'de barındırılıyor.

## Giriş noktaları

| Yol | HTML | Entry |
|-----|------|-------|
| `/` | `index.html` | `src/main.jsx` → `src/app.jsx` |
| `/admin/` | `admin/index.html` | `src/admin/main.jsx` → `src/admin/admin-app.jsx` |
| `/team/` | `public/team/index.html` | Önceden paketlenmiş tek dosya — Vite build'ine dahil değil |
| `/hub/` | `hub/index.html` | `src/hub/main.jsx` → `src/hub/hub-app.jsx` *(yapım aşamasında)* |

## Kurucu Hattı (`/hub`)

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
`settings.jsx`. Destek dosyaları: `new-candidate.jsx`, `import-simple.jsx` (CSV),
`paste-import.jsx` (yapıştır-ayrıştır — v3 ana yöntem), `triage.jsx` (hızlı eleme),
`hub-ai-draft.js` + `supabase/functions/hub-ai-draft/`.

**v3'te geri bağlanan (v2'de bağlantısı kesikti):** `src/hub/hub-parse.js` (§6.2),
`src/hub/pages/sources.jsx` + `hub_source_registry` (§11), `hub-github.js` +
`hub-enrich.js` (§12.5, opsiyonel), `hub-match.js` (§12.4, havuz 100+ olunca).

**Hâlâ bağlantısı kesik:** `src/hub/pages/{board,table,import}.jsx`,
`src/hub/components/{saved-views,unknowable}.jsx`.

**Düşen tablolar (0010):** `hub_views`, `hub_import_batches`. **Ölü ama duruyor:**
`hub_role_log`, `hub_interviews` (0009 RLS'i bunlara bağlı). Cron artık
`0015_hub_cron.sql` (eski `_deferred/0004_hub_cron.sql` silindi) — Vault'ta
`project_url` + `service_role_key` secret'ları ister. v3 migration'ları `0013`'ten
devam eder; `drop column` yapılmaz (kolon UI'dan gizlenir). Edge function'lar:
`send-mail`, `invite-member`, `hub-ai-draft`, `hub-daily`, `hub-weekly`,
`hub-move-to-team` (C4 — servis rolü, `people`/`startups`/auth köprüsü).

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

`public/team/index.html` **bir build artefaktıdır** (bundler çıktısı, ~700 KB,
asset'ler base64 gömülü) — **kaynağı bu repoda yoktur, doğrudan düzenlenmez.**
Değişiklik gerekiyorsa o bundle'ı üreten kaynakta yapılır (bkz. HUB_SPEC §12.7).
Team roster/üyelik modeli: `people` (`type='project_member'`, `project_id` →
`startups.id`) + `startups.member_ids` (text[]). `app_state` (id `text`, data
`jsonb`) şu an boş; buna derin bağlanma yapılmaz. Hub, team sistemine yalnızca
referansla (`startup_id`, `person_id`) bağlanır. **Blok E'deki Team→Hub geri
beslemesi (E6) de bu repo-dışı kaynağa bağımlıdır.**
