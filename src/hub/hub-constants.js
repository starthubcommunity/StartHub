// hub-constants.js — Kurucu Hattı sabit listeleri ve eşik değerleri.
//
// HUB_SPEC v2 temelli. TEK kaynak: hiçbir bileşen kendi aşama / kaynak /
// bayrak / rubrik listesini tanımlamaz. UI metni Türkçe, tanımlayıcılar İngilizce.

// value → label eşlemesi üretir (<Select> ve rozet metni için).
const toLabelMap = (list) => Object.fromEntries(list.map((x) => [x.value, x.label]));

// ─── Aşamalar (v2 §2) ──────────────────────────────────────────────────
// Sıra: Havuz → Temas → Görüşme → Deneme (Kapı A → Kapı B*) → Ekipte.
// `contact` eski contacted+replied'ı kapsar (cevap durumu hub_touches.outcome'da).
// `trial` eski finalist+gate_a+gate_b'yi kapsar — Kapı A/B ayrımı hub_gates.gate
// ile, ayrı stage değeri DEĞİL. `archived` aşama değil, her aşamadan çıkış.
export const STAGES = [
  { value: 'pool',      label: 'Havuz',    exit: 'Kaynak ve en az bir link girilmiş' },
  { value: 'contact',   label: 'Temas',    exit: 'İlk mesaj gönderildi (hub_touches kaydı)' },
  { value: 'interview', label: 'Görüşme',  exit: 'Rubrik dolu, eşik kontrolü yapıldı' },
  { value: 'trial',     label: 'Deneme',   exit: 'Aktif kapı (A ya da B) başlatıldı' },
  { value: 'member',    label: 'Ekipte',   exit: 'Sözleşme imzalandı, hak ediş başladı' },
];

export const ARCHIVED_STAGE = { value: 'archived', label: 'Arşiv' };

export const ALL_STAGES = [...STAGES, ARCHIVED_STAGE];
export const STAGE_ORDER = STAGES.map((s) => s.value);
export const STAGE_LABEL = toLabelMap(ALL_STAGES);

// Bir aşamanın pipeline sırasındaki indexi (archived → -1).
export const stageIndex = (stage) => STAGE_ORDER.indexOf(stage);

// ─── Kaynaklar (v2 §6 — 14→6) ─────────────────────────────────────────
// Eski değerler (tubitak, club, bootcamp, competition, content, open_source,
// dead_startup, event) `source_detail` serbest metnine taşınır.
export const SOURCES = [
  { value: 'referral',  label: 'Referans' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'github',    label: 'GitHub' },
  { value: 'incubator', label: 'Kuluçka / hızlandırıcı' },
  { value: 'inbound',   label: 'Inbound (site başvurusu)' },
  { value: 'other',     label: 'Diğer' },
];
export const SOURCE_LABEL = toLabelMap(SOURCES);

// ─── Sonraki aksiyon (v2 §3 — 6 seçenek) ─────────────────────────────
// Serbest metin DEĞİL: sabit liste.
export const NEXT_ACTIONS = [
  { value: 'message',            label: 'Mesaj at' },
  { value: 'follow_up',          label: 'Takip et' },
  { value: 'schedule_interview', label: 'Görüşme ayarla' },
  { value: 'interview',          label: 'Görüş' },
  { value: 'decide',             label: 'Karar ver' },
  { value: 'start_gate',         label: 'Kapı başlat' },
];
export const NEXT_ACTION_LABEL = toLabelMap(NEXT_ACTIONS);

// ─── Arşiv sebepleri (v2 §2 — zorunlu) ───────────────────────────────
export const ARCHIVE_REASONS = [
  { value: 'no_reply',       label: 'Cevap yok' },
  { value: 'not_interested', label: 'İlgilenmedi' },
  { value: 'no_time',        label: 'Vakti yok' },
  { value: 'below_bar',      label: 'Çıtanın altında' },
  { value: 'we_passed',      label: 'Biz geçtik' },
  { value: 'gate_failed',    label: 'Görevi teslim etmedi' },
];
export const ARCHIVE_REASON_LABEL = toLabelMap(ARCHIVE_REASONS);

// ─── Rol tipleri ─────────────────────────────────────────────────────
export const ROLE_TYPES = [
  { value: 'technical',  label: 'Teknik' },
  { value: 'business',   label: 'İş geliştirme' },
  { value: 'design',     label: 'Tasarım' },
  { value: 'operations', label: 'Operasyon' },
];
export const ROLE_TYPE_LABEL = toLabelMap(ROLE_TYPES);

// ─── Kırmızı bayraklar (v2 §2.3 — 6→4) ──────────────────────────────
// Her bayrağın altında serbest not (candidate.flagNotes[key]).
export const RED_FLAGS = [
  { value: 'blame',       label: 'Sorumluluk atma',  hint: 'Geçmiş başarısızlıkları hep başkasına/duruma bağlıyor' },
  { value: 'no_terms',    label: 'Şart sormadı',      hint: 'Hisse / şartlar / beklentiler hiç konuşulmadı' },
  { value: 'unrealistic', label: 'Gerçekçi değil',    hint: 'Zaman planı, beklenti veya vaatler gerçekçi değil' },
  { value: 'disrespect',  label: 'Saygısızlık',       hint: 'Görüşmede küçümseyen / saygısız tavır' },
];
export const RED_FLAG_LABEL = toLabelMap(RED_FLAGS);

// ─── Rubrik (v2 §2.3) — üç eksen, her biri 1–5 ─────────────────────
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const RUBRIC_AXES = [
  { value: 'finishing',     label: 'Bitirmişlik', hint: 'Başladığını bitirmiş mi — canlı/kullanıcılı proje, release, sürdürülen katkı' },
  { value: 'communication', label: 'İletişim',    hint: 'Net, zamanında, karşılıklı — görüşmeden çıkar' },
  { value: 'capacity',      label: 'Kapasite',    hint: 'Haftalık ayırabileceği gerçek zaman ve neyi bırakacağı belli mi' },
];
export const RUBRIC_AXIS_LABEL = toLabelMap(RUBRIC_AXES);

// AI ön puanı yalnızca `bitirmişlik` eksenini tahmin eder. Rubrik butonları
// 1–5 rakamı yerine bu cümleyi gösterir (v2 §2.3).
export const AI_PRESCORE_FINISHING = [
  { value: 5, when: '≥ 2 bitmiş proje ve en az biri canlı/kullanıcılı görünüyor' },
  { value: 4, when: '1 bitmiş proje + son 6 ayda aktif' },
  { value: 3, when: 'Çok repo var ama bitmiş görünen yok' },
  { value: 2, when: 'Az sayıda, çoğu eğitim/kopya repo' },
  { value: 1, when: 'Boş veya yalnızca fork' },
];

// ─── Hatlar (v2 §0) ────────────────────────────────────────────────
export const TRACKS = [
  { value: 'founder', label: 'Kurucu' },
  { value: 'member',  label: 'Üye' },
];
export const TRACK_LABEL = toLabelMap(TRACKS);

// ─── Eşik değerleri — HAT BAZINDA (v2 §2.3) ────────────────────────
// Kurucu: toplam ≥ minTotal VE her eksen ≥ minAxis, iletişim ekseni zorunlu.
// Üye: bitirmişlik ≥ minFinishing VE kapasite ≥ minCapacity; iletişim yalnızca
//      rol needs_communication ise (eşik minCommunication).
// Ortak: kırmızı bayrak < blockAtRedFlags (ya da cofounder + override).
export const THRESHOLD = {
  blockAtRedFlags: 2,
  founder: { minTotal: 10, minAxis: 3 },
  member:  { minFinishing: 3, minCapacity: 3, minCommunication: 3 },
};

// ─── Açık rol durum makinesi (v2 §10.1 — 7→4) ─────────────────────
// Talep/onay el sıkışması yok: rol doğrudan 'sourcing'e düşer.
export const ROLE_STATUSES = [
  { value: 'draft',     label: 'Taslak' },
  { value: 'sourcing',  label: 'Aranıyor' },
  { value: 'shortlist', label: 'Kısa liste' },
  { value: 'filled',    label: 'Dolduruldu' },
];
export const ROLE_STATUS_LABEL = toLabelMap(ROLE_STATUSES);

// filled sisteme aittir (aday `member` olunca otomatik).
export const ROLE_STATUS_NEXT = {
  draft:     ['sourcing'],
  sourcing:  ['shortlist', 'draft'],
  shortlist: ['sourcing'],   // filled otomatik
  filled:    [],
};

export const OWNER_DECISIONS = [
  { value: 'pending',  label: 'Bekliyor' },
  { value: 'accepted', label: 'Kabul' },
  { value: 'rejected', label: 'Ret' },
];
export const OWNER_DECISION_LABEL = toLabelMap(OWNER_DECISIONS);

// ─── Bayatlama sayacı (v2 §12 — istemcide isStale()) ──────────────
// ⚠️ updated_at ASLA referans değildir. Yalnızca stageChangedAt ve
// lastContactAt. Listede olmayan aşamada bayatlama yok.
export const STALE = {
  contact:   { ref: 'lastContactAt',  warn: 7, critical: 14 },
  interview: { ref: 'stageChangedAt', warn: 5, critical: 10 },
  trial:     { ref: 'stageChangedAt', warn: 5, critical: 10 },
};

// ─── Kapılar (v2 §2.1) ────────────────────────────────────────────
export const GATE = { aHours: 72, bDays: 10, totalDays: 13 };

// Süre uzatma seçenekleri (v2 §2.2) — gün.
export const GATE_EXTENSIONS = [
  { value: 1, label: '+1 gün' },
  { value: 3, label: '+3 gün' },
  { value: 7, label: '+1 hafta' },
];

// ─── Haftalık hedefler (v2 §11 — gerçekçileştirildi) ──────────────
export const WEEKLY_TARGET = { pool: 10, contacts: 6 };

// ─── Bağlı tablo enum'ları ───────────────────────────────────────
// Kanal 4→3 (v2 §9).
export const TOUCH_CHANNELS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'email',    label: 'E-posta' },
  { value: 'whatsapp', label: 'WhatsApp' },
];
export const TOUCH_CHANNEL_LABEL = toLabelMap(TOUCH_CHANNELS);

export const TOUCH_OUTCOMES = [
  { value: 'pending',  label: 'Bekliyor' },
  { value: 'replied',  label: 'Cevap geldi' },
  { value: 'declined', label: 'Reddetti' },
  { value: 'no_reply', label: 'Cevap yok' },
];
export const TOUCH_OUTCOME_LABEL = toLabelMap(TOUCH_OUTCOMES);

export const GATE_RESULTS = [
  { value: 'pending', label: 'Sürüyor' },
  { value: 'passed',  label: 'Geçti' },
  { value: 'failed',  label: 'Kaldı' },
];
export const GATE_RESULT_LABEL = toLabelMap(GATE_RESULTS);

// ─── Roller (§5) ─────────────────────────────────────────────────
export const HUB_ROLES = [
  { value: 'cofounder',     label: 'Kurucu' },
  { value: 'recruiter',     label: 'İşe alım' },
  { value: 'project_owner', label: 'Proje sahibi' },
];
export const HUB_ROLE_LABEL = toLabelMap(HUB_ROLES);
