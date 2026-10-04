-- ══════════════════════════════════════════════════════════
-- 0053_hub_gate_templates.sql — Kapı A görev şablonları (Adım 2/5)
-- ══════════════════════════════════════════════════════════
-- Kaynak: StartHub_Aday_Bulma_Senaryosu.md Bölüm H ("Tavsiye Kapı A
-- Görevleri"). Belgedeki `kapi_a_sablonlari` tablosu, proje kuralına
-- (hub_ öneki, İngilizce tanımlayıcı) uygun adla: hub_gate_templates.
--   kategori    → category      (hub_candidates.interest anahtarları + 'founder')
--   baslik      → title
--   aciklama    → description
--   sure        → duration_hours (varsayılan 72)
--   teslim_turu → delivery_type  ('link' | 'file' | 'recording')
--
-- Kapı A'yı atayan seçer, yazmaz: HR'da (kurucu hattı + şimdilik üye hattı)
-- GateStartForm, Adım 4'ten sonra Team App'te kurucu aynı tablodan seçer.
-- hub_gates.template_id hangi şablonun kullanıldığını kaydeder (metin
-- yine task_text'e kopyalanır — şablon sonradan değişse de adaya giden
-- görev kaydı değişmez).
--
-- Yetki: mevcut 'templates.read' / 'templates.manage' anahtarları (mesaj
-- şablonlarıyla aynı kapsam — recruiter okur, cofounder düzenler).

create table hub_gate_templates (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in
                    ('frontend','backend','mobile','data','design','product',
                     'marketing','business','content','other','founder')),
  title           text not null,
  description     text not null,
  duration_hours  int  not null default 72 check (duration_hours between 24 and 336),
  delivery_type   text not null default 'link' check (delivery_type in ('link','file','recording')),
  sort_order      int  not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index hub_gate_templates_cat_idx on hub_gate_templates(category, sort_order) where active;

alter table hub_gates
  add column if not exists template_id uuid references hub_gate_templates(id) on delete set null;

alter table hub_gate_templates enable row level security;
create policy hub_gtpl_read  on hub_gate_templates for select using (has_perm('templates.read'));
create policy hub_gtpl_write on hub_gate_templates for all
  using (has_perm('templates.manage')) with check (has_perm('templates.manage'));

-- ── Başlangıç şablonları ─────────────────────────────────────────────
-- Belgedeki örneklerden (Bölüm A/B/H) türetilmiş, düzenlenebilir taslaklar.
-- Gerçek görevler projeye özel olmalı — HR › Şablonlar'dan değiştirilir.
insert into hub_gate_templates (category, title, description, delivery_type, sort_order) values
  ('mobile',   'Tek ekranlı prototip',
   'Projenin bir ekranının (ör. giriş ya da ana liste) taslak arayüzünü React Native / Flutter ile kur. Gerçek veri gerekmez, sahte veri yeterli. Teslim: çalışan kodun GitHub bağlantısı + 1 ekran görüntüsü.', 'link', 1),
  ('frontend', 'Tek sayfalık arayüz',
   'Projenin bir sayfasını (ör. kayıt formu ya da liste ekranı) web üzerinde kur — mobil uyumlu olsun. Teslim: GitHub bağlantısı + varsa canlı önizleme adresi.', 'link', 1),
  ('backend',  'Tek uç noktalı API',
   'Projenin bir veri ihtiyacı için (ör. kullanıcı kaydı ya da liste getirme) tek bir API uç noktası ve basit veri modelini yaz; nasıl çalıştırılacağını README''de anlat. Teslim: GitHub bağlantısı.', 'link', 1),
  ('data',     'Küçük veri analizi',
   'Verilen (ya da açık) bir veri setinde projeyle ilgili bir soruyu yanıtla: veriyi temizle, 2-3 bulguyu grafikle göster. Teslim: notebook ya da rapor bağlantısı.', 'link', 1),
  ('design',   'Kullanıcı akışı wireframe''i',
   'Projenin bir ana kullanıcı akışını (ör. ilk kayıt → ilk kullanım) 3-5 ekranlık wireframe olarak çiz. Teslim: Figma (ya da benzeri) bağlantısı.', 'link', 1),
  ('product',  'Tek özellik için kısa PRD',
   'Projenin sıradaki bir özelliği için 1 sayfalık ürün dokümanı yaz: problem, hedef kullanıcı, başarı ölçütü, kapsam dışı olanlar. Teslim: doküman bağlantısı.', 'file', 1),
  ('marketing','İlk 100 kullanıcı planı',
   'Projenin ilk 100 kullanıcısına nasıl ulaşılacağını 1 sayfada planla: hangi kanal, hangi mesaj, ilk hafta ne yapılır. Teslim: doküman bağlantısı.', 'file', 1),
  ('business', 'Rakip / pazar taraması',
   'Projeye en yakın 5 rakibi ya da alternatifi çıkar; her biri için fiyat, hedef kitle ve projenin farkını tablo halinde yaz. Teslim: tablo ya da doküman bağlantısı.', 'file', 1),
  ('content',  'Tanıtım yazısı taslağı',
   'Projeyi hiç bilmeyen birine anlatan 400-600 kelimelik bir tanıtım yazısı taslağı yaz. Teslim: doküman bağlantısı.', 'file', 1),
  ('other',    'Projeye özel küçük görev',
   'Rolle ilgili, 72 saatte bitirilebilecek tek çıktılı bir görev. Açıklamayı atamadan önce projeye göre düzenle.', 'link', 1),
  ('founder',  'Yeniden başlatma planı',
   'Projenin mevcut MVP dokümanını ve durumunu incele; 3 sayfalık bir yeniden başlatma planı yaz: ilk 30 günde ne yapılır, ekip nasıl kurulur, hangi varsayım önce test edilir. Teslim: doküman bağlantısı.', 'file', 1);
