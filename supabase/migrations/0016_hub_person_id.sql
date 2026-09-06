-- ══════════════════════════════════════════════════════════
-- 0016_hub_person_id.sql — "Ekibe al" köprüsü (PROMPT_V3 C4)
-- ══════════════════════════════════════════════════════════
-- hub_candidates.person_id: aday ekibe alınınca oluşturulan people kaydının
-- id'si buraya yazılır (Team roster referansı). people.id identity'siz bigint
-- olduğu için FK kurulmaz; sadece referans kolon. Idempotent.

alter table hub_candidates
  add column if not exists person_id bigint;

comment on column hub_candidates.person_id is
  'C4: ekibe alınınca oluşturulan people.id. /team/ paneli app_state tabanlı '
  'olduğu için oradaki oturum modeline dokunulmaz — bu yalnızca roster referansı.';
