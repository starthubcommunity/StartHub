// hub-constants.js — Kurucu Hattı sabit listeleri ve eşik değerleri.
//
// Bu dosya HUB_SPEC §2 (+ §6 check kısıtları) temelli sabit listelerin TEK
// kaynağıdır. Hiçbir bileşen kendi aşama / kaynak / bayrak / rubrik listesini
// tanımlamaz — hepsi buradan gelir. UI metni Türkçe, tanımlayıcılar İngilizce.

// value → label eşlemesi üretir (bileşenlerde <Select> ve rozet metni için).
const toLabelMap = (list) => Object.fromEntries(list.map((x) => [x.value, x.label]));

// ─── Aşamalar (§2.2) ────────────────────────────────────────────────────
// Sıra anlamlıdır: pipeline ilerleyişi bu diziye göre. `archived` aşama
// değildir — her aşamadan çıkış (§2.2), bu yüzden PIPELINE_STAGES dışında.
export const STAGES = [
  { value: 'pool',        label: 'Havuz',    exit: 'Kaynak ve en az bir kanıt linki girilmiş' },
  { value: 'contacted',   label: 'Temas',    exit: 'İlk mesaj gönderildi, hub_touches kaydı var' },
  { value: 'replied',     label: 'Cevap',    exit: 'Aday döndü (olumsuzsa sebeple arşive)' },
  { value: 'interviewed', label: 'Görüşme',  exit: 'hub_interviews kaydı var ve rubrik dolu' },
  { value: 'finalist',    label: 'Finalist', exit: 'Proje seçtirildi + şartlar/hisse konuşuldu' },
  { value: 'gate_a',      label: 'Kapı A',   exit: '72 saatlik ilk görev başlatıldı' },
  { value: 'gate_b',      label: 'Kapı B',   exit: '10 günlük ilk sprint başlatıldı' },
  { value: 'joined',      label: 'Ekipte',   exit: 'Sözleşme imzalandı, hak ediş başladı' },
];

export const ARCHIVED_STAGE = { value: 'archived', label: 'Arşiv' };

// Tüm geçerli `stage` değerleri (DB check kısıtıyla birebir).
export const ALL_STAGES = [...STAGES, ARCHIVED_STAGE];
export const STAGE_ORDER = STAGES.map((s) => s.value);
export const STAGE_LABEL = toLabelMap(ALL_STAGES);

// Bir aşamanın pipeline sırasındaki indexi (archived → -1).
export const stageIndex = (stage) => STAGE_ORDER.indexOf(stage);

// ─── Kaynaklar (§6 check — 14 değer, §8.6.1 bağlam) ────────────────────
export const SOURCES = [
  { value: 'hackathon',    label: 'Hackathon' },
  { value: 'github',       label: 'GitHub' },
  { value: 'dead_startup', label: 'Kapanmış girişim' },
  { value: 'incubator',    label: 'Kuluçka / hızlandırıcı' },
  { value: 'tubitak',      label: 'TÜBİTAK / TEKNOFEST' },
  { value: 'club',         label: 'Üniversite kulübü' },
  { value: 'bootcamp',     label: 'Bootcamp' },
  { value: 'competition',  label: 'Yarışma' },
  { value: 'content',      label: 'Teknik içerik üreticisi' },
  { value: 'open_source',  label: 'Açık kaynak katkıcısı' },
  { value: 'referral',     label: 'Referans' },
  { value: 'inbound',      label: 'Inbound (site başvurusu)' },
  { value: 'event',        label: 'Etkinlik' },
  { value: 'other',        label: 'Diğer' },
];
export const SOURCE_LABEL = toLabelMap(SOURCES);

// ─── Arşiv sebepleri (§2.2 — zorunlu) ─────────────────────────────────
export const ARCHIVE_REASONS = [
  { value: 'no_reply',       label: 'Cevap yok' },
  { value: 'not_interested', label: 'İlgilenmedi' },
  { value: 'no_time',        label: 'Vakti yok' },
  { value: 'below_bar',      label: 'Çıtanın altında' },
  { value: 'we_passed',      label: 'Biz geçtik' },
];
export const ARCHIVE_REASON_LABEL = toLabelMap(ARCHIVE_REASONS);

// ─── Rol tipleri (§6 check) ───────────────────────────────────────────
export const ROLE_TYPES = [
  { value: 'technical',  label: 'Teknik' },
  { value: 'business',   label: 'İş geliştirme' },
  { value: 'design',     label: 'Tasarım' },
  { value: 'operations', label: 'Operasyon' },
];
export const ROLE_TYPE_LABEL = toLabelMap(ROLE_TYPES);

// ─── Veri güveni (§6 check, §8.6.3–8.6.4) ─────────────────────────────
// Elle girilen kayıtta varsayılan 'declared' (§8.2); DB default 'guess'.
export const DATA_TRUST = [
  { value: 'verified', label: 'Doğrulanmış' },
  { value: 'declared', label: 'Beyan' },
  { value: 'guess',    label: 'Tahmin' },
];
export const DATA_TRUST_LABEL = toLabelMap(DATA_TRUST);
export const DATA_TRUST_MANUAL_DEFAULT = 'declared';

// ─── Eğitim durumu (§6 check) ─────────────────────────────────────────
export const EDU_STATUSES = [
  { value: 'student',  label: 'Öğrenci' },
  { value: 'new_grad', label: 'Yeni mezun' },
  { value: 'working',  label: 'Çalışıyor' },
  { value: 'unknown',  label: 'Bilinmiyor' },
];
export const EDU_STATUS_LABEL = toLabelMap(EDU_STATUSES);

// Sınıf (§6 kolon yorumu: '1','2','3','4','yl','dr')
export const CLASS_YEARS = [
  { value: '1',  label: '1. sınıf' },
  { value: '2',  label: '2. sınıf' },
  { value: '3',  label: '3. sınıf' },
  { value: '4',  label: '4. sınıf' },
  { value: 'yl', label: 'Yüksek lisans' },
  { value: 'dr', label: 'Doktora' },
];
export const CLASS_YEAR_LABEL = toLabelMap(CLASS_YEARS);

// ─── Kırmızı bayraklar (§2.4 — sabit 6 madde) ────────────────────────
// Her bayrağın altında serbest not (candidate.flag_notes[key]).
export const RED_FLAGS = [
  { value: 'blame',           label: 'Sorumluluk atma',            hint: 'Geçmiş başarısızlıkları hep başkasına/duruma bağlıyor' },
  { value: 'no_i',            label: 'Katkı belirsiz',             hint: 'Hep "biz" diyor, kendi payını ayırt edemiyor' },
  { value: 'no_capacity',     label: 'Kapasite belirsiz',          hint: 'Bu iş için neyi bırakacağını söyleyemiyor' },
  { value: 'no_terms',        label: 'Şart sormadı',               hint: 'Hisse / şartlar / beklentiler hiç konuşulmadı' },
  { value: 'only_experience', label: 'Sadece deneyim beklentisi',  hint: 'Ortaklık değil, CV\'ye satır arıyor' },
  { value: 'never_finished',  label: 'Hiçbir işi bitmemiş',        hint: 'Başlanmış çok, bitirilmiş hiç iş yok' },
];
export const RED_FLAG_LABEL = toLabelMap(RED_FLAGS);

// ─── Rubrik (§2.3) — üç eksen, her biri 1–5 ─────────────────────────
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const RUBRIC_AXES = [
  { value: 'finishing',     label: 'Bitirmişlik', hint: 'Başladığını bitirmiş mi — canlı/kullanıcılı proje, release, sürdürülen katkı' },
  { value: 'communication', label: 'İletişim',    hint: 'Net, zamanında, karşılıklı — görüşmeden çıkar' },
  { value: 'capacity',      label: 'Kapasite',    hint: 'Haftalık ayırabileceği gerçek zaman ve neyi bırakacağı belli mi' },
];
export const RUBRIC_AXIS_LABEL = toLabelMap(RUBRIC_AXES);

// AI ön puanı yalnızca `bitirmişlik` eksenini tahmin eder (§8.6.6).
// Salt okunur, "öneri" etiketiyle gösterilir; insan puanının üstüne yazmaz.
export const AI_PRESCORE_FINISHING = [
  { value: 5, when: '≥ 2 bitmiş proje ve en az biri canlı/kullanıcılı görünüyor' },
  { value: 4, when: '1 bitmiş proje + son 6 ayda aktif' },
  { value: 3, when: 'Çok repo var ama bitmiş görünen yok' },
  { value: 2, when: 'Az sayıda, çoğu eğitim/kopya repo' },
  { value: 1, when: 'Boş veya yalnızca fork' },
];

// ─── Eşik değerleri (§2.3 + §2.4 + §9) ──────────────────────────────
// Finalist eşiği: toplam ≥ minTotal VE hiçbir eksen ≤ 2 (yani her eksen
// ≥ minAxis) VE kırmızı bayrak sayısı < blockAtRedFlags (ya da cofounder +
// override). Kural: redFlags.length < blockAtRedFlags → geçebilir;
// redFlags.length >= blockAtRedFlags → finalist'e geçiş kilitli.
export const THRESHOLD = {
  minTotal: 10,
  minAxis: 3,            // "hiçbir eksen ≤ 2" ⇔ her eksen ≥ 3
  blockAtRedFlags: 2,    // bu sayı ve üzeri bayrak → finalist kilitli
};

// ─── Bayatlama sayacı (§9 tablosu) ─────────────────────────────────
// Her aşama için: sayaç HANGİ zamandan başlar + warn/critical (gün).
// ⚠️ updated_at ASLA referans değildir — herhangi bir alan düzenlenince
// sıfırlanır ve takip görevi hiç doğmaz. Sayaç yalnızca stage_changed_at
// ve last_contact_at üzerinden işler. Listede olmayan aşamada bayatlama yok.
export const STALE = {
  contacted:   { ref: 'lastContactAt',  warn: 7, critical: 14 },
  interviewed: { ref: 'stageChangedAt', warn: 5, critical: 10 },
  replied:     { ref: 'stageChangedAt', warn: 3, critical: 7 },
  finalist:    { ref: 'stageChangedAt', warn: 5, critical: 10 },
};

// ─── Kapılar (§2.5) ─────────────────────────────────────────────────
export const GATE = { aHours: 72, bDays: 10, totalDays: 13 };

// ─── Haftalık hedefler (§8.6.8 / §8.1) ─────────────────────────────
export const WEEKLY_TARGET = { pool: 30, contacts: 15 };

// ─── Bağlı tablo enum'ları (§6 check kısıtları) ────────────────────
export const TOUCH_CHANNELS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'email',    label: 'E-posta' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other',    label: 'Diğer' },
];
export const TOUCH_CHANNEL_LABEL = toLabelMap(TOUCH_CHANNELS);

export const TOUCH_OUTCOMES = [
  { value: 'pending',  label: 'Bekliyor' },
  { value: 'replied',  label: 'Cevap geldi' },
  { value: 'declined', label: 'Reddetti' },
  { value: 'no_reply', label: 'Cevap yok' },
];
export const TOUCH_OUTCOME_LABEL = toLabelMap(TOUCH_OUTCOMES);

export const INTERVIEW_DECISIONS = [
  { value: 'finalist', label: 'Finalist' },
  { value: 'archive',  label: 'Arşiv' },
  { value: 'hold',     label: 'Beklet' },
];
export const INTERVIEW_DECISION_LABEL = toLabelMap(INTERVIEW_DECISIONS);

export const GATE_RESULTS = [
  { value: 'pending', label: 'Sürüyor' },
  { value: 'passed',  label: 'Geçti' },
  { value: 'failed',  label: 'Kaldı' },
];
export const GATE_RESULT_LABEL = toLabelMap(GATE_RESULTS);

export const URGENCIES = [
  { value: 'low',    label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'Yüksek' },
];
export const URGENCY_LABEL = toLabelMap(URGENCIES);

// ─── Roller (§5) ───────────────────────────────────────────────────
export const HUB_ROLES = [
  { value: 'cofounder',     label: 'Kurucu' },
  { value: 'recruiter',     label: 'İşe alım' },
  { value: 'project_owner', label: 'Proje sahibi' },
];
export const HUB_ROLE_LABEL = toLabelMap(HUB_ROLES);
