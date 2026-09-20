// inbound-model.js — HR › Inbound: web formundan gelen başvurular (applications tablosu).
//
// Inbound, Outbound aday havuzundan (hub_candidates) AYRI bir hattır: her başvuru
// doğrudan bir CRM kaydıdır; aşama `applications.status` kolonunda tutulur.
// Saf mantık burada (test edilebilir); Supabase erişimi use-inbound.js'te.

// ─── Aşamalar ────────────────────────────────────────────────────────
// Eski değerler (new / reviewed / accepted / rejected) aynen geçerli.
export const INBOUND_STAGES = [
  { value: 'new',       label: 'Yeni',        color: '#2563EB', bg: '#EFF6FF', hint: 'Henüz kimse bakmadı' },
  { value: 'reviewed',  label: 'İnceleniyor', color: '#D97706', bg: '#FFFBEB', hint: 'Başvuru okundu, değerlendiriliyor' },
  { value: 'interview', label: 'Görüşme',     color: '#7C3AED', bg: '#F5F3FF', hint: 'Adayla görüşme yapılıyor / planlandı' },
  { value: 'waitlist',  label: 'Havuz',       color: '#0891B2', bg: '#ECFEFF', hint: 'Uygun ekip / proje çıkınca değerlendirilecek' },
  { value: 'accepted',  label: 'Kabul',       color: '#16A34A', bg: '#F0FDF4', hint: 'Topluluğa / ekibe / projeye alındı' },
  { value: 'rejected',  label: 'Red',         color: '#78716C', bg: '#F5F5F4', hint: 'Bu turda uygun değil' },
];
export const INBOUND_STAGE_MAP = Object.fromEntries(INBOUND_STAGES.map((s) => [s.value, s]));
export const ACTIVE_STAGES = ['new', 'reviewed', 'interview', 'waitlist'];

export const REJECT_REASONS = [
  'Uygun değil', 'Kontenjan dolu', 'Cevap vermedi', 'Yinelenen başvuru', 'Diğer',
];

// ─── Taraflar ────────────────────────────────────────────────────────
export const SIDES = {
  hub:   { label: 'Hub',   color: '#DC2626', bg: '#FEF2F2' },
  lab:   { label: 'Lab',   color: '#2563EB', bg: '#EFF6FF' },
  other: { label: 'Diğer', color: '#7C3AED', bg: '#F5F3FF' },
};

// ─── Başvuru türleri (applications.intent) ───────────────────────────
// Eski intent'ler ('hub', 'project', 'community') yeni formdakilerle uyumlu.
export const INBOUND_TYPES = [
  { value: 'community',           label: 'Topluluk',            side: 'hub',   icon: 'users' },
  { value: 'club_team',           label: 'Ekip Üyesi',          side: 'hub',   icon: 'megaphone' },
  { value: 'hub',                 label: 'Bölüm (eski)',        side: 'hub',   icon: 'layers' },
  { value: 'founder_lead',        label: 'Kurucu · Liderlik',   side: 'lab',   icon: 'rocket' },
  { value: 'idea_application',    label: 'Kurucu · Yeni Fikir', side: 'lab',   icon: 'lightbulb' },
  { value: 'project',             label: 'Proje Üyesi',         side: 'lab',   icon: 'briefcase' },
  { value: 'pool_match',          label: 'Eşleşme Havuzu',      side: 'lab',   icon: 'target' },
  { value: 'mentor_application',  label: 'Mentör',              side: 'other', icon: 'graduationCap' },
  { value: 'sponsor_application', label: 'Destekçi',            side: 'other', icon: 'handshake' },
];
export const INBOUND_TYPE_MAP = Object.fromEntries(INBOUND_TYPES.map((t) => [t.value, t]));

const ROLE_CATEGORY = {
  dev: 'Yazılım Geliştirme', design: 'UI/UX Tasarım', marketing: 'Pazarlama & Growth',
  business: 'İş Geliştirme', content: 'İçerik & Yazı', other: 'Diğer',
};
export const roleLabel = (r) => ROLE_CATEGORY[r] || r || '';

// ─── Normalizasyon ───────────────────────────────────────────────────
export function normalizeStage(status) {
  return INBOUND_STAGE_MAP[status] ? status : 'new';
}

const str = (v) => (typeof v === 'string' ? v.trim() : '') || '';

// DB satırı → arayüz nesnesi (camelCase — proje kuralı: açık mapper).
export function mapApplication(r) {
  const intent = r.intent || 'community';
  const type = INBOUND_TYPE_MAP[intent];
  return {
    id: r.id,
    name: str(r.name) || '(isimsiz)',
    email: str(r.email),
    intent,
    type: type || { value: intent, label: intent, side: 'other', icon: 'users' },
    side: type?.side || 'other',
    stage: normalizeStage(r.status),
    createdAt: r.created_at || null,
    stageChangedAt: r.stage_changed_at || null,
    lastContactAt: r.last_contact_at || null,
    ownerEmail: str(r.owner_email).toLowerCase() || null,
    rating: r.rating ?? null,
    activity: Array.isArray(r.activity) ? r.activity : [],
    // form yanıtları
    university: str(r.university), department: str(r.department),
    role: str(r.role), projectName: str(r.project_name), projectId: r.project_id ?? null,
    bio: str(r.bio), skills: str(r.skills),
    linkedin: str(r.linkedin) || str(r.linkedin_url), portfolio: str(r.portfolio),
    pitch: str(r.pitch), problem: str(r.problem), progress: str(r.progress),
    expertise: str(r.expertise), company: str(r.company) || str(r.company_name),
    experienceYears: str(r.experience_years), weeklyHours: str(r.weekly_hours),
    website: str(r.website),
    collab: Array.isArray(r.collaboration_types) ? r.collaboration_types : [],
    sponsorMessage: str(r.sponsor_message),
  };
}

// Kartta / listede tek satırlık özet.
export function detailOf(a) {
  const clip = (s, n = 70) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  switch (a.intent) {
    case 'club_team':           return a.role || 'Ekip belirtilmemiş';
    case 'project':             return [a.projectName, a.role].filter(Boolean).join(' · ') || 'Proje belirtilmemiş';
    case 'pool_match':          return [roleLabel(a.role), clip(a.skills, 40)].filter(Boolean).join(' · ') || 'İlgi alanı belirtilmemiş';
    case 'founder_lead':        return a.projectName || clip(a.pitch) || 'Liderlik başvurusu';
    case 'idea_application':    return clip(a.pitch) || 'Yeni fikir';
    case 'mentor_application':  return [a.expertise, a.company].filter(Boolean).join(' · ') || 'Mentör';
    case 'sponsor_application': return a.company || 'Destekçi';
    default:                    return [a.university, a.department].filter(Boolean).join(' · ') || roleLabel(a.role) || '';
  }
}

// Drawer'da gösterilecek form yanıtları (dolu olanlar, sıralı).
export function answersOf(a) {
  const rows = [
    ['Üniversite', a.university], ['Bölüm', a.department],
    ['Ekip / ilgi alanı', a.intent === 'club_team' ? a.role : roleLabel(a.role)],
    ['Proje', a.projectName],
    ['Beceriler', a.skills],
    ['Kısa tanıtım', a.bio],
    ['Fikir / motivasyon', a.pitch], ['Çözdüğü problem', a.problem], ['Şu ana kadar', a.progress],
    ['Uzmanlık', a.expertise], ['Şirket / kurum', a.company],
    ['Deneyim', a.experienceYears ? `${a.experienceYears} yıl` : ''],
    ['Haftalık saat', a.weeklyHours ? `${a.weeklyHours} saat` : ''],
    ['Web sitesi', a.website],
    ['İşbirliği türü', a.collab.join(', ')],
    ['Mesaj', a.sponsorMessage],
  ];
  return rows.filter(([, v]) => v);
}

// ─── Kabul sonrası alım adımları ────────────────────────────────────
// Kabul edilen başvuru "bitti" sayılmaz: karşılama/atama adımları işaretlenir.
// İşaretler applications.activity içinde {type:'onboard', key, done} olarak durur
// (yeni kolon yok); bir anahtarın SON kaydı geçerlidir.
const ONBOARD = {
  community:           [['whatsapp', 'WhatsApp topluluk grubuna eklendi'], ['welcome', 'Hoş geldin e-postası gönderildi']],
  hub:                 [['whatsapp', 'WhatsApp topluluk grubuna eklendi'], ['welcome', 'Hoş geldin e-postası gönderildi']],
  club_team:           [['welcome', 'Hoş geldin e-postası gönderildi'], ['lead', 'Ekip lideriyle tanıştırıldı'], ['whatsapp', 'Ekip grubuna eklendi']],
  project:             [['welcome', 'Hoş geldin e-postası gönderildi'], ['assign', 'Projeye / pozisyona atandı'], ['whatsapp', 'Proje grubuna eklendi']],
  pool_match:          [['welcome', 'Hoş geldin e-postası gönderildi'], ['assign', 'Bir projeyle eşleştirildi'], ['whatsapp', 'Lab grubuna eklendi']],
  founder_lead:        [['welcome', 'Hoş geldin e-postası gönderildi'], ['assign', 'Fikir / projeye atandı'], ['kickoff', 'Kickoff planlandı']],
  idea_application:    [['welcome', 'Geri dönüş e-postası gönderildi'], ['draft', 'Proje taslağı oluşturuldu'], ['kickoff', 'Kickoff planlandı']],
  mentor_application:  [['welcome', 'Hoş geldin e-postası gönderildi'], ['assign', 'Bir ekiple eşleştirildi']],
  sponsor_application: [['welcome', 'Teşekkür / iletişim e-postası gönderildi'], ['deal', 'Anlaşma / sözleşme tamamlandı']],
};
export const onboardingItems = (a) => (ONBOARD[a.intent] || ONBOARD.community).map(([key, label]) => ({ key, label }));
export function onboardingDone(a) {
  const state = {};
  for (const e of a.activity) if (e.type === 'onboard') state[e.key] = !!e.done;
  return state;
}

// ─── Zaman / SLA ─────────────────────────────────────────────────────
const H = 3600 * 1000;
export const hoursSince = (iso, now = Date.now()) => (iso ? Math.max(0, (now - new Date(iso).getTime()) / H) : 0);

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const h = hoursSince(iso, now);
  if (h < 1) return 'az önce';
  if (h < 24) return `${Math.floor(h)} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} gün önce`;
  if (d < 30) return `${Math.floor(d / 7)} hf önce`;
  return `${Math.floor(d / 30)} ay önce`;
}

// Yeni başvuruya ilk yanıt SLA'sı: 48 saat uyarı, 96 saat kritik.
export const SLA = { warn: 48, critical: 96 };
export function slaState(a, now = Date.now()) {
  if (a.stage !== 'new') return null;
  const h = hoursSince(a.createdAt, now);
  return h >= SLA.critical ? 'critical' : h >= SLA.warn ? 'warn' : null;
}

// ─── İstatistikler ───────────────────────────────────────────────────
const weekStart = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // pazartesi
  return d.getTime();
};

export function computeStats(apps, now = Date.now()) {
  const byStage = Object.fromEntries(INBOUND_STAGES.map((s) => [s.value, 0]));
  const byType = {};
  for (const a of apps) {
    byStage[a.stage] += 1;
    byType[a.intent] = (byType[a.intent] || 0) + 1;
  }
  const thisWeek = weekStart(now);
  const lastWeek = thisWeek - 7 * 24 * H;
  let cur = 0; let prev = 0;
  const weeks = [];
  for (let i = 7; i >= 0; i--) weeks.push({ start: thisWeek - i * 7 * 24 * H, hub: 0, lab: 0, other: 0 });
  for (const a of apps) {
    const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    if (t >= thisWeek) cur += 1; else if (t >= lastWeek) prev += 1;
    const w = weeks.find((x) => t >= x.start && t < x.start + 7 * 24 * H);
    if (w) w[a.side] += 1;
  }
  const decided = byStage.accepted + byStage.rejected;
  const overdue = apps.filter((a) => slaState(a, now)).length;
  return {
    byStage, byType, weeks,
    total: apps.length,
    thisWeek: cur, lastWeek: prev,
    active: byStage.reviewed + byStage.interview,
    acceptRate: decided ? Math.round((byStage.accepted / decided) * 100) : null,
    overdue,
  };
}

export const initials = (name) =>
  (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toLocaleUpperCase('tr')).join('') || '?';

// ─── E-posta taslağı (mailto) ───────────────────────────────────────
export function mailtoFor(a) {
  const first = a.name.split(/\s+/)[0];
  const subjects = {
    community: 'Start-Hub topluluğuna hoş geldin',
    club_team: 'Start-Hub ekip başvurun hakkında',
    hub: 'Start-Hub başvurun hakkında',
    founder_lead: 'Start-Hub Lab — liderlik başvurun',
    idea_application: 'Start-Hub Lab — fikrin hakkında',
    project: 'Start-Hub Lab — proje başvurun',
    pool_match: 'Start-Hub Lab — eşleşme havuzu',
    mentor_application: 'Start-Hub mentörlük başvurun',
    sponsor_application: 'Start-Hub iş birliği başvurunuz',
  };
  const subject = subjects[a.intent] || 'Start-Hub başvurun hakkında';
  const body = `Merhaba ${first},\n\nStart-Hub'a yaptığın başvuru için teşekkürler. \n\n\nSevgiler,\nStart-Hub`;
  return `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
