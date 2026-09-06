-- ══════════════════════════════════════════════════════════
-- 0016_hub_person_id.sql — "Ekibe al" köprüsü (PROMPT_V3 C4)
-- ══════════════════════════════════════════════════════════
-- hub_candidates.person_id: aday ekibe alınınca oluşturulan people kaydının
-- id'si buraya yazılır (Team roster referansı). people.id TEXT olduğu için
-- kolon da text; FK kurulmaz (people admin tarafının tablosu). Idempotent.

alter table hub_candidates
  add column if not exists person_id text;

comment on column hub_candidates.person_id is
  'C4: ekibe alınınca oluşturulan people.id (text). Takım üyeliği people '
  '(type=project_member, project_id=startup) + startups.member_ids üzerinden.';
