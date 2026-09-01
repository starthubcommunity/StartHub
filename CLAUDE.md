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

Yapım şartnamesi: **`HUB_SPEC.md`** — artık **v2** (sadeleştirilmiş: 3 ekran,
aşamaya göre 6–8 alan, 7 tablo). Bağlayıcıdır. v1 arşivi: `HUB_SPEC_v1_archive.md`.
Şartnamedeki bir karar belirsizse veya yanlış görünüyorsa **kod yazmadan önce sor**;
sessizce kendi tasarımını uygulama.

Görev sırası **`PROMPT_S.md`**'de, 12 adım halinde. Kabul testleri:
**`HUB_TEST.md`** (aşama başına bir uçtan uca test) + `node
src/hub/hub-rules.test.mjs` (66 senaryo).

**v2 hub sayfaları:** `today.jsx` · `candidates-list.jsx` · `candidate.jsx`
(+`GateCard`) · `roles.jsx` · `templates.jsx` · `metrics.jsx` · `settings.jsx`.
Yeni destek dosyaları: `new-candidate.jsx`, `import-simple.jsx` (CSV; .xlsx için
SheetJS eklenecek), `hub-ai-draft.js` + `supabase/functions/hub-ai-draft/`.

**v2 dışı, bağlantısı kesik (silinmez, `hub-app.jsx`'ten import edilmez):**
`src/hub/hub-parse.js`, `hub-github.js`, `hub-enrich.js`, `hub-match.js`,
`src/hub/pages/{sources,board,table,import}.jsx`,
`src/hub/components/{saved-views,unknowable}.jsx`. Hacim gelince geri gelir.

**Düşen tablolar (0010):** `hub_views`, `hub_import_batches`. **Ölü ama duruyor:**
`hub_role_log`, `hub_interviews` (0009 RLS'i bunlara bağlı). `0004_hub_cron.sql`
→ `supabase/migrations/_deferred/` (deploy edilmez).

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

`public/team/index.html` tüm durumunu `app_state` tablosunda tek bir JSON bloğunda
tutuyor. Buraya derin bağlanma yapılmaz; hub, team sistemine yalnızca referansla
(`startup_id`, `person_id`) bağlanır.
