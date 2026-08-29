-- ══════════════════════════════════════════════════════════
-- 0006_hub_cand_rls.sql — proje sahibi yalnızca SUNULMUŞ adayı görür (§12.7)
-- 0005 çalıştırıldıktan sonra eklenir.
-- ══════════════════════════════════════════════════════════

-- Okuma: cofounder/recruiter tüm havuz; project_owner yalnızca kendi
-- projesine SUNULMUŞ adayı (havuzun tamamını DEĞİL).
drop policy if exists hub_cand_read on hub_candidates;
create policy hub_cand_read on hub_candidates for select using (
  hub_role() in ('cofounder','recruiter')
  or (hub_role() = 'project_owner'
      and presented_at is not null
      and startup_id is not null
      and startup_id = any (hub_my_startups()))
);

-- Yazma: cofounder/recruiter her şey; project_owner yalnızca kendi projesine
-- sunulmuş adayda (owner_decision / gerekçe yazabilmesi için).
drop policy if exists hub_cand_write on hub_candidates;
create policy hub_cand_write on hub_candidates for all
  using (
    hub_role() in ('cofounder','recruiter')
    or (hub_role() = 'project_owner'
        and presented_at is not null
        and startup_id = any (hub_my_startups()))
  )
  with check (
    hub_role() in ('cofounder','recruiter')
    or (hub_role() = 'project_owner'
        and startup_id = any (hub_my_startups()))
  );
