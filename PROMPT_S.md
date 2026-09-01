# Prompt S — Hub sadeleştirmesi

> `HUB_PROMPTS.md`'deki Prompt D'nin yerini alır. Prompt D (roller/§12 genişletmesi) donduruldu, bkz. `HUB_SPEC_v2.md` §10.
> Bu prompt tek başına, sırayla uygulanır. Her adımdan sonra `npm test` (hub-rules.test.mjs) yeşil kalmalı.
> Kaynak: `HUB_SPEC_v2.md`. Çelişki olursa o dosya kazanır, bu prompt değil.

## Ön koşul

`main`'den `hub-simplify-v2` dalı aç. Silinmeyecek, sadece kullanılmayacak dosyalar (`hub-parse.js`, `hub-github.js`, `hub-enrich.js`, `hub-match.js`, `sources.jsx`, `0005_hub_roles.sql`'in rol-matching kısmı) bu dalda commit'li kalır, `hub-app.jsx`'ten import edilmez — yeni bir `hub-deferred` dalına taşıma, sadece bağlantısını kes.

## Adım 1 — Şema

Yeni migration `0010_hub_simplify.sql`:
- `hub_candidates`: `draft_text text`, `import_batch_label text` ekle
- `hub_gates`: `extended_days int not null default 0` ekle
- `hub_candidates`: `tags`, `languages`, `phone`, `city` kolonlarını **düşürme** — veri kaybı riski var, sadece UI'dan gizle (§4). Gerçek drop, veri sıfır aday olduğu teyit edilip ayrı bir migration'da yapılır.
- `hub_views`, `hub_import_batches` tablolarını drop et (henüz kullanılmıyor, veri yok).
- `0004_hub_cron.sql`'i **deploy etme** — dosyayı sil değil, `supabase/migrations/_deferred/` altına taşı.
- `0005_hub_roles.sql`'i sadeleştirip çalıştır: `status` check constraint'ini `('draft','sourcing','shortlist','filled')` yap (`requested`, `paused`, `cancelled` çıkar). `requested_at`, `accepted_at`, `requested_by` kolonlarını **ekleme** — bu migration'ın o kısmını atla. `hub_role_log` tablosunu **oluşturma**. `track`, `needs_communication`, `presented_at`, `owner_decision`, `owner_decision_note` aynen kalır.
- `0009_permissions.sql`'e **dokunma** — `cofounder`/`recruiter`/`project_owner` preset'leri zaten doğru ayrımı yapıyor, değişiklik gerekmiyor.

Kabul: migration lokal Supabase'e temiz uygulanır, mevcut RLS politikaları bozulmaz.

## Adım 2 — Sabitler (`hub-constants.js`)

- `STAGES`: 8 → 5 + arşiv. Yeni sıra: `pool, contact, interview, trial, member, archived`. `contact` eski `contacted`+`replied`'ı kapsar. `trial` eski `finalist`+`gate_a`+`gate_b`'yi kapsar (alt-durum `hub_gates.gate` ile ayrılır, ayrı stage değeri değil).
- `SOURCES`: 14 → 6 (`referral, hackathon, github, incubator, inbound, other`), eski değerler `source_detail`'e serbest metin olarak taşınır.
- `RED_FLAGS`: 6 → 4 (`blame, no_terms, unrealistic, disrespect`).
- `NEXT_ACTIONS`: yeni sabit liste, 6 değer (§3).
- `CLASS_YEARS`, `EDU_STATUSES`, `DATA_TRUST`, `URGENCIES`, `INTERVIEW_DECISIONS` sabitlerini kaldır.
- `ROLE_STATUSES`: 7 → 4.

Kabul: `hub-rules.test.mjs` içindeki eski sabit adlarına referans veren testler güncellenip yeşil.

## Adım 3 — Kurallar (`hub-rules.js`)

- `canAdvance()`'in stage-sırası mantığı yeni 5 aşamalı listeye göre güncellenir, iş mantığı (sıra atlanamaz, arşiv sebebi zorunlu, bayrak kilidi) **değişmez**.
- `stageOrderFor()` ve `MEMBER_STAGE_ORDER` kaldırılır — track farkı artık sadece `trial` aşamasının içinde Kapı B'nin görünüp görünmemesiyle ifade edilir, ayrı sıra yok.
- Yeni: `gateDueAt(gate)` fonksiyonu — `base_due_at + extended_days` hesaplar.
- Yeni: `canDraftAI(candidate)` — `source_detail`, `why_this_one`, `evidence` alanlarının en az biri doluysa `true`, değilse `false` döner. UI bu false olduğunda "Veri yetersiz" uyarısını gösterir.

Kabul: mevcut test dosyasındaki `canAdvance` senaryoları (sıra atlama, arşiv, bayrak) hiç değişmeden geçer.

## Adım 4 — Navigasyon (`hub-app.jsx`)

Sol menü: `Bugün, Adaylar, Roller` + dişli. `board.jsx`, `table.jsx`, `import.jsx`, `sources.jsx` route'ları kaldırılır. `templates.jsx`, `metrics.jsx`, `members.jsx`/`settings.jsx` dişli altında birleşik bir alt-menüye taşınır.

## Adım 5 — Adaylar listesi (yeni `candidates-list.jsx`, `table.jsx`'in yerine)

7 sabit sütun, arama + 3 chip filtre (`.adm-chip`). Kayıtlı görünüm, sütun sürükleme, hücre içi düzenleme, CSV export, çoklu seçim **yazılmaz**. Satıra tıklama → `candidate.jsx` kartını açar.

## Adım 6 — Aday kartı (`candidate.jsx`)

Üç sekme kaldırılır. Aşamaya göre koşullu render (§3). Kapı kartı bileşeni (`GateCard`) yeni: görev metni, süre rozeti, Başlat, Teslim etti/etmedi, "Süre yetmedi mi?" → 3 chip (+1/+3/+7 gün) → `hub_gates.extended_days` günceller ve `hub_stage_log`'a otomatik not düşer (insan metni girmez).

`next_action` alanı serbest text-input'tan 6 seçenekli `<select>`/chip gruba döner.

Rubrik butonları: `AI_PRESCORE_FINISHING` tablosundaki cümleyi buton etiketi yapar (1-5 rakamı kaldırılır). Eşik göstergesi düz cümle döndürür (`thresholdText()` zaten bunu yapıyor, dokunma).

## Adım 7 — CSV/Excel içe aktarma (yeni `import-simple.jsx`, `import.jsx`'in yerine)

3 adımlı, senkron akış (§6). Kütüphane: SheetJS (xlsx) zaten paket listesinde varsa onu kullan, yoksa ekle. Kolon eşleme ekranı başlık tahmini yapar (basit string benzerliği, AI çağrısı gerekmez). Onaylanan satırlar tek bir `insert` ile `hub_candidates`'a yazılır, hepsine aynı `import_batch_label` atanır.

Kabul: 20 satırlık örnek CSV ile uçtan uca test — yükle, eşle, onayla, Adaylar listesinde görünür.

## Adım 8 — AI taslak (`hub-ai-draft.js`, yeni dosya)

Tekli: `candidate.jsx`'te "Taslak oluştur" butonu → `canDraftAI()` kontrolü → geçerse tek senkron çağrı → `draft_text` güncellenir.
Toplu: `import-simple.jsx` onay ekranında "Hepsine taslak oluştur" → içe aktarılan satırlar üzerinde sırayla (`for...await`, paralel değil) döner, ilerleme çubuğu gösterir. Ayrı worker/kuyruk **yazılmaz**.

Prompt bağlamı: adayın `full_name`, `source_detail`, `why_this_one`, `Link` alanları. Sistem promptu, kişiselleştirme cümlesinin tek satır ve şablon-hissi vermeyecek şekilde olmasını ister.

Kabul: `canDraftAI() === false` olan bir adayda buton "Veri yetersiz" mesajı gösterir, API çağrısı yapılmaz.

## Adım 9 — Mesajlaşma (`templates.jsx`)

Kanal listesi 4 → 3. A/B varyant alanı kaldırılır. Personalization textarea, `draft_text` doluysa onunla önceden doldurulur (insan hâlâ düzenleyebilir). Kopyalama kilidi (`canCopy`) mantığı değişmeden kalır.

## Adım 10 — Roller (`roles.jsx`)

Form 11 → 5 alan. `ROLE_STATUSES` güncellemesi Adım 2'den geliyor — `requested` yok, oluşturulan rol doğrudan `sourcing`'e düşer. "Talep gönder" / "Üstlen" butonları **yazılmaz**. `hub-match.js` importu kaldırılır, "önerilen adaylar" bölümü UI'dan çıkar.

Buton ve bölüm görünürlüğü mevcut `has_perm(key)` fonksiyonuyla kontrol edilir (§10.2): `decide` butonu yalnızca `has_perm('decide')` true ise görünür, `flags.override` benzer. Recruiter ve proje sahibi için ayrı bileşen/route **yazılmaz** — aynı `roles.jsx` ve Bugün ekranı, koşullu render.

Kabul: `hub_members.role = 'recruiter'` olan bir kullanıcı `Kabul/ret ver` butonunu görmez; `project_owner` görür ama yalnızca kendisine sunulan (`presented_at` dolu) adaylarda.

## Adım 11 — Metrikler (`metrics.jsx`)

3 karta iner (§11). Haftalık hedef sabitleri güncellenir (10/6).

## Adım 12 — Dokümantasyon

- `HUB_SPEC.md` → `HUB_SPEC_v2.md` içeriğiyle değiştirilir, eski dosya `HUB_SPEC_v1_archive.md` olarak saklanır.
- `HUB_PROMPTS.md`'de Prompt D'nin üzerine "donduruldu, bkz. HUB_SPEC_v2.md §10" notu düşülür, bu dosya (Prompt S) eklenir.
- `HUB_TEST.md`, aşama başına bir kabul testine indirilir (5 test).
- `CLAUDE.md`'deki dosya listesi güncellenir: kaldırılan route'lar, eklenen `import-simple.jsx`, `candidates-list.jsx`, `hub-ai-draft.js` listeye girer; `hub-parse.js` vb. "v1 dışı, bağlantısız" notuyla kalır.

## Bitmiş kabul listesi

- [ ] Sol menüde 3 madde
- [ ] `board.jsx` ve eski `table.jsx` route'ları erişilemez
- [ ] Aday kartı sekmesiz, aşamaya göre alan gösteriyor
- [ ] Kapı kartı süre uzatma chip'leri çalışıyor, `hub_stage_log`'a otomatik not düşüyor
- [ ] CSV/Excel içe aktarma uçtan uca çalışıyor
- [ ] AI taslak (tekli + toplu) çalışıyor, veri yetersizliğinde uyarı veriyor
- [ ] Kişiselleştirme satırı hâlâ zorunlu, kopyalama hâlâ kilitli
- [ ] `hub-rules.test.mjs` tamamı yeşil
- [ ] `0004_hub_cron.sql` deploy edilmemiş
- [ ] Yeni tablo yok (`hub_import_batches`, `hub_source_registry` yaratılmadı)
