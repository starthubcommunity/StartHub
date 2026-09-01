# Start-Hub — Kurucu Hattı (`/hub`) Yapım Şartnamesi

> Bu dosya Claude Code'a doğrudan verilir. Ürün kararları Bölüm 1–3'te, teknik uygulama Bölüm 4–10'da, adım adım görev sırası Bölüm 11'dedir.
> **Kural:** Bu şartnamedeki hiçbir karar tek başına değiştirilmez. Değişiklik gerekirse önce burada güncellenir, sonra kod yazılır.

---

## 0. Bir cümlede

Start-Hub'ın projelerine **kurucu ortak ve ekip üyesi** bulmak için kurulan, aday havuzunu tarayan / filtreleyen / puanlayan / süreç boyunca takip eden ayrı bir iç uygulama. Mevcut siteye `/hub` uzantısı olarak eklenir, ilk aşamada yalnızca iki kişi kullanır.

**Başarı ölçüsü:** 3 ay içinde 3 projeye, 90 gün sonra hâlâ aktif olan birer proje sahibi bulmak.

---

## 1. Neden ayrı uygulama

Admin paneline modül olarak eklenmiyor, çünkü:

- Hub git gide gelişecek bir sistem; admin paneli içerik yönetimi için sabit kalmalı.
- Hub'ın erişim kümesi farklı (2 kişi → sonra 4), admin'inki farklı.
- Hub'ın kendi sürümü, kendi yol haritası ve kendi veri modeli olacak.

Ama **aynı Supabase projesini, aynı auth'u ve aynı tasarım token'larını** kullanır. Ayrı uygulama demek ayrı altyapı demek değil.

---

## 2. Ürün kararları (tartışılıp kapatılmış — yeniden açılmaz)

### 2.1 Tek hat, iki kaynak
Inbound (site başvurusu) ve outbound (bizim bulduğumuz) aday **aynı boru hattından** geçer, **aynı rubrikle** puanlanır. Tek fark `source` alanı. İki ayrı huni = iki ayrı standart = karşılaştırılamaz veri.

### 2.2 Sekiz aşama, her birinin tek çıkış koşulu

| # | Aşama | Çıkış koşulu |
|---|-------|--------------|
| 0 | `pool` — Havuz | Kaynak ve en az bir kanıt linki girilmiş |
| 1 | `contacted` — Temas | İlk mesaj gönderildi, `hub_touches` kaydı var |
| 2 | `replied` — Cevap | Aday döndü (olumsuzsa sebeple arşive) |
| 3 | `interviewed` — Görüşme | Rubrik dolduruldu (bu aşamadan **çıkmak** için) |
| 4 | `finalist` — Finalist | Proje seçtirildi + şartlar/hisse konuşuldu |
| 5 | `gate_a` — Kapı A | 72 saatlik ilk görev başlatıldı |
| 6 | `gate_b` — Kapı B | 10 günlük ilk sprint başlatıldı |
| 7 | `joined` — Ekipte | Sözleşme imzalandı, hak ediş başladı |

Ayrıca `archived` — aşama değil, her aşamadan çıkış. **Sebep zorunlu:**
`no_reply` / `not_interested` / `no_time` / `below_bar` / `we_passed`

⚠️ **Tablodaki koşullar ÇIKIŞ koşullarıdır, giriş değil.** Sıralı hatta bir
aşamanın çıkış koşulu, bir sonrakinin giriş koşuludur.

Özellikle rubrik: `replied → interviewed` geçişi **serbesttir** — o geçiş
"bu kişiyle konuştum" demektir, konuşma yeni bittiği için rubrik henüz yoktur.
Rubrik **görüşme aşamasındayken** doldurulur ve `interviewed → finalist`
geçişinde aranır. Rubriği `interviewed`'a *girmek* için şart koşmak, kullanıcıyı
"önce puanla, sonra görüştüm de" gibi ters bir sıraya zorlar.

Bu bir gevşeme değildir: `finalist` zaten `thresholdMet` istiyor, o da puanlar
girilmeden sağlanmaz. Kapı kapalı kalır, yalnızca doğru yere taşınır.

### 2.3 Puanlama
Üç eksen, her biri 1–5: **bitirmişlik**, **iletişim**, **kapasite**.

**Finalist eşiği:** `toplam ≥ 10` **VE** `hiçbir eksen ≤ 2`.
İkinci şart zorunludur — 5-5-1 alan biri toplamda geçer ama altıncı haftada kaybolur.

AI ön puanı ayrı alanda (`ai_score`) durur, insan puanının üstüne **asla yazmaz**, arayüzde `öneri` etiketiyle gösterilir.

### 2.4 Kırmızı bayraklar
Sabit liste, açılıp kapanan kutucuklar, her birinin altında serbest not:

`blame` (sorumluluk atma) · `no_i` (hep "biz", katkı belirsiz) · `no_capacity` (neyi bırakacağını söyleyemiyor) · `no_terms` (hisse/şart sormadı) · `only_experience` (sadece deneyim beklentisi) · `never_finished` (hiçbir işi bitmemiş)

**Kural:** 2 veya daha fazla bayrak işaretliyken kart `finalist` aşamasına **geçemez**. Yalnızca `cofounder` rolü, gerekçe yazarak geçirebilir (`override_reason` alanına yazılır).

### 2.5 Katılım: iki küçük kapı (4 haftalık deneme İPTAL)

| Kapı | Süre | Ne | Değerlendirme |
|------|------|-----|---------------|
| A | 72 saat | Tek çıktısı olan küçük görev (ör. sektörden 3 kişiyle konuşup not getirmek) | Teslim etti mi / etmedi mi. Süre dolunca sistem kartı otomatik işaretler. |
| B | 10 gün | Projede 2–3 gerçek görev | Taahhüt ettiğini teslim etti mi |

Toplam 13 gün. Kapı B'yi geçerse hak ediş **Kapı A'nın ilk gününden geriye dönük** başlar.

### 2.6 Bayatlama
- `contacted` aşamasında 7 gün cevap yok → otomatik takip görevi
- İkinci takipten sonra hâlâ sessiz → `archived` / `no_reply`
- `interviewed` aşamasında 5 günü aşan kart → kırmızı işaret

### 2.7 Karmaşıklık sınırı — bunlar YAPILMAYACAK
Sistem küçük kalsın diye bilerek dışarıda bırakılanlar:

- ❌ Takvim modülü — sadece `next_action_at` + `next_action_link` alanı; gerçek toplantı Google Takvim'de
- ❌ E-posta istemcisi — sadece taslak üretimi ve `hub_touches` kaydı
- ❌ Sohbet / mesajlaşma
- ❌ CV ayrıştırma — sadece link alanı
- ❌ Ayrı görev yöneticisi — mevcut sprint sistemi kullanılır
- ❌ **"Toplu mesaj gönder" butonu** — kalıcı olarak yok. Sistem şablon üretir, gönderimi insan yapar.

---

## 3. Otomatik / yarı otomatik / manuel

| İş | Tip |
|----|-----|
| Kaynak tarama → havuz | otomatik (butonla veya haftalık zamanlı) |
| Tekrar kayıt tespiti | otomatik |
| Bayatlama + takip görevi üretimi | otomatik (gece işi) |
| Aşama geçiş kaydı (kim, ne zaman) | otomatik |
| Metrik hesaplama | otomatik |
| Kapı A/B süre takibi | otomatik |
| AI ön puanı | yarı — öneri üretir, karar insanın |
| Mesaj taslağı | yarı — üretir, insan düzenler ve gönderir |
| Rol eşleştirme önerisi | yarı |
| Ret e-postası | yarı — taslak hazır, gönderim onayla |
| Kesin puanlama (rubrik) | **manuel** |
| Kırmızı bayrak işaretleme | **manuel** |
| Aşama ilerletme | **manuel** (çıkış koşulu kontrollü) |
| Mesaj gönderimi | **manuel** (kişisel hesaptan) |
| Finalist / arşiv kararı | **manuel** (sebep zorunlu) |

### Butonlar
| Buton | Ne yapar |
|-------|----------|
| `Taramayı çalıştır` | Seçilen kaynak için toplama işini başlatır, yeni kayıtlar `pool`'a düşer |
| `CSV içe aktar` | Sütun eşleme ekranı → ön izleme → onay |
| `Mesaj taslağı üret` | Şablon + adayın kanıtlarından taslak. **Kişiselleştirme satırı boşken kopyalama kilitli.** |
| `Takipleri oluştur` | Bayatlamış kartlar için takip görevi (gece de otomatik çalışır) |
| `Kapı A başlat` | Görev metni + 72 saatlik sayaç |
| `Kapı B başlat` | Proje seçimi + 10 günlük sayaç |
| `Ekibe aktar` | `joined` yapar, hak ediş başlangıç tarihini yazar |

---

## 4. Mevcut kod tabanı — uyulacak kurallar

### 4.1 Stack
- **Vite 6** + **React 18.3** (`@vitejs/plugin-react`), `"type": "module"`
- **Supabase** (`@supabase/supabase-js` v2) — auth + Postgres
- **Vercel** — `vercel.json` rewrites ile çok girişli SPA
- **Router kütüphanesi YOK** — sayfa geçişi `useState` + `sessionStorage` ile yapılıyor. Hub da aynı deseni izler, react-router **eklenmez**.

### 4.2 Mevcut giriş noktaları
| Yol | HTML | Entry |
|-----|------|-------|
| `/` | `index.html` | `src/main.jsx` → `src/app.jsx` |
| `/admin/` | `admin/index.html` | `src/admin/main.jsx` → `src/admin/admin-app.jsx` |
| `/team/` | `public/team/index.html` | Önceden paketlenmiş tek dosya, Vite dışı |

### 4.3 Tasarım sistemi — `src/styles/admin.css`
Fontlar: `Space Grotesk` (başlık), `DM Sans` (gövde) — Google Fonts'tan HTML'de yükleniyor.

```
--adm-bg: #FAF8F3          --adm-text: #1C1917
--adm-bg-card: #FFFFFF     --adm-text-secondary: #57534E
--adm-bg-sidebar: #1C1915  --adm-text-dim: #A29D94
--adm-bg-hover: #F5F1E9    --adm-border: #E7E0D2
--adm-red: #DC2626         --adm-border-light: #F0EADE
--adm-blue: #2563EB        --adm-green: #16A34A
--adm-purple: #7C3AED      --adm-orange: #EA580C   --adm-amber: #D97706
--adm-r: 10px  --adm-r-sm: 6px  --adm-r-lg: 14px   --sidebar-w: 260px
```

Hub **aynı token'ları** kullanır. `src/styles/hub.css` yazılır, `admin.css`'i import etmez — token bloğunu kopyalar (`--hub-*` değil, aynı `--adm-*` isimleriyle) ki paylaşılan bileşenler bozulmadan çalışsın.

### 4.4 Yeniden kullanılacak bileşenler — `src/admin/admin-ui.jsx`
```
AIcon, StatCard, DataTable, Modal, Field, Input, Textarea, Select,
SearchBar, PageHead, ConfirmDialog, TagInput, TriToggle, Stepper, PeoplePicker
```
`AIcon` önce `adminIcons`, sonra `src/ui-components.jsx` içindeki `iconSvgs`'e bakar. Yeni ikon gerekirse `adminIcons`'a eklenir.

### 4.5 Kod stili
- Mevcut dosyalarda `useState as useStateA` gibi takma adlar var — bu, script-tag döneminden kalma. **Yeni hub dosyalarında normal import kullan:** `import { useState, useEffect } from 'react'`.
- DB `snake_case`, JS `camelCase`. Aradaki dönüşüm **açık mapper fonksiyonlarıyla** yapılır (`mapCandidateToDb` / `mapCandidateFromDb`) — `admin-store.jsx`'teki desen birebir izlenir.
- Tüm arayüz metni **Türkçe**. Kod tanımlayıcıları İngilizce.

### 4.6 ⚠️ Tuzaklar
1. **`nextId` hack'i tekrarlanmayacak.** Mevcut tablolarda `id` kolonları identity'siz `bigint` olduğu için `admin-store.jsx` elle id üretiyor. **Tüm yeni hub tabloları `uuid` + `gen_random_uuid()` kullanır.**
2. **Team uygulamasına derin bağlanma.** `public/team/index.html` tüm durumu `app_state` tablosunda tek bir JSON bloğunda tutuyor. Kapı B **referansla** bağlanır (`project_id` + `person_id` yazılır), sprint verisi okunmaya çalışılmaz. Team app düzgün tablolara geçtiğinde bu bağlantı derinleştirilir.
3. **`applications` tablosu taşınmaz.** Mevcut inbound başvurular yerinde kalır; hub onları okuyup `hub_candidates`'e kopyalar ve `source_ref` alanında orijinal id'yi tutar.
4. **Rol sistemi yok.** `admin-app.jsx` sadece `session` varlığına bakıyor — oturum açan herkes tam yetkili. Hub bunu tekrarlamaz, `hub_members` + RLS ile gerçek yetki kurar.

---

## 5. Erişim ve roller

İlk aşamada **yalnızca Kadir ve Talha** (`cofounder`). Sistem oturunca `recruiter` ve `project_owner` açılır.

| Rol | Görür | Yapar |
|-----|-------|-------|
| `cofounder` | Her şey | Her şey + şablon/rubrik düzenleme + bayrak override |
| `recruiter` | Tüm hat | Aday ekleme, temas, görüşme, aşama ilerletme, tarama |
| `project_owner` | Yalnızca kendi projesinin adayları | Görüşme, rubrik, finalist önerme |

Yetki **hem RLS'te hem arayüzde** uygulanır. Arayüzdeki gizleme güvenlik değildir; RLS asıl kapıdır.

### 5.1 Supabase Auth entegrasyonu

**Aynı istemci, aynı oturum.** Hub, `src/lib/supabase.js`'teki mevcut istemciyi olduğu gibi import eder — yeni bir `createClient` çağrısı **yapılmaz**. Sonuç: `/admin/`'e giriş yapan kişi `/hub/`'a da girmiş olur, çıkış yapınca ikisinden birden çıkar. "Beni hatırla" davranışı (localStorage / sessionStorage seçimi) da aynen devralınır.

**Yetki e-postayla çözülür.** `hub_role()` fonksiyonu JWT'deki e-postaya bakar, `user_id`'ye değil. Bu sayede bir kişiyi Supabase hesabı açmadan önce yetkilendirebilirsin. Hesap açıldığı anda `auth.users` üzerindeki tetikleyici `user_id`'yi otomatik bağlar.

**Hub'da kayıt olma yok.** Yeni kullanıcı `hub_members`'a `cofounder` tarafından eklenir; Supabase hesabı ya zaten vardır ya da Supabase panelinden / mevcut `invite-member` edge function'ıyla açılır. Hub arayüzünde "Kayıt ol" bağlantısı bulunmaz.

### 5.2 Açılış akışı — `hub-app.jsx`

```
1. supabase.auth.getSession()                     → authLoading
2. oturum yok                                     → LoginPage (admin AuthShell deseni)
3. oturum var → hub_role() RPC çağrısı            → roleLoading
4. rol null                                       → NoAccessPage ("Bu alana erişiminiz yok" + Çıkış)
5. rol var                                        → HubApp, role prop'u ile
```

Kurallar:
- `supabase.auth.onAuthStateChange` dinlenir; `SIGNED_OUT` gelince state sıfırlanır, `PASSWORD_RECOVERY` gelince admin'deki `SetNewPasswordPage` deseni gösterilir.
- Rol **her oturum açılışında bir kez** RPC ile çekilir (`supabase.rpc('hub_role')`) ve context'e konur. localStorage'a yazılmaz — yetki değişince bir sonraki açılışta güncellenmelidir.
- Rol bilgisi **arayüzde asla güvenlik amaçlı kullanılmaz**; sadece hangi menünün görüneceğini belirler. Gerçek kısıt RLS'tedir.
- Tüm sorgular oturumlu istemci üzerinden gider. Service role anahtarı **hiçbir zaman** tarayıcıya konmaz.

### 5.3 Kabul testi (Adım 3'ün kriteri)

| Senaryo | Beklenen |
|---------|----------|
| Oturumsuz `/hub/` | Giriş ekranı |
| `hub_members`'ta olmayan bir hesapla giriş | "Erişiminiz yok" ekranı |
| Aynı hesapla `hub_candidates` sorgusu (konsoldan) | Boş sonuç — RLS engelliyor |
| `kadirks2003@gmail.com` ile giriş | Uygulama açılıyor, rol `cofounder` |
| `/admin/`'e giriş yapıp `/hub/`'a geçmek | Tekrar giriş istemiyor |
| Hub'dan çıkış yapıp `/admin/`'e gitmek | Giriş istiyor |

---

## 6. Veritabanı şeması

> Supabase SQL Editor'de çalıştırılır. Repoda `supabase/migrations/0001_hub.sql` olarak saklanır.

```sql
-- ══════════════════════════════════════════════════════════
-- 0001_hub.sql — Kurucu Hattı
-- ══════════════════════════════════════════════════════════

-- ── Üyelik / yetki ────────────────────────────────────────
create table hub_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        text not null default 'recruiter'
              check (role in ('cofounder','recruiter','project_owner')),
  -- project_owner kapsamı: startups.id değerleri (bigint — uuid DEĞİL).
  -- Kapsam projeye bağlanır, açık role değil: projeye yeni rol eklendiğinde
  -- o rolün adayları sahibine görünmeye devam etsin.
  startup_ids bigint[] default '{}',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Yetki E-POSTA üzerinden çözülür, user_id üzerinden değil.
-- Sebep: bir kişiyi Supabase hesabı açmadan ÖNCE yetkilendirebilmek gerekir.
-- user_id yine de doldurulur (aşağıdaki tetikleyici ile), ama yetkinin
-- kaynağı e-postadır. Her iki eşleşme de kabul edilir.
create or replace function hub_role() returns text
language sql stable security definer set search_path = public, auth as $$
  select role from hub_members
   where active = true
     and (user_id = auth.uid()
          or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
   limit 1
$$;

create or replace function is_hub_member() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select hub_role() is not null
$$;

-- project_owner'ın kapsamındaki projeler (startups.id listesi)
create or replace function hub_my_startups() returns bigint[]
language sql stable security definer set search_path = public, auth as $$
  select coalesce(startup_ids, '{}') from hub_members
   where active = true
     and (user_id = auth.uid()
          or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
   limit 1
$$;

-- Hesap İLK OLUŞTURULDUĞUNDA user_id'yi otomatik bağlar (girişte değil —
-- tetikleyici yalnızca auth.users'a insert'te çalışır). Zaten hesabı olanlar
-- aşağıdaki manuel update ile bağlanır. Her iki durumda da yetkinin kaynağı
-- e-postadır; user_id yalnızca kolaylık alanıdır, dolmamış olması yetkiyi
-- etkilemez.
create or replace function hub_link_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  update hub_members
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists hub_link_user_trg on auth.users;
create trigger hub_link_user_trg
after insert on auth.users
for each row execute function hub_link_user();

-- ── Açık roller (projelerin aradığı pozisyonlar) ──────────
create table hub_open_roles (
  id          uuid primary key default gen_random_uuid(),
  startup_id  bigint,                   -- startups.id (FK yok: tip uyumsuzluğu riski)
  title       text not null,
  role_type   text check (role_type in ('technical','business','design','operations')),
  profile     text,
  skills      text[] default '{}',
  urgency     text default 'normal' check (urgency in ('low','normal','high')),
  filled      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Adaylar ───────────────────────────────────────────────
create table hub_candidates (
  id            uuid primary key default gen_random_uuid(),

  -- kimlik
  full_name     text not null,
  email         text,
  linkedin      text,
  github        text,
  phone         text,
  city          text,

  -- eğitim
  university    text,
  department    text,
  class_year    text,                   -- '1','2','3','4','yl','dr'
  grad_year     int,
  edu_status    text check (edu_status in ('student','new_grad','working','unknown'))
                default 'unknown',
  data_trust    text not null default 'guess'
                check (data_trust in ('verified','declared','guess')),

  -- yetkinlik
  role_type     text check (role_type in ('technical','business','design','operations')),
  skills        text[] default '{}',
  languages     text[] default '{}',
  weekly_hours  int,

  -- kaynak
  source        text not null
                check (source in ('hackathon','github','dead_startup','incubator',
                                  'tubitak','club','bootcamp','competition',
                                  'content','open_source','referral','inbound',
                                  'event','other')),
  source_detail text,                   -- ör. "Teknofest 2026 finalistleri"
  source_ref    text,                   -- ör. applications.id
  batch_id      uuid,                   -- hub_import_batches.id
  evidence      jsonb default '[]',     -- [{type,url,note}]
  why_this_one  text,

  -- zenginleştirme (§8.6.5) — yalnızca halka açık veriden
  enrichment    jsonb default '{}',     -- {finished_projects, activity_recency,
                                        --  consistency, breadth, collaboration,
                                        --  solo_finisher, fetched_at}
  enriched_at   timestamptz,

  -- süreç
  stage         text not null default 'pool'
                check (stage in ('pool','contacted','replied','interviewed',
                                 'finalist','gate_a','gate_b','joined','archived')),
  -- Bayatlama sayacının referansı. updated_at KULLANILMAZ: herhangi bir alan
  -- düzenlendiğinde sıfırlanır ve takip görevi hiç doğmaz (§9 bkz.).
  stage_changed_at timestamptz not null default now(),
  archive_reason text check (archive_reason in
                ('no_reply','not_interested','no_time','below_bar','we_passed')),
  owner_id      uuid references hub_members(id),
  open_role_id  uuid references hub_open_roles(id),
  startup_id    bigint,

  -- puanlama
  score_finishing     int check (score_finishing between 1 and 5),
  score_communication int check (score_communication between 1 and 5),
  score_capacity      int check (score_capacity between 1 and 5),
  score_total   int generated always as
                (coalesce(score_finishing,0) + coalesce(score_communication,0)
                 + coalesce(score_capacity,0)) stored,
  ai_score      int,
  ai_score_note text,

  -- bayraklar
  red_flags     text[] default '{}',
  flag_notes    jsonb default '{}',
  override_reason text,

  -- takip
  tags          text[] default '{}',
  last_contact_at  timestamptz,
  next_action      text,
  next_action_at   timestamptz,
  next_action_link text,

  -- kvkk
  kvkk_consent  boolean not null default false,
  kvkk_at       timestamptz,
  retain_until  date default (current_date + interval '1 year'),

  created_by    uuid references hub_members(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index hub_cand_stage_idx  on hub_candidates(stage);
create index hub_cand_owner_idx  on hub_candidates(owner_id);
create index hub_cand_source_idx on hub_candidates(source);
create index hub_cand_uni_idx    on hub_candidates(university);
create index hub_cand_next_idx   on hub_candidates(next_action_at);
create unique index hub_cand_email_uq
  on hub_candidates(lower(email)) where email is not null;

-- ── Aşama geçiş günlüğü ───────────────────────────────────
create table hub_stage_log (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references hub_candidates(id) on delete cascade,
  from_stage   text,
  to_stage     text not null,
  reason       text,
  actor_id     uuid references hub_members(id),
  created_at   timestamptz not null default now()
);

-- ── Temaslar ──────────────────────────────────────────────
create table hub_touches (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references hub_candidates(id) on delete cascade,
  channel      text not null check (channel in ('linkedin','email','whatsapp','other')),
  template_id  uuid,
  variant      text,
  sender_id    uuid references hub_members(id),
  sent_at      timestamptz not null default now(),
  outcome      text default 'pending'
               check (outcome in ('pending','replied','declined','no_reply')),
  follow_up_at timestamptz,
  note         text
);
create index hub_touch_cand_idx on hub_touches(candidate_id);

-- ── Görüşmeler ────────────────────────────────────────────
create table hub_interviews (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references hub_candidates(id) on delete cascade,
  held_at       timestamptz not null default now(),
  interviewer_id uuid references hub_members(id),
  answers       jsonb default '{}',     -- {q1:{score,note}, ...}
  flags         text[] default '{}',
  decision      text check (decision in ('finalist','archive','hold')),
  note          text
);

-- ── Kapılar ───────────────────────────────────────────────
create table hub_gates (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references hub_candidates(id) on delete cascade,
  gate         text not null check (gate in ('A','B')),
  startup_id   bigint,
  person_id    bigint,                  -- people.id — team app'e referans
  task_text    text,
  started_at   timestamptz not null default now(),
  due_at       timestamptz not null,
  delivered    boolean,
  evaluation   text,
  result       text check (result in ('passed','failed','pending')) default 'pending'
);
create index hub_gate_due_idx on hub_gates(due_at) where result = 'pending';

-- ── Şablonlar ─────────────────────────────────────────────
create table hub_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  source_type  text,
  variant      text default 'A',
  subject      text,
  body         text not null,
  variables    text[] default '{}',
  sent_count   int not null default 0,
  reply_count  int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── Kaynak kütüğü (§8.6.8) ────────────────────────────────
-- Avın nerede yapılacağı birinin aklında değil, burada durur.
create table hub_source_registry (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,          -- "Teknofest sonuç sayfası"
  url           text,
  source        text not null,          -- hub_candidates.source ile aynı küme
  note          text,
  check_every   interval default '7 days',
  last_checked  timestamptz,
  owner_id      uuid references hub_members(id),
  status        text not null default 'active'
                check (status in ('active','paused','dead')),
  created_at    timestamptz not null default now()
);
create index hub_srcreg_due_idx on hub_source_registry(last_checked)
  where status = 'active';

-- ── İçe aktarma partileri (§8.6.3) ────────────────────────
-- Ham yapıştırılan metin saklanır: "bu kişi nereden gelmişti" sorusunun cevabı.
create table hub_import_batches (
  id            uuid primary key default gen_random_uuid(),
  method        text not null check (method in ('paste','csv','github','inbound')),
  source        text not null,
  source_detail text,
  event_date    date,
  raw_text      text,                   -- yalnızca 'paste' için
  parsed_count  int not null default 0,
  accepted_count int not null default 0,
  created_by    uuid references hub_members(id),
  created_at    timestamptz not null default now()
);

-- ── Kayıtlı görünümler ────────────────────────────────────
create table hub_views (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references hub_members(id),
  filters     jsonb not null default '{}',
  columns     text[] default '{}',
  sort        jsonb default '{}',
  shared      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── updated_at tetikleyicisi ──────────────────────────────
create or replace function hub_touch_updated() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger hub_cand_updated before update on hub_candidates
for each row execute function hub_touch_updated();

-- ══════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════
alter table hub_members    enable row level security;
alter table hub_candidates enable row level security;
alter table hub_stage_log  enable row level security;
alter table hub_touches    enable row level security;
alter table hub_interviews enable row level security;
alter table hub_gates      enable row level security;
alter table hub_templates  enable row level security;
alter table hub_views      enable row level security;
alter table hub_open_roles enable row level security;
alter table hub_source_registry enable row level security;
alter table hub_import_batches  enable row level security;

-- Üyeler kendi listesini görür; sadece cofounder yazar
create policy hub_members_read on hub_members
  for select using (is_hub_member());
create policy hub_members_write on hub_members
  for all using (hub_role() = 'cofounder') with check (hub_role() = 'cofounder');

-- Adaylar: cofounder/recruiter hepsini; project_owner yalnızca kendi projesini
create policy hub_cand_read on hub_candidates for select using (
  hub_role() in ('cofounder','recruiter')
  or (hub_role() = 'project_owner'
      and startup_id is not null
      and startup_id = any (hub_my_startups()))
);
create policy hub_cand_write on hub_candidates for all
  using (hub_role() in ('cofounder','recruiter'))
  with check (hub_role() in ('cofounder','recruiter'));

-- Bağlı tablolar: hub üyesi ise oku/yaz (aday görünürlüğü uygulama katmanında daraltılır)
create policy hub_log_all   on hub_stage_log  for all using (is_hub_member()) with check (is_hub_member());
create policy hub_touch_all on hub_touches    for all using (is_hub_member()) with check (is_hub_member());
create policy hub_int_all   on hub_interviews for all using (is_hub_member()) with check (is_hub_member());
create policy hub_gate_all  on hub_gates      for all using (is_hub_member()) with check (is_hub_member());
create policy hub_view_all  on hub_views      for all using (is_hub_member()) with check (is_hub_member());
create policy hub_role_all  on hub_open_roles for all using (is_hub_member()) with check (is_hub_member());
create policy hub_srcreg_all on hub_source_registry for all
  using (hub_role() in ('cofounder','recruiter'))
  with check (hub_role() in ('cofounder','recruiter'));
create policy hub_batch_all on hub_import_batches for all
  using (hub_role() in ('cofounder','recruiter'))
  with check (hub_role() in ('cofounder','recruiter'));

create policy hub_tpl_read  on hub_templates for select using (is_hub_member());
create policy hub_tpl_write on hub_templates for all
  using (hub_role() = 'cofounder') with check (hub_role() = 'cofounder');
```

### İlk kayıtlar
```sql
insert into hub_members (email, full_name, role) values
  ('kadirks2003@gmail.com',        'Kadir Kuş', 'cofounder'),
  ('talha@starthub-community.com', 'Talha',     'cofounder')
on conflict (email) do nothing;

-- Zaten hesabı olanların user_id'sini şimdi bağla
-- (hesabı olmayanlar ilk kayıtta tetikleyiciyle otomatik bağlanacak)
update hub_members m
   set user_id = u.id
  from auth.users u
 where lower(u.email) = lower(m.email)
   and m.user_id is null;
```

### Ek migration — `supabase/migrations/0002_hub_stage_clock.sql`

`0001` çalıştırıldıktan sonra eklendi. Bayatlama sayacı için ayrı zaman kolonu.

```sql
alter table hub_candidates
  add column if not exists stage_changed_at timestamptz not null default now();

-- Mevcut kayıtlar (varsa) için makul başlangıç
update hub_candidates
   set stage_changed_at = coalesce(updated_at, created_at)
 where stage_changed_at is null;

create index if not exists hub_cand_stageclock_idx
  on hub_candidates(stage, stage_changed_at);
```

### Ek migration — `supabase/migrations/0003_hub_vesting.sql`

Hak ediş başlangıcı hisseyi belirleyen tarihtir; log metnine gömülmez.
Katılım tarihi de "90 günde hâlâ aktif" metriğinin dayanağıdır.

```sql
alter table hub_candidates
  add column if not exists joined_at          timestamptz,
  add column if not exists vesting_start_date date;

comment on column hub_candidates.vesting_start_date is
  'Hak ediş başlangıcı — Kapı A''nın ilk günü, geriye dönük.';

create index if not exists hub_cand_joined_idx
  on hub_candidates(joined_at) where joined_at is not null;
```

`moveToTeam` bu iki alanı doldurur: `joined_at = now()`,
`vesting_start_date = min(hub_gates.started_at where gate='A')::date`.
`hub_stage_log.reason`'a da insan okusun diye yazılmaya devam edilir, ama
**kaynak artık kolondur**.

### Doğrulama sorguları
```sql
-- 1) Üyeler ve bağlanma durumu
select email, role, active, (user_id is not null) as linked from hub_members;

-- 2) Giriş yapmış kullanıcının rolü (Supabase SQL Editor'de null döner —
--    bunu uygulamadan test et)
select hub_role(), is_hub_member();
```

---

## 7. Dosya yapısı

```
hub/index.html                      ← yeni giriş (admin/index.html'in kopyası)
src/hub/
  main.jsx                          ← mount
  hub-app.jsx                       ← kabuk, auth kapısı, rol kapısı, sidebar, sayfa yönlendirme
  hub-store.jsx                     ← Supabase CRUD + context (admin-store deseni)
  hub-mappers.js                    ← toDb / fromDb dönüşümleri
  hub-constants.js                  ← aşamalar, kaynaklar, bayraklar, rubrik, eşikler
  hub-rules.js                      ← canAdvance(), isStale(), thresholdMet() — saf fonksiyonlar
  pages/
    today.jsx                       ← Bugün
    table.jsx                       ← Tablo (Excel benzeri)
    board.jsx                       ← Hat (kanban)
    candidate.jsx                   ← Aday kartı (panel/modal)
    templates.jsx                   ← Şablonlar
    import.jsx                      ← Yapıştır-ayrıştır, CSV, inbound çekme
    sources.jsx                     ← Kaynak kütüğü + GitHub taraması
    metrics.jsx                     ← Metrikler
    settings.jsx                    ← Üyeler, rubrik, bayrak listesi (yalnız cofounder)
  components/
    stage-badge.jsx  score-input.jsx  flag-checklist.jsx
    filter-bar.jsx   saved-views.jsx  evidence-list.jsx
src/styles/hub.css
supabase/migrations/0001_hub.sql
```

**Değişecek mevcut dosyalar (sadece bunlar):**
- `vite.config.js` → `rollupOptions.input`'a `hub: resolve(__dirname, 'hub/index.html')`
- `vercel.json` → rewrites'a **`/:path*` kuralından ÖNCE** `{ "source": "/hub/:path*", "destination": "/hub/index.html" }`

Başka hiçbir mevcut dosyaya dokunulmaz.

---

## 8. Ekranlar

### 8.1 Bugün (`today.jsx`) — varsayılan açılış
Sistemin her sabah açılmasını sağlayan ekran. Tek sütun, beş blok, her satırda tek tıkla aksiyon:

1. **Gönderilecek mesajlar** — `pool` aşamasında, sorumlusu ben olan, puanı eşiği geçen adaylar. Haftalık hedef göstergesi: `bu hafta 6/15`
2. **Süresi gelen takipler** — `hub_touches.follow_up_at <= now()`
3. **Bugünkü görüşmeler** — `next_action_at` bugün + takvim linki
4. **Bayatlamış kartlar** — kural motorundan
5. **Süresi dolan kapılar** — `hub_gates.due_at <= now() and result = 'pending'`

Blok boşsa gizlenir. Hepsi boşsa: *"Bugün temiz. Havuza yeni aday eklemek ister misin?"*

### 8.2 Tablo (`table.jsx`) — asıl çalışma ekranı
Excel gibi davranır:
- **Aday ekleme — üç yol:**
  1. **Elle tek aday** — tablonun en üstünde `+ Yeni aday` satırı; tıklayınca boş satır açılır, hücreler doldurulur, `Enter` kaydeder. Zorunlu alanlar: `full_name`, en az bir iletişim (`email` / `linkedin` / `github`), `source`. Elle girilen kayıtta `data_trust` varsayılanı `declared`.
  2. **CSV toplu içe aktarma** — bkz. §8.6
  3. **Otomatik kaynaklar** — GitHub taraması, `applications` tablosundan inbound

  İlk haftalarda en çok kullanılan yol birincisidir; LinkedIn'de birini görüp doğrudan satır olarak eklemek tek tıkla mümkün olmalı.
- Hücre içi düzenleme, `Tab`/`Enter` ile ilerleme, `Esc` iptal
- Satır seçimi (checkbox, `Shift`+tık aralık) → toplu işlem: aşama, sorumlu, etiket, arşivle
- Sütun gizle/göster + sürükleyerek sıra değiştirme, ilk sütun dondurulmuş
- Sıralama (çoklu sütun)
- CSV dışa aktarma (görünen sütunlar + filtre) / içe aktarma
- Sütun düzeni ve sıralama **kayıtlı görünümle birlikte** saklanır

Optimistic UI: `admin-store.jsx`'teki `patchLocal` deseni — önce yerel güncelle, sonra Supabase'e yaz, hata olursa geri al.

### 8.3 Hat (`board.jsx`)
Sekiz sütunlu kanban. Sürükle-bırak, ama `canAdvance()` `false` dönerse bırakma reddedilir ve **neden reddedildiği** toast olarak gösterilir (ör. *"Rubrik doldurulmadan görüşme aşaması geçilemez"*).

Kart üstünde: ad · üniversite · kaynak rozeti · toplam puan · sorumlu baş harfleri · bayrak sayısı (varsa kırmızı) · bayatlık noktası.
Sütun başlığında: sayı + bir önceki aşamadan dönüşüm oranı.

### 8.4 Aday kartı (`candidate.jsx`)
Sağdan açılan panel, üç sekme:
- **Özet** — kimlik, eğitim (güven etiketiyle), kanıt linkleri, `why_this_one`, sonraki aksiyon (zorunlu alan)
- **Değerlendirme** — üç eksenli puan girişi, AI ön puanı (`öneri` etiketli, salt okunur), kırmızı bayrak kutucukları + notları, eşik durumu göstergesi
- **Geçmiş** — temaslar, görüşmeler, kapılar, aşama günlüğü (tek zaman çizelgesi)

### 8.5 Şablonlar (`templates.jsx`)
Kaynak tipine göre metinler, `{{ad}} {{kanıt}} {{proje}}` değişkenleri, A/B varyant, varyant başına cevap oranı. Ret ve davet metinleri de burada.
**Kişiselleştirme satırı zorunlu alan** — boşken "Kopyala" butonu devre dışı.

### 8.5b Mesaj gönderme akışı (uçtan uca)

Sistem **hiçbir mesajı kendisi göndermez.** Akış şudur:

1. Tabloda veya Hat'ta adaya tıkla → aday kartı açılır
2. **Özet** sekmesinde kanıtları oku (GitHub, hackathon projesi, yazısı), `why_this_one` notunu yaz
3. `Mesaj taslağı üret` → iki seçenek:
   - **AI taslağı** — kanıtlardan kişiselleştirme satırını üretir, şablonun gövdesiyle birleştirir
   - **Düz şablon** — kaynak tipine uygun şablonu değişkenler doldurulmuş halde verir, kişiselleştirme satırını sen yazarsın
4. Taslağı düzenle. **Kişiselleştirme satırı boşken `Kopyala` butonu devre dışıdır.**
5. `Kopyala` → panoya alınır **ve aynı anda:**
   - `hub_touches` kaydı oluşur (kanal, şablon, varyant, gönderen, tarih)
   - Aday `contacted` aşamasına geçer
   - 7 günlük takip tarihi kurulur (`follow_up_at`)
   - Şablonun `sent_count` sayacı artar
6. Sen LinkedIn/e-postayı açıp yapıştırır ve **kendi hesabından** gönderirsin
7. Cevap gelince aday kartından `Cevap geldi` işaretlenir → aşama `replied`, şablonun `reply_count` artar

Kanal seçimi (`linkedin` / `email` / `whatsapp`) kopyalama anında sorulur — cevap oranlarını kanal bazında ölçebilmek için.

### 8.6 Yetenek avı (`import.jsx` + `sources.jsx`)

Sistemin kalbi. Aşağıdaki dokuz alt bölüm tek bir ilkeye dayanır:

> **Sistem insanları bulmaz — bulmayı hızlandırır.**
> Keşif insan işidir, ayrıştırma ve zenginleştirme makine işidir. Bu ikisini
> karıştıran her tasarım ya çalışmaz ya da kullanım şartlarını ihlal eder.

---

#### 8.6.1 Kaynak haritası — gerçekçi tablo

Otomasyon seviyeleri: **Oto** = API'den çekilir · **Yarı** = insan bulur, AI ayrıştırır · **El** = tamamen elle

| # | Kaynak | Otomasyon | Üniversite bilgisi | Hacim | Kalite |
|---|--------|-----------|--------------------|-------|--------|
| 1 | GitHub (konum/dil/aktiflik) | **Oto** | Yok | Yüksek | Orta |
| 2 | Hackathon finalist listeleri (Teknofest, üniversite, banka/operatör, BTK) | Yarı | Genellikle var | Orta | **Yüksek** |
| 3 | Kuluçka/hızlandırıcı demo day listeleri (İTÜ Çekirdek, ODTÜ Teknokent, KWORKS, Bilkent Cyberpark, Yıldız Teknopark, Bilişim Vadisi) | Yarı | Kısmen | Düşük | **Yüksek** |
| 4 | TÜBİTAK 2209-A/B proje sahipleri, TEKNOFEST takım listeleri | Yarı | Var | Orta | Yüksek |
| 5 | Kapanmış/duraklamış girişimlerin kurucuları | El | Kısmen | Düşük | **Çok yüksek** |
| 6 | Üniversite kulüpleri yönetim kurulları (IEEE, ACM, GDG on Campus, girişimcilik kulüpleri) | Yarı | Var | Orta | Orta |
| 7 | Bootcamp mezun/demo günleri (Patika, Kodluyoruz, Techcareer) | Yarı | Kısmen | Yüksek | Orta |
| 8 | Yarışmalar (ACM-ICPC TR, Kaggle, Codeforces TR) | Yarı | Kısmen | Düşük | Yüksek |
| 9 | Türkçe teknik içerik üretenler (Medium, YouTube, blog) | El | Nadiren | Düşük | Yüksek |
| 10 | Açık kaynak katkıcıları (TR yerelleştirme, TR odaklı projeler) | Yarı | Yok | Düşük | Yüksek |
| 11 | **Referans** (üyelerden isim isteme) | El | Var | Düşük | **En yüksek** |
| 12 | **Inbound** (site başvurusu) | Oto | Var, beyan | Değişken | Değişken |

**Okunacak sonuç:** en yüksek kaliteli kaynakların hiçbiri otomatik değil. Otomasyonun görevi hacim üretmek değil, insanın bulduğu şeyi dakikalar içinde satıra çevirmek.

> ⛔ **LinkedIn kazınmaz.** Kullanım şartlarına aykırı, hesap kapatılır, ve Türkiye'deki öğrenci girişim çevresi küçük olduğu için tek bir ekran görüntüsü markayı yakar. Satın alınmış liste de kullanılmaz.

---

#### 8.6.2 Beş giriş yöntemi

| Yöntem | Ne zaman | Ekran |
|--------|----------|-------|
| **Yapıştır ve ayrıştır** | Haftalık avın ana aracı | `import.jsx` |
| **GitHub taraması** | Teknik rol ararken | `sources.jsx` |
| **CSV içe aktarma** | Elde hazır tablo varsa | `import.jsx` |
| **Inbound çekme** | `applications` tablosundan | `import.jsx` |
| **Elle tek aday** | Anlık bulunan kişi | Tablo görünümü (§8.2) |

---

#### 8.6.3 Yapıştır ve ayrıştır — ana araç

Hiçbir siteyi kazımadan, dağınık halka açık metni satıra çevirir.

**Akış:**

1. **Yapıştır** — büyük bir metin kutusu. İçine ne yapıştırıldığı fark etmez: hackathon sonuç sayfası, demo day listesi, haber metni, kulüp yönetim kurulu sayfası, ekran görüntüsünden çıkarılmış metin.
2. **Parti bilgisi** — tüm gruba uygulanacak alanlar tek seferde girilir: `source`, `source_detail` (ör. "Teknofest 2026 Ulaşımda Yapay Zeka finalistleri"), etkinlik tarihi, varsayılan `role_type`.
3. **Ayrıştır** — AI metinden yapılandırılmış satırlar çıkarır:
   `full_name` · `team_name` · `project` · `university` · `department` · `links[]` · `note`
4. **Güven işaretleme** — AI her alan için güven belirtir; sistem bunu `data_trust`'a çevirir:
   - metinde açıkça yazıyor → `declared`
   - çıkarım/tahmin → `guess`
   - hiç yok → alan boş bırakılır, **uydurulmaz**
5. **Tekrar tespiti** — havuzdaki mevcut kayıtlarla karşılaştırma (ad benzerliği + link eşleşmesi). Tekrar bulunan satır "mevcut kayda ekle" veya "atla" olarak işaretlenir.
6. **Ön izleme tablosu** — düzenlenebilir. Her satırda `al` / `atla` kutusu. Varsayılan: hepsi seçili.
7. **Onayla** → havuza düşer.

**Kurallar:**
- AI **asla alan uydurmaz.** Metinde olmayan üniversite, e-posta veya link boş kalır. Bu kural katıdır — uydurma veri, filtreyi ve sonraki tüm kararları zehirler.
- Ayrıştırma sonucu hiçbir zaman doğrudan kaydedilmez; ön izleme adımı atlanamaz.
- Yapıştırılan ham metin `hub_import_batches.raw_text` alanında saklanır — sonradan "bu kişi nereden gelmişti" sorusunun cevabı.

---

#### 8.6.4 GitHub taraması

Tek gerçek otomatik kaynak. GitHub REST API, kimlik doğrulamalı.

**Arama parametreleri (arayüzden ayarlanabilir):**
```
location    : Turkey, Istanbul, Ankara, Izmir, …
language    : TypeScript, Python, Swift, Kotlin, …
repos       : >= 3
followers   : >= 0
son aktiflik: son 6 ay içinde push
```

**Her bulunan kullanıcı için çekilenler:** `login`, `name`, `bio`, `blog`, `company`, `location`, `public_repos`, `created_at`, ve en çok yıldız alan 5 reposunun `name / description / language / stargazers / pushed_at / has_pages / homepage / topics`.

⚠️ **`pushed:` niteleyicisi sorguya KONMAZ.** GitHub'da `pushed:` yalnızca
*repository* aramasında geçerlidir; *user* aramasında kullanılınca sorgu
sessizce `total_count: 0` döner — filtre çalışmaz, tarama boş gelir ve hata
da vermez.

**Son aktiflik filtresi tarama sonrası uygulanır:** sorgu `location` +
`language` + `repos` + `followers` ile çalışır, aktiflik ise zenginleştirmede
hesaplanan `activity_recency` üzerinden sonuç kümesi filtrelenir. Repolar
zaten çekildiği için ek API maliyeti yoktur. Arayüzde bu alanın yanına
*"tarama sonrası filtrelenir"* notu yazılır.

**Sınırlar (arayüzde açıkça yazılır):**
- Arama API'si dakikada 30 istek — tarama kuyrukta ilerler, ilerleme çubuğu gösterilir
- **Üniversite bilgisi gelmez** → `data_trust = 'guess'`, `edu_status = 'unknown'`
- E-posta çoğu zaman gizli → iletişim `github` üzerinden kurulur
- Şirket alanı doluysa `edu_status = 'working'` önerilir (kesinleştirilmez)

---

#### 8.6.5 Zenginleştirme — "deep detay analizi" tam olarak ne üretir

Bir aday havuza girdikten sonra, elde link varsa çalışan analiz.

**GitHub'dan çıkarılan sinyaller:**

| Sinyal | Tanım |
|--------|-------|
| `finished_projects` | README > 400 karakter **ve** (release var **veya** `homepage` dolu **veya** ≥ 5 yıldız) olan repo sayısı |
| `activity_recency` | En son push'tan bu yana geçen gün |
| `consistency` | Son 12 ayın kaç ayında katkı var |
| `breadth` | Kullandığı farklı dil sayısı |
| `collaboration` | Başkasının reposuna açtığı PR sayısı, organizasyon üyelikleri |
| `solo_finisher` | Tek başına başlatıp bitirdiği proje var mı |

**Web'den:** kişisel blog, portfolyo sitesi, Medium/YouTube varlığı — yalnızca `blog` alanı veya profil metnindeki linklerden.

**Kesinlikle çıkarılamayanlar** — arayüzde de böyle yazar:
- Üniversite, bölüm, sınıf (kaynak metninde yoksa)
- E-posta (gizliyse)
- LinkedIn'deki hiçbir şey
- Müsait saat / kapasite
- İletişim becerisi

---

#### 8.6.6 AI ön puanı — üç eksenden yalnızca biri

AI **sadece `bitirmişlik`** eksenini tahmin eder. `iletişim` ve `kapasite` boş bırakılır; onlar görüşmeden çıkar.

| Ön puan | Koşul |
|---------|-------|
| 5 | ≥ 2 `finished_projects` **ve** en az biri canlı/kullanıcılı görünüyor |
| 4 | 1 `finished_projects` + son 6 ayda aktif |
| 3 | Çok repo var ama bitmiş görünen yok |
| 2 | Az sayıda, çoğu eğitim/kopya repo |
| 1 | Boş veya yalnızca fork |

Puanın yanında **güven seviyesi** ve **hangi kanıta dayandığı** gösterilir. Örnek:
> *Ön puan 4 · orta güven · `kadir/tid-ceviri` — 340 yıldız, canlı demo linki var, son push 3 hafta önce*

Kurallar:
- `ai_score` insan puanının **üstüne asla yazmaz**, ayrı kolonda durur
- Arayüzde `öneri` etiketiyle ve soluk renkle gösterilir
- Görüşme sonrası insan puanı girildiğinde ön puan geri planda kalır, silinmez (sonradan "AI ne kadar isabetliydi" ölçülebilsin diye)

---

#### 8.6.7 "Neden bu kişi" cümlesi

AI'ın ikinci işi. Bu cümle sonra mesajın kişiselleştirme satırına gider — **kişiselleştirmenin gerçek olmasını sağlayan tek şey budur.**

**Kurallar:**
- Somut bir esere atıf yapmak zorunda (repo adı, proje adı, yarışma, yazı başlığı)
- En fazla iki cümle
- Kişi hakkında sıfat kullanmaz ("yetenekli", "başarılı" gibi) — sadece ne yaptığını söyler
- Doğrulanabilir olmayan hiçbir şey yazmaz

**Kötü:** *"Çok yetenekli bir geliştirici, projelerin etkileyici."*
**İyi:** *"Teknofest 2026'da TİD çeviri projesiyle finale kaldı; GitHub'daki `tid-ceviri` deposunda canlı demo linki var, son güncelleme 3 hafta önce."*

Sahte kişiselleştirme hiç mesaj atmamaktan kötüdür. Bu yüzden §8.5b'de kişiselleştirme satırı boşken kopyalama kilitlidir.

---

#### 8.6.8 Kaynak kütüğü ve haftalık av ritüeli

Avın nerede yapılacağı birinin aklında değil, sistemde durur.

**`hub_source_registry`** — düzenli kontrol edilecek yerlerin listesi: ad, URL, tip, kontrol sıklığı, son kontrol tarihi, sorumlu, not. Süresi gelen kaynaklar Bugün ekranında *"kontrol zamanı"* olarak belirir.

**Haftalık av (2 saat, tek kişi):**
1. Kütükte süresi gelen kaynakları aç
2. Bulduğun listeleri yapıştır-ayrıştır ile havuza dök
3. GitHub taramasını çalıştır
4. Üyelerden gelen referansları gir
5. Yeni gelenleri hızlı triyajdan geçir

**Haftalık hedef:** havuza 30 yeni aday, hattan 15 yeni temas.

---

#### 8.6.9 Kaynak performansı — kendi kendini iyileştiren av

Her kaynak ölçülür: kaç aday üretti → kaçı cevap verdi → kaçı görüşmeye geldi → kaçı ekibe katıldı → kaçı 90 gün sonra hâlâ aktif.

`metrics.jsx` içinde kaynak kırılımı olarak gösterilir.

**Kural:** 8 hafta sonunda hiç görüşmeye dönüşmemiş bir kaynak kütükte `pasif` işaretlenir. Zamanını ölü kaynağa harcamamanın tek yolu bunu ölçmek.

---

#### 8.6.9b "AI" ne demek — mevcut uygulama deterministik

§8.6.3, §8.6.6 ve §8.6.7'de geçen "AI" ifadesi gevşek bir kelime seçimiydi.
**İlk sürümde LLM çağrısı yok**; üçü de kod düzeyinde uygulanır:

| Yer | Uygulama | LLM gerekir mi |
|-----|----------|----------------|
| Yapıştır-ayrıştır | Regex + sezgisel: e-posta, GitHub/LinkedIn URL, bilinen üniversite listesi, Türkçe liste kalıpları | Faydalı olur, şart değil |
| Ön puan | §8.6.6 tablosunun birebir kod hali — enrichment sinyallerinden | **Hayır**, zaten kural tablosu |
| "Neden bu kişi" | En güçlü kanıttan şablon (repo adı, yıldız, demo, son push) | **Hayır**, şablon kurallara daha uyumlu |

**Değişim yeri (seam):** `parsePastedText()` ve `prescore()` saf, dışa
aktarılan fonksiyonlardır — girdi metin/sinyal, çıktı yapılandırılmış veri,
yan etki yok. İleride LLM'e geçilirse değişecek tek yer bunlardır.

**Ayrıştırıcı kalıpları** (Türkçe kaynaklar için):
- `1. Takım Adı — Üye1, Üye2, Üye3 (İTÜ)`
- Satır başında sıra numarası / madde işareti
- `Ad Soyad, Bölüm, Üniversite` virgüllü listeler
- Metin içindeki `e-posta`, `github.com/…`, `linkedin.com/in/…`
- Bilinen Türk üniversitesi adları ve kısaltmaları (`hub-constants.js`)

⚠️ Kalıba uymayan satır **atlanmaz** — "ayrıştırılamadı" olarak ön izlemeye
düşer, insan elle düzeltir. Sessizce kaybolmaz.

⚠️ **Uydurma yok kuralı kod düzeyinde garanti:** bir alan ancak metinde
bulunduysa doldurulur; bulunamayan alan boş kalır ve `data_trust='guess'`
olur. Tahmin üretilmez.

🔒 İleride LLM eklenirse API anahtarı **yalnızca Supabase edge function'da**
durur — tarayıcıya asla konmaz.

#### 8.6.10 KVKK ve etik sınırlar

- Yalnızca **halka açık** veri işlenir
- LinkedIn kazınmaz, satın alınmış liste kullanılmaz
- İlk temasta aydınlatma metnine link verilir
- `retain_until` varsayılan 1 yıl; süresi dolan kayıtlar Bugün ekranında listelenir
- Ayarlar'da "adayı tamamen sil" aksiyonu bulunur (tüm bağlı kayıtlarla birlikte)
- Ham yapıştırma metinleri de silme kapsamındadır

### 8.7 Metrikler (`metrics.jsx`)
| Metrik | Hedef |
|--------|-------|
| Kaynak başına cevap oranı | %20+ |
| Cevaptan görüşmeye | %50+ |
| Görüşmeden finaliste | %25 |
| Kurucu başına temas | 50–80 |
| Kapı A geçme | %60 |
| Kapı B geçme | %70 |
| **90 günde hâlâ aktif** | **%70+** |

Son satır asıl kalite ölçüsü, **ilk günden tutulmaya başlanır** — geriye dönük hesaplanamaz.

### Dönüşüm oranı nasıl hesaplanır — kritik

Oranlar **mevcut aşama dağılımından değil, `hub_stage_log`'dan** hesaplanır:
bir aşamanın paydası, o aşamaya **hiç ulaşmış** benzersiz aday sayısıdır.

⚠️ **Arşivlenenler paydadan çıkarılmaz.** Aksi halde oranlar yalan söyler:
10 kişiyle görüşüp 8'ini arşivlersen ve 2'si finalist olursa, arşivlenenleri
saymayan bir formül %100 dönüşüm gösterir. Doğrusu %20'dir.

```
görüşmeden finaliste = (finalist'e hiç ulaşmış aday sayısı)
                     / (interviewed'a hiç ulaşmış aday sayısı)
```

Aynı kural Hat görünümündeki sütun başlığı oranları için de geçerlidir:
oradaki **sayı** mevcut doluluk, **oran** ise `hub_stage_log`'dan gelir.

---

## 9. Kural motoru (`hub-rules.js`)

Saf, test edilebilir fonksiyonlar. Arayüz bunları çağırır, mantığı kopyalamaz.

```js
canAdvance(candidate, toStage) -> { ok: boolean, reason?: string }
```

### Sıra zorunluluğu — atlanamaz

Aşamalar sıralıdır ve **ileri yönde yalnızca bir sonraki aşamaya** geçilebilir:

```
pool(0) → contacted(1) → replied(2) → interviewed(3)
        → finalist(4) → gate_a(5) → gate_b(6) → joined(7)
```

| Hareket | İzin |
|---------|------|
| `index + 1` | ✅ serbest (hedef aşamanın kendi koşulu da sağlanmalı) |
| `index + 2` ve fazlası | ❌ **reddedilir** — yalnızca `cofounder` + gerekçe ile |
| Geri (`index - n`) | ✅ serbest, ama `hub_stage_log`'a yazılır |
| `archived` | ✅ her aşamadan, `archive_reason` zorunlu |

⚠️ **Neden katı:** puanlar elle doldurulabildiği için, sıra kontrolü olmadan
bir aday `pool`'dan doğrudan `finalist`'e atlayabilir — görüşme hiç yapılmadan.
Bu, elemenin bel kemiğini deler ve dönüşüm metriklerini de bozar
(`interviewed`'a uğramayan bir finalist payı şişirir).

Atlama gerçekten gerekiyorsa (örneğin zaten tanıdığın bir referans), yolu
`cofounder` rolü + `override_reason` — sessizce değil, kayda geçerek.
Kontroller:
- `contacted` → en az bir `hub_touches` kaydı
- `interviewed` → rubrik dolu (üç eksen de girilmiş)
- `finalist` → eşik sağlanmış (`toplam ≥ 10` ve `min eksen > 2`) **ve** `red_flags.length < 2` (ya da `cofounder` + `override_reason`)
- `gate_a` / `gate_b` → ilgili `hub_gates` kaydı açılmış
- `archived` → `archive_reason` dolu

```js
thresholdMet(c)  -> boolean
isStale(c, now)  -> { stale: boolean, level: 'warn'|'critical', days: number }
gateStatus(gate, now) -> 'running' | 'due' | 'overdue'
```

### Bayatlama sayacının referans zamanı

| Aşama | Sayaç neyden başlar | warn | critical |
|-------|---------------------|------|----------|
| `contacted` | `last_contact_at` | 7 gün | 14 gün |
| `interviewed` | `stage_changed_at` | 5 gün | 10 gün |
| `replied` | `stage_changed_at` | 3 gün | 7 gün |
| `finalist` | `stage_changed_at` | 5 gün | 10 gün |
| diğerleri | bayatlama uygulanmaz | — | — |

⚠️ **`updated_at` referans olarak KULLANILMAZ.** Herhangi bir alan düzenlendiğinde
sıfırlanır; 6. günde bir etiket değiştirmek 7 günlük takip görevini hiç
doğurmamasına yol açar. Sayaç yalnızca `stage_changed_at` ve `last_contact_at`
üzerinden işler.

`stage_changed_at` **her aşama değişiminde** güncellenir — `logStage` çağrısıyla
aynı işlemde, store katmanında.

`gateStatus`: vade geçmemişse `running`, vade ile vade+24 saat arası `due`,
sonrası `overdue`.

---

## 10. Otomasyon işleri

Supabase Edge Function + `pg_cron` (mevcut `supabase/functions/` deseni izlenir).

| İş | Sıklık | Ne yapar |
|----|--------|----------|
| `hub-daily` | Her gece 03:00 | Bayatlıkları hesaplar, takip görevi üretir, süresi dolan kapıları işaretler, ikinci takipten sonra sessiz kalanları `archived`/`no_reply` yapar |
| `hub-weekly` | Pazartesi 08:00 | Haftalık özet e-postası (mevcut `send-mail` fonksiyonu kullanılır) |
| `hub-scan` | Elle / haftalık | Kaynak tarama — ilk sürümde yalnızca GitHub |

⚠️ **Otomatik arşivleme yalnızca `no_reply` için çalışır.** Başka hiçbir aşamada sistem kendiliğinden karar vermez.

---

## 11. Claude Code görev sırası

Her adım tek başına çalışır durumda bitmeli. Bir adım bitmeden diğerine geçilmez.

**1 — İskelet**
`hub/index.html`, `src/hub/main.jsx`, `src/hub/hub-app.jsx`, `src/styles/hub.css` oluştur. `vite.config.js` ve `vercel.json` güncelle. `npm run build` hatasız geçmeli, `/hub/` boş kabuk göstermeli.
*Kabul:* build geçiyor, `/hub/` açılıyor, `/` ve `/admin/` bozulmamış.

**2 — Şema**
`supabase/migrations/0001_hub.sql` yaz, Supabase'de çalıştır, iki `hub_members` kaydını gir.
*Kabul:* tablolar var, RLS açık, üye olmayan kullanıcı `hub_candidates`'ten satır çekemiyor.

**3 — Auth + rol kapısı**
`hub-app.jsx`: oturum yok → giriş; oturum var, üye değil → erişim yok ekranı; üye → uygulama. `useHubMember()` hook'u rolü döner.
*Kabul:* üye olmayan bir hesapla `/hub/` açıldığında erişim reddediliyor.

**4 — Store + mappers + sabitler**
`hub-store.jsx`, `hub-mappers.js`, `hub-constants.js`. `admin-store.jsx` desenini izle: paralel yükleme, `patchLocal` optimistic update, açık mapper'lar.
*Kabul:* konsoldan aday ekle/güncelle/sil çalışıyor.

**5 — Kural motoru + testler**
`hub-rules.js` ve her fonksiyon için birkaç örnek senaryo.
*Kabul:* 5-5-1 puanlı aday `finalist` olamıyor; 2 bayraklı aday `cofounder` override'ı olmadan geçemiyor.

**6 — Tablo görünümü**
Excel davranışlı ana ekran + filtre çubuğu + kayıtlı görünümler + CSV dışa aktarma.
*Kabul:* 100 satırda hücre düzenleme, çoklu seçim ve toplu aşama değiştirme akıcı çalışıyor.

**7 — Aday kartı**
Üç sekmeli panel, puanlama, bayrak kutucukları, geçmiş zaman çizelgesi.
*Kabul:* puan girildiğinde eşik göstergesi anında güncelleniyor.

**8 — Hat görünümü**
Kanban, `canAdvance()` kontrollü sürükle-bırak, reddedilince sebep toast'ı.
*Kabul:* rubrik dolmadan görüşme sütununa bırakma reddediliyor ve sebep görünüyor.

**9 — Bugün ekranı**
Beş blok, varsayılan açılış sayfası yapılır.
*Kabul:* takip süresi geçmiş bir aday listede çıkıyor.

**10 — Şablonlar + temas kaydı**
Şablon CRUD, değişken doldurma, kişiselleştirme kilidi, "Kopyala" sonrası temas kaydı oluşturma.
*Kabul:* kişiselleştirme boşken kopyalama kapalı.

**11 — Kapı A / Kapı B**
Sayaçlar, görev metni, `Ekibe aktar`.
*Kabul:* 72 saati geçen kapı Bugün ekranında beliriyor.

**12 — Yetenek avı** *(en büyük adım — üçe bölünebilir)*
§8.6'nın tamamı: yapıştır-ayrıştır, GitHub taraması, CSV, inbound çekme, kaynak kütüğü, zenginleştirme, AI ön puanı ve "neden bu kişi" cümlesi.
Sırası: **12a** yapıştır-ayrıştır + CSV + inbound → **12b** GitHub taraması + zenginleştirme + ön puan → **12c** kaynak kütüğü + Bugün ekranına bağlanması.
*Kabul:* 40 satırlık bir hackathon sonuç metni yapıştırıldığında satırlara ayrılıyor, metinde olmayan alan boş kalıyor (uydurulmuyor), tekrar kayıt tespit ediliyor, ön izlemeden onaylanınca havuza düşüyor.

**13 — Metrikler**
Yedi metrik, kaynak kırılımı.

**14 — Otomasyon**
`hub-daily` edge function + cron.

**15 — Ayarlar**
Üye yönetimi, rubrik metinleri, bayrak listesi — yalnız `cofounder`.

---

## 12. Roller, talep akışı ve iki hat

> Bu bölüm sistemin ikinci turudur. Amacı: **her şeyin hub'dan yürümesi.**
> Rol açmak, aday aramak, sunmak ve karar vermek — hiçbiri Supabase'den ya da
> sohbetten değil, arayüzden yapılır.

### 12.1 İki hat

Aynı boru hattı, adayda bir `track` alanı, ona göre değişen kurallar.

| | **Kurucu** (`founder`) | **Üye** (`member`) |
|---|---|---|
| Eşik | toplam ≥ 10 **ve** hiçbir eksen ≤ 2 | bitirmişlik ≥ 3 **ve** kapasite ≥ 3 |
| İletişim ekseni | zorunlu | rol gerektiriyorsa zorunlu (`needs_communication`) |
| Kapılar | Kapı A (72s) **+** Kapı B (10g) | **yalnızca Kapı A** |
| Teklif | kurucu ortaklık, hisse masada | projede rol, opsiyon havuzundan pay |
| Kim yürütür | Starthub (cofounder / recruiter) | recruiter arar, **proje sahibi karar verir** |

**Neden üyede tek kapı:** kötü bir üyenin maliyeti kötü bir kurucununkinin çok
altında. Ayrıca üyenin 10 günlük sprinti zaten *işin kendisi* — aynı işi hem
deneme hem görev diye iki kez yaptırmak gereksiz sürtünme yaratır.

⚠️ Eşikler `hub-constants.js`'te **hat bazında** tanımlanır. `hub-rules.js`
kuralları adayın `track` alanına göre uygular; hiçbir bileşen kendi eşiğini yazmaz.

### 12.2 Açık rol — durum makinesi

```
draft → requested → sourcing → shortlist → filled
                 ↘ paused ↗        ↘ cancelled
```

| Durum | Ne demek | Kim ilerletir |
|-------|----------|---------------|
| `draft` | Yazılıyor, henüz talep edilmedi | proje sahibi |
| `requested` | Talep gönderildi, recruiter bekliyor | proje sahibi |
| `sourcing` | Recruiter üstlendi, arıyor | recruiter |
| `shortlist` | En az bir aday sunuldu | recruiter |
| `filled` | Aday kabul edildi ve ekibe katıldı | sistem (aday `joined` olunca) |
| `paused` / `cancelled` | Donduruldu / iptal | proje sahibi veya cofounder |

### 12.3 Talep akışı — her adımda tek karar verici

1. **Proje sahibi** rol açar ve `Talep gönder` der → `requested`
2. Rol, **recruiter'ın Bugün ekranına** düşer
3. Recruiter `Üstlen` der → `sourcing`, süre sayacı başlar
4. Recruiter havuzu doldurur, temas kurar, görüşür, puanlar
5. Eşiği geçen adayda `Proje sahibine sun` → aday `presented_at` alır,
   rol `shortlist` olur, aday **proje sahibinin Bugün ekranına** düşer
6. **Proje sahibi** görüşür ve **kabul veya ret** eder — karar burada,
   gerekçe zorunlu
7. Kabul → Kapı A → (kurucu hattıysa Kapı B) → `joined`, rol `filled`

⚠️ **Ret durumu asılı bırakılmaz.** Proje sahibi reddettiğinde, o role bağlı
başka `pending` sunulmuş aday kalmadıysa rol otomatik olarak `sourcing`'e
döner ve `hub_role_log`'a *"aday reddedildi, arama sürüyor"* kaydı düşer.
Aksi halde rol `shortlist`'te asılı kalır, recruiter'ın "aday bekleyen roller"
bloğuna düşmez ve kimse aramaya devam etmesi gerektiğini görmez — rol sessizce
ölür. Reddedilen aday hatta kalır; recruiter onu arşivleyebilir ya da başka
bir role sunabilir.

> **İlke:** ortak çalışma, aynı işi iki kişinin yapması demek değil. Her adımda
> tek bir kişi beklenir ve kimin sırası olduğu ekranda görünür.

### 12.4 Rolden arama — hat ihtiyaçtan başlar

Rol, hattın **sonunda bir etiket değil, başlangıcı**dır.

- Rolün `skills[]` alanı **GitHub taramasını besler** — dil ve anahtar
  kelimeler elle girilmez, rolden gelir. Rol kartında `Bu rol için tara` butonu.
- Rolün `profile` metni, mesaj taslağındaki kişiselleştirme bağlamını besler.
- **Aday-rol eşleştirme önerisi:** havuzdaki adaylar `role_type` ve beceri
  örtüşmesine göre açık rollerle eşleştirilir; aday kartında ve rol kartında
  *"bu aday şu role uygun"* önerisi görünür. Öneri atama değildir; insan atar.

### 12.5 Ekranlar

**`roles.jsx` — Açık Roller** (yeni sayfa, sidebar'da)
- Proje bazında gruplu liste, durum rozetleriyle
- Rol oluşturma/düzenleme: proje, başlık, rol tipi, **hat** (kurucu/üye),
  aranan profil, beceriler, haftalık saat, süre, ilk teslimat, ekip büyüklüğü,
  `needs_communication`, aciliyet
- Rol kartında: bağlı adaylar, huni durumu, `Bu rol için tara`, `Üstlen`,
  `Aday sun`, `Kapat`
- Kaç gündür açık olduğu görünür

**Bugün ekranına yeni bloklar** (role göre):
- *Recruiter:* `Yeni rol talepleri` · `Aday bekleyen roller` (N gündür açık,
  hiç aday yok)
- *Proje sahibi:* `Sana sunulan adaylar` (karar bekliyor) · `Açık rollerin`

**Aday kartına eklenecekler:**
- `track` seçimi (kurucu / üye) — eşik göstergesi buna göre hesaplanır
- Bağlı olduğu açık rol ve `Proje sahibine sun` butonu
- Sunulduysa: proje sahibinin kararı ve gerekçesi

### 12.6 Migration — `supabase/migrations/0005_hub_roles.sql`

```sql
-- Açık roller: talep akışı ve arama girdileri
alter table hub_open_roles
  add column if not exists status text not null default 'draft'
      check (status in ('draft','requested','sourcing','shortlist',
                        'filled','paused','cancelled')),
  add column if not exists track text not null default 'member'
      check (track in ('founder','member')),
  add column if not exists needs_communication boolean not null default false,
  add column if not exists weekly_hours      int,
  add column if not exists duration_months   int,
  add column if not exists first_deliverable text,
  add column if not exists team_size         int,
  add column if not exists requested_by uuid references hub_members(id),
  add column if not exists assigned_to uuid references hub_members(id),
  add column if not exists requested_at timestamptz,
  add column if not exists accepted_at  timestamptz,
  add column if not exists filled_at    timestamptz;

create index if not exists hub_role_status_idx on hub_open_roles(status);
create index if not exists hub_role_assigned_idx on hub_open_roles(assigned_to);

-- Adaylar: hat ve proje sahibi kararı
alter table hub_candidates
  add column if not exists track text not null default 'founder'
      check (track in ('founder','member')),
  add column if not exists presented_at timestamptz,
  add column if not exists owner_decision text
      check (owner_decision in ('pending','accepted','rejected')),
  add column if not exists owner_decision_note text;

create index if not exists hub_cand_presented_idx
  on hub_candidates(presented_at) where presented_at is not null;

-- Rol durum günlüğü (kim ne zaman ilerletti)
create table if not exists hub_role_log (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references hub_open_roles(id) on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  actor_id    uuid references hub_members(id),
  created_at  timestamptz not null default now()
);

alter table hub_role_log enable row level security;
create policy hub_rolelog_all on hub_role_log for all
  using (is_hub_member()) with check (is_hub_member());
```

### 12.7 Yetki

- **cofounder** — her şey
- **recruiter** — tüm roller; `üstlen`, ara, sun. **Kabul/ret veremez.**
- **project_owner** — yalnızca kendi projesinin rolleri ve sunulan adayları;
  rol açar, talep gönderir, **kabul/ret verir**

`hub_cand_read` politikası `presented_at`'i de dikkate alır: proje sahibi
kendisine **sunulmuş** adayı görebilir, havuzun tamamını göremez.

---

## 13. Yapılırken unutulmayacaklar

- **KVKK** — aday kaydında `kvkk_consent`, `kvkk_at`, `retain_until` alanları ilk sürümde dolu tutulur. Silme talebini karşılayacak bir "adayı tamamen sil" aksiyonu Ayarlar'da bulunur.
- **Arşiv sebebi zorunlu** — sebepsiz arşivleme UI'da engellenir.
- **Sonraki aksiyon zorunlu** — bir aday `pool` dışındaki bir aşamadaysa `next_action` boş bırakılamaz.
- **Sorumlu zorunlu** — sahipsiz aday takip edilmez.
- **Sabit değer listeleri serbest metin değildir** — `source`, `stage`, `archive_reason`, `role_type`, `data_trust` hep `check` kısıtlı.
- **Sistem inşa edilirken outbound durmaz** — adaylar bir tabloda toplanır, Adım 12 hazır olunca CSV ile aktarılır.
