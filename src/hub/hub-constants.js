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

// Elle / içe aktarmayla aday eklerken seçilebilen kaynaklar — 'inbound' HARİÇ:
// site başvuruları Inbound hattında (applications) yaşar, Outbound'a elle eklenmez.
export const OUTBOUND_SOURCES = SOURCES.filter((s) => s.value !== 'inbound');

// ─── Sonraki aksiyon (v3 §3 — TÜRETİLİR) ────────────────────────────
// v3: elle seçilen alan kaldırıldı. Etiketler artık hub-rules.js
// nextAction() içinde; sabit liste tutulmuyor.

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

// ─── Kırmızı bayraklar — v3'te KALDIRILDI (PROMPT_V3 A4) ────────────
// Yerine aday kartında tek serbest "Görüşme notu" alanı (interview_note).
// DB kolonları (red_flags, flag_notes, override_reason) düşürülmedi; UI
// yazmıyor. override_reason yalnızca aşama-atlama override'ında okunur.

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

// track alanı boş/bilinmeyen bir adayın varsayılan hattı. 2026-09-16
// düzeltmesi: önceden kodun her yerinde `c.track || 'founder'` deseni
// vardı (hub_candidates.track DB default'u da 'founder'ydı) — yani
// track'i hiç yazmayan HER yol (site trigger'ı 0022, elle aday ekleme,
// yapıştır/CSV/GitHub içe aktarma) sessizce kurucu hattına düşüyor ve
// çok daha ağır THRESHOLD.founder ile değerlendiriliyordu. Doğrusu
// hub_open_roles.track'in zaten kullandığı 'member' varsayılanı.
export const DEFAULT_TRACK = 'member';

// ─── Eşik değerleri — HAT BAZINDA (v2 §2.3) ────────────────────────
// Kurucu: toplam ≥ minTotal VE her eksen ≥ minAxis, iletişim ekseni zorunlu.
// Üye: bitirmişlik ≥ minFinishing VE kapasite ≥ minCapacity; iletişim yalnızca
//      rol needs_communication ise (eşik minCommunication).
// v3: kırmızı bayrak kilidi kaldırıldı — blockAtRedFlags yok.
export const THRESHOLD = {
  founder: { minTotal: 10, minAxis: 3 },
  member:  { minFinishing: 3, minCapacity: 3, minCommunication: 3 },
};

// ─── Açık rol durum makinesi (v2 §10.1 — 7→4) ─────────────────────
// Talep/onay el sıkışması yok: rol doğrudan 'sourcing'e düşer.
// 'sourcing' = "Yayında" (web sitesinde görünür, aday aranıyor). 'shortlist'
// artık ELLE ulaşılabilir bir durum DEĞİL — yalnızca bir aday proje sahibine
// gerçekten SUNULDUĞUNDA sistem otomatik olarak buraya geçer (bkz. hub-
// store.jsx presentCandidate / hub-rules.js roleStatusAfterReject). Kullanıcı
// kararı: "Kısa listeye al" butonu (gerçek bir sunum olmadan elle bu duruma
// geçme) kaldırıldı çünkü sitede görünürlük açısından sourcing'den farksızdı
// ve kafa karıştırıyordu — etiket/rozet, otomatik oluştuğunda hâlâ doğru
// gösteriliyor, sadece manuel buton gitti.
export const ROLE_STATUSES = [
  { value: 'draft',     label: 'Taslak' },
  { value: 'sourcing',  label: 'Yayında' },
  { value: 'shortlist', label: 'Kısa liste' },
  { value: 'filled',    label: 'Dolduruldu' },
];
export const ROLE_STATUS_LABEL = toLabelMap(ROLE_STATUSES);

// filled sisteme aittir (aday `member` olunca otomatik).
// sourcing -> shortlist ELLE yok (yukarıdaki not) — yalnızca geri dönüş var.
export const ROLE_STATUS_NEXT = {
  draft:     ['sourcing'],
  sourcing:  ['draft'],
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

// ─── KVKK (E3) ───────────────────────────────────────────────────
// İlk mesajda aydınlatma bağlantısı. Şablonda {{kvkk}} → bu satır.
export const KVKK_NOTICE_URL = 'https://www.starthub-community.com/kvkk';
export const KVKK_NOTICE_LINE =
  `Verilerini nasıl işlediğimiz: ${KVKK_NOTICE_URL} · silinmesini istersen yaz, kaydını kaldırırız.`;

// ─── Roller (§5) ─────────────────────────────────────────────────
export const HUB_ROLES = [
  { value: 'cofounder',     label: 'Kurucu' },
  { value: 'recruiter',     label: 'İşe alım' },
  { value: 'project_owner', label: 'Proje sahibi' },
];
export const HUB_ROLE_LABEL = toLabelMap(HUB_ROLES);
