// hub-mappers.js — DB (snake_case) ↔ JS (camelCase) dönüşümleri.
//
// `src/admin/admin-store.jsx`'teki mapXToDb / mapXFromDb desenini izler.
// Fark (HUB_SPEC §4.6.1): tüm hub tabloları `uuid default gen_random_uuid()`
// kullanır — toDb ASLA `id` göndermez. `nextId` hack'i yok.
//
// Kural: `*ToDb` yalnızca YAZILABİLİR kolonları üretir. Sunucunun ürettiği
// alanlar (id, *_at default'ları, hub_candidates.score_total generated kolonu)
// gönderilmez; `*FromDb` bunları okur. Böylece toDb→fromDb bir nesneyi
// yazılabilir alanları itibarıyla kayıpsız geri verir.

// undefined anahtarlar JSON.stringify ile düşer → DB default'u devreye girer.
// NOT NULL + default'lu kolonlarda (sent_at, started_at, outcome, result …)
// değer yoksa `undefined` bırakılır, `null` değil.
const orUndef = (v) => (v === undefined || v === null ? undefined : v);

// ══ hub_candidates ═════════════════════════════════════════════════════
export function mapCandidateToDb(c) {
  return {
    // kimlik
    full_name: c.fullName || '',
    email:     c.email    ?? null,
    linkedin:  c.linkedin ?? null,
    github:    c.github   ?? null,
    phone:     c.phone    ?? null,
    city:      c.city     ?? null,
    // eğitim
    university:  c.university ?? null,
    department:  c.department ?? null,
    class_year:  c.classYear  ?? null,
    grad_year:   c.gradYear   ?? null,
    edu_status:  c.eduStatus  || 'unknown',
    data_trust:  c.dataTrust  || 'guess',
    // yetkinlik
    role_type:    c.roleType    ?? null,
    skills:       c.skills      || [],
    languages:    c.languages   || [],
    weekly_hours: c.weeklyHours ?? null,
    // kaynak
    source:        c.source       || 'other',
    source_detail: c.sourceDetail ?? null,
    source_ref:    c.sourceRef    ?? null,
    batch_id:      c.batchId      ?? null,
    evidence:      c.evidence     || [],
    why_this_one:  c.whyThisOne   ?? null,
    // zenginleştirme
    enrichment:  c.enrichment  || {},
    enriched_at: c.enrichedAt  ?? null,
    // süreç
    stage:            c.stage          || 'pool',
    // Bayatlama sayacının referansı (§9). Değer yoksa DB default'u (now())
    // devrede kalsın diye gönderilmez; aşama değişiminde store now() yazar.
    stage_changed_at: orUndef(c.stageChangedAt),
    joined_at:          c.joinedAt         ?? null,
    vesting_start_date: c.vestingStartDate ?? null,
    archive_reason:   c.archiveReason  ?? null,
    owner_id:       c.ownerId       ?? null,
    open_role_id:   c.openRoleId    ?? null,
    startup_id:     c.startupId     ?? null,
    // §12 — hat ve proje sahibi kararı
    track:               c.track             || 'founder',
    presented_at:        c.presentedAt       ?? null,
    owner_decision:      c.ownerDecision     ?? null,
    owner_decision_note: c.ownerDecisionNote ?? null,
    // puanlama (score_total generated — gönderilmez)
    score_finishing:     c.scoreFinishing     ?? null,
    score_communication: c.scoreCommunication ?? null,
    score_capacity:      c.scoreCapacity      ?? null,
    ai_score:            c.aiScore            ?? null,
    ai_score_note:       c.aiScoreNote        ?? null,
    // bayraklar
    red_flags:       c.redFlags       || [],
    flag_notes:      c.flagNotes      || {},
    override_reason: c.overrideReason ?? null,
    // takip
    tags:             c.tags           || [],
    last_contact_at:  c.lastContactAt  ?? null,
    next_action:      c.nextAction     ?? null,
    next_action_at:   c.nextActionAt   ?? null,
    next_action_link: c.nextActionLink ?? null,
    // kvkk — retain_until'ın DB default'u (current_date + 1 yıl) devreye
    // girsin diye değer yoksa gönderilmez (§12).
    kvkk_consent: c.kvkkConsent ?? false,
    kvkk_at:      c.kvkkAt      ?? null,
    retain_until: orUndef(c.retainUntil),
    // sahiplik
    created_by: c.createdBy ?? null,
  };
}

export function mapCandidateFromDb(r) {
  return {
    id: r.id,
    // kimlik
    fullName: r.full_name || '',
    email:    r.email     ?? null,
    linkedin: r.linkedin  ?? null,
    github:   r.github    ?? null,
    phone:    r.phone     ?? null,
    city:     r.city      ?? null,
    // eğitim
    university: r.university ?? null,
    department: r.department ?? null,
    classYear:  r.class_year ?? null,
    gradYear:   r.grad_year  ?? null,
    eduStatus:  r.edu_status || 'unknown',
    dataTrust:  r.data_trust || 'guess',
    // yetkinlik
    roleType:    r.role_type    ?? null,
    skills:      r.skills       || [],
    languages:   r.languages    || [],
    weeklyHours: r.weekly_hours ?? null,
    // kaynak
    source:       r.source        || 'other',
    sourceDetail: r.source_detail ?? null,
    sourceRef:    r.source_ref    ?? null,
    batchId:      r.batch_id      ?? null,
    evidence:     r.evidence      || [],
    whyThisOne:   r.why_this_one  ?? null,
    // zenginleştirme
    enrichment: r.enrichment  || {},
    enrichedAt: r.enriched_at ?? null,
    // süreç
    stage:            r.stage              || 'pool',
    stageChangedAt:   r.stage_changed_at   ?? null,
    joinedAt:         r.joined_at          ?? null,
    vestingStartDate: r.vesting_start_date ?? null,
    archiveReason:    r.archive_reason     ?? null,
    ownerId:       r.owner_id       ?? null,
    openRoleId:    r.open_role_id   ?? null,
    startupId:     r.startup_id     ?? null,
    // §12
    track:             r.track               || 'founder',
    presentedAt:       r.presented_at        ?? null,
    ownerDecision:     r.owner_decision      ?? null,
    ownerDecisionNote: r.owner_decision_note ?? null,
    // puanlama
    scoreFinishing:     r.score_finishing     ?? null,
    scoreCommunication: r.score_communication ?? null,
    scoreCapacity:      r.score_capacity      ?? null,
    scoreTotal:         r.score_total         ?? 0,   // generated
    aiScore:            r.ai_score            ?? null,
    aiScoreNote:        r.ai_score_note       ?? null,
    // bayraklar
    redFlags:       r.red_flags       || [],
    flagNotes:      r.flag_notes      || {},
    overrideReason: r.override_reason ?? null,
    // takip
    tags:           r.tags             || [],
    lastContactAt:  r.last_contact_at  ?? null,
    nextAction:     r.next_action      ?? null,
    nextActionAt:   r.next_action_at   ?? null,
    nextActionLink: r.next_action_link ?? null,
    // kvkk
    kvkkConsent: r.kvkk_consent ?? false,
    kvkkAt:      r.kvkk_at      ?? null,
    retainUntil: r.retain_until ?? null,
    // sahiplik / zaman
    createdBy: r.created_by ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

// ══ hub_members ════════════════════════════════════════════════════════
export function mapMemberToDb(m) {
  return {
    email:       (m.email || '').toLowerCase(),
    full_name:   m.fullName ?? null,
    role:        m.role || 'recruiter',
    startup_ids: m.startupIds || [],
    active:      m.active ?? true,
  };
}
export function mapMemberFromDb(r) {
  return {
    id:         r.id,
    userId:     r.user_id ?? null,
    email:      r.email || '',
    fullName:   r.full_name ?? null,
    role:       r.role || 'recruiter',
    startupIds: r.startup_ids || [],
    active:     r.active ?? true,
    createdAt:  r.created_at ?? null,
  };
}

// ══ hub_open_roles ═════════════════════════════════════════════════════
export function mapOpenRoleToDb(o) {
  return {
    startup_id: o.startupId ?? null,
    title:      o.title || '',
    role_type:  o.roleType ?? null,
    profile:    o.profile ?? null,
    skills:     o.skills || [],
    urgency:    o.urgency || 'normal',
    filled:     o.filled ?? false,
    // §12 — talep akışı ve iki hat
    status:              o.status || 'draft',
    track:               o.track || 'member',
    needs_communication: o.needsCommunication ?? false,
    weekly_hours:        o.weeklyHours ?? null,
    duration_months:     o.durationMonths ?? null,
    first_deliverable:   o.firstDeliverable ?? null,
    team_size:           o.teamSize ?? null,
    requested_by:        o.requestedBy ?? null,
    assigned_to:         o.assignedTo ?? null,
    requested_at:        o.requestedAt ?? null,
    accepted_at:         o.acceptedAt ?? null,
    filled_at:           o.filledAt ?? null,
  };
}
export function mapOpenRoleFromDb(r) {
  return {
    id:        r.id,
    startupId: r.startup_id ?? null,
    title:     r.title || '',
    roleType:  r.role_type ?? null,
    profile:   r.profile ?? null,
    skills:    r.skills || [],
    urgency:   r.urgency || 'normal',
    filled:    r.filled ?? false,
    status:              r.status || 'draft',
    track:               r.track || 'member',
    needsCommunication:  r.needs_communication ?? false,
    weeklyHours:         r.weekly_hours ?? null,
    durationMonths:      r.duration_months ?? null,
    firstDeliverable:    r.first_deliverable ?? null,
    teamSize:            r.team_size ?? null,
    requestedBy:         r.requested_by ?? null,
    assignedTo:          r.assigned_to ?? null,
    requestedAt:         r.requested_at ?? null,
    acceptedAt:          r.accepted_at ?? null,
    filledAt:            r.filled_at ?? null,
    createdAt: r.created_at ?? null,
  };
}

// ══ hub_role_log (§12.6) ══════════════════════════════════════════════
export function mapRoleLogToDb(l) {
  return {
    role_id:     l.roleId,
    from_status: l.fromStatus ?? null,
    to_status:   l.toStatus || '',
    note:        l.note ?? null,
    actor_id:    l.actorId ?? null,
  };
}
export function mapRoleLogFromDb(r) {
  return {
    id:         r.id,
    roleId:     r.role_id,
    fromStatus: r.from_status ?? null,
    toStatus:   r.to_status || '',
    note:       r.note ?? null,
    actorId:    r.actor_id ?? null,
    createdAt:  r.created_at ?? null,
  };
}

// ══ hub_stage_log ═════════════════════════════════════════════════════
export function mapStageLogToDb(l) {
  return {
    candidate_id: l.candidateId,
    from_stage:   l.fromStage ?? null,
    to_stage:     l.toStage || '',
    reason:       l.reason ?? null,
    actor_id:     l.actorId ?? null,
  };
}
export function mapStageLogFromDb(r) {
  return {
    id:          r.id,
    candidateId: r.candidate_id,
    fromStage:   r.from_stage ?? null,
    toStage:     r.to_stage || '',
    reason:      r.reason ?? null,
    actorId:     r.actor_id ?? null,
    createdAt:   r.created_at ?? null,
  };
}

// ══ hub_touches ═══════════════════════════════════════════════════════
export function mapTouchToDb(t) {
  return {
    candidate_id: t.candidateId,
    channel:      t.channel || 'other',
    template_id:  t.templateId ?? null,
    variant:      t.variant ?? null,
    sender_id:    t.senderId ?? null,
    sent_at:      orUndef(t.sentAt),
    outcome:      orUndef(t.outcome),
    follow_up_at: t.followUpAt ?? null,
    note:         t.note ?? null,
  };
}
export function mapTouchFromDb(r) {
  return {
    id:          r.id,
    candidateId: r.candidate_id,
    channel:     r.channel || 'other',
    templateId:  r.template_id ?? null,
    variant:     r.variant ?? null,
    senderId:    r.sender_id ?? null,
    sentAt:      r.sent_at ?? null,
    outcome:     r.outcome || 'pending',
    followUpAt:  r.follow_up_at ?? null,
    note:        r.note ?? null,
  };
}

// ══ hub_interviews ════════════════════════════════════════════════════
export function mapInterviewToDb(i) {
  return {
    candidate_id:   i.candidateId,
    held_at:        orUndef(i.heldAt),
    interviewer_id: i.interviewerId ?? null,
    answers:        i.answers || {},
    flags:          i.flags || [],
    decision:       i.decision ?? null,
    note:           i.note ?? null,
  };
}
export function mapInterviewFromDb(r) {
  return {
    id:            r.id,
    candidateId:   r.candidate_id,
    heldAt:        r.held_at ?? null,
    interviewerId: r.interviewer_id ?? null,
    answers:       r.answers || {},
    flags:         r.flags || [],
    decision:      r.decision ?? null,
    note:          r.note ?? null,
  };
}

// ══ hub_gates ═════════════════════════════════════════════════════════
export function mapGateToDb(g) {
  return {
    candidate_id: g.candidateId,
    gate:         g.gate,                 // 'A' | 'B'
    startup_id:   g.startupId ?? null,
    person_id:    g.personId ?? null,
    task_text:    g.taskText ?? null,
    started_at:   orUndef(g.startedAt),
    due_at:       g.dueAt,                // NOT NULL, default yok
    delivered:    g.delivered ?? null,
    evaluation:   g.evaluation ?? null,
    result:       orUndef(g.result),
  };
}
export function mapGateFromDb(r) {
  return {
    id:          r.id,
    candidateId: r.candidate_id,
    gate:        r.gate,
    startupId:   r.startup_id ?? null,
    personId:    r.person_id ?? null,
    taskText:    r.task_text ?? null,
    startedAt:   r.started_at ?? null,
    dueAt:       r.due_at ?? null,
    delivered:   r.delivered ?? null,
    evaluation:  r.evaluation ?? null,
    result:      r.result || 'pending',
  };
}

// ══ hub_templates ═════════════════════════════════════════════════════
export function mapTemplateToDb(t) {
  return {
    name:        t.name || '',
    source_type: t.sourceType ?? null,
    variant:     t.variant || 'A',
    subject:     t.subject ?? null,
    body:        t.body || '',
    variables:   t.variables || [],
    sent_count:  t.sentCount ?? 0,
    reply_count: t.replyCount ?? 0,
    active:      t.active ?? true,
  };
}
export function mapTemplateFromDb(r) {
  return {
    id:         r.id,
    name:       r.name || '',
    sourceType: r.source_type ?? null,
    variant:    r.variant || 'A',
    subject:    r.subject ?? null,
    body:       r.body || '',
    variables:  r.variables || [],
    sentCount:  r.sent_count ?? 0,
    replyCount: r.reply_count ?? 0,
    active:     r.active ?? true,
    createdAt:  r.created_at ?? null,
  };
}

// ══ hub_views ═════════════════════════════════════════════════════════
export function mapViewToDb(v) {
  return {
    name:     v.name || '',
    owner_id: v.ownerId ?? null,
    filters:  v.filters || {},
    columns:  v.columns || [],
    sort:     v.sort || {},
    shared:   v.shared ?? true,
  };
}
export function mapViewFromDb(r) {
  return {
    id:        r.id,
    name:      r.name || '',
    ownerId:   r.owner_id ?? null,
    filters:   r.filters || {},
    columns:   r.columns || [],
    sort:      r.sort || {},
    shared:    r.shared ?? true,
    createdAt: r.created_at ?? null,
  };
}

// ══ hub_source_registry ══════════════════════════════════════════════
export function mapSourceToDb(s) {
  return {
    name:         s.name || '',
    url:          s.url ?? null,
    source:       s.source || 'other',
    note:         s.note ?? null,
    check_every:  orUndef(s.checkEvery),   // interval, default '7 days'
    last_checked: s.lastChecked ?? null,
    owner_id:     s.ownerId ?? null,
    status:       s.status || 'active',
  };
}
export function mapSourceFromDb(r) {
  return {
    id:          r.id,
    name:        r.name || '',
    url:         r.url ?? null,
    source:      r.source || 'other',
    note:        r.note ?? null,
    checkEvery:  r.check_every ?? null,
    lastChecked: r.last_checked ?? null,
    ownerId:     r.owner_id ?? null,
    status:      r.status || 'active',
    createdAt:   r.created_at ?? null,
  };
}

// ══ hub_import_batches ═══════════════════════════════════════════════
export function mapBatchToDb(b) {
  return {
    method:         b.method,             // 'paste' | 'csv' | 'github' | 'inbound'
    source:         b.source || 'other',
    source_detail:  b.sourceDetail ?? null,
    event_date:     b.eventDate ?? null,
    raw_text:       b.rawText ?? null,
    parsed_count:   b.parsedCount ?? 0,
    accepted_count: b.acceptedCount ?? 0,
    created_by:     b.createdBy ?? null,
  };
}
export function mapBatchFromDb(r) {
  return {
    id:            r.id,
    method:        r.method,
    source:        r.source || 'other',
    sourceDetail:  r.source_detail ?? null,
    eventDate:     r.event_date ?? null,
    rawText:       r.raw_text ?? null,
    parsedCount:   r.parsed_count ?? 0,
    acceptedCount: r.accepted_count ?? 0,
    createdBy:     r.created_by ?? null,
    createdAt:     r.created_at ?? null,
  };
}

// ══ Tablo kaydı — store bu haritayı kullanır (admin DB_TABLE deseni) ══
export const HUB_TABLES = {
  candidates: { table: 'hub_candidates',      toDb: mapCandidateToDb, fromDb: mapCandidateFromDb },
  members:    { table: 'hub_members',         toDb: mapMemberToDb,    fromDb: mapMemberFromDb    },
  openRoles:  { table: 'hub_open_roles',      toDb: mapOpenRoleToDb,  fromDb: mapOpenRoleFromDb  },
  roleLog:    { table: 'hub_role_log',        toDb: mapRoleLogToDb,   fromDb: mapRoleLogFromDb   },
  stageLog:   { table: 'hub_stage_log',       toDb: mapStageLogToDb,  fromDb: mapStageLogFromDb  },
  touches:    { table: 'hub_touches',         toDb: mapTouchToDb,     fromDb: mapTouchFromDb     },
  interviews: { table: 'hub_interviews',      toDb: mapInterviewToDb, fromDb: mapInterviewFromDb },
  gates:      { table: 'hub_gates',           toDb: mapGateToDb,      fromDb: mapGateFromDb      },
  templates:  { table: 'hub_templates',       toDb: mapTemplateToDb,  fromDb: mapTemplateFromDb  },
  views:      { table: 'hub_views',           toDb: mapViewToDb,      fromDb: mapViewFromDb      },
  sources:    { table: 'hub_source_registry', toDb: mapSourceToDb,    fromDb: mapSourceFromDb    },
  batches:    { table: 'hub_import_batches',  toDb: mapBatchToDb,     fromDb: mapBatchFromDb     },
};
