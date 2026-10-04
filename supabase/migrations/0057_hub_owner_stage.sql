-- ══════════════════════════════════════════════════════════
-- 0057_hub_owner_stage.sql — üye hattı yeni akış sırası (Adım 4/5)
-- ══════════════════════════════════════════════════════════
-- Kullanıcı kararı (2026-10-04): üye hattında sıra artık belgedeki gibi
--   görüşme (HR) → proje sahibine sun → kurucu: kabul / ret / kendim görüşeyim
--   → kabulde Kapı A'yı KURUCU şablondan atar → kurucu değerlendirir
--   → "Ekibe Al" (kurucu, çift onay).
-- Kurucu (Team Lead) hattı değişmez — baştan sona HR'da.
--
-- owner_decision ('pending'|'accepted'|'rejected') OLDUĞU GİBİ kalır:
-- roleStatusAfterReject "başka pending sunum var mı" diye ona bakıyor.
-- Ayrıntılı süreç durumu ayrı kolonda (geriye dönük uyumlu, nullable):
--   presented   — sunuldu, kurucu henüz bakmadı          (owner_decision=pending)
--   interview   — kurucu "kendim görüşeyim" dedi          (owner_decision=pending)
--   gate        — kurucu kabul etti, Kapı A görevi gitti  (owner_decision=accepted, stage=trial)
--   gate_passed — kurucu Kapı A'yı yeterli buldu          (stage=trial)
--   joined      — kurucu "Ekibe Al" dedi                  (stage=member)
--   rejected    — kurucu reddetti (sunumda ya da Kapı A'da) (owner_decision=rejected)
--   withdrawn   — HR (cofounder) tıkanan sunumu geri çekti
alter table hub_candidates
  add column if not exists owner_stage text
    check (owner_stage in ('presented','interview','gate','gate_passed','joined','rejected','withdrawn')),
  -- Bölüm H: recruiter sunarken bir Kapı A şablonu ÖNERİR, kurucu değiştirebilir.
  add column if not exists suggested_gate_template_id uuid
    references hub_gate_templates(id) on delete set null;

-- Mevcut sunulmuş kayıtları yeni kolona yansıt (yalnızca bilgi amaçlı).
update hub_candidates set owner_stage = case
    when stage = 'member' then 'joined'
    when owner_decision = 'rejected' then 'rejected'
    when owner_decision = 'accepted' then 'joined'
    else 'presented' end
  where presented_at is not null and owner_stage is null;
