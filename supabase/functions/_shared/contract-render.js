// _shared/contract-render.js — sözleşme metnini sözden doldurma + gönderim kilidi (0060)
// Tek kaynak: edge function'lar (equity-contract, hub-equity-bridge) ve HR
// (src/lib/contract-render.js yalnızca re-export eder) AYNI kodu kullanır —
// kişinin gördüğü metin ile sunucunun parmak izini aldığı metin birebir aynı olmalı.
// Saf JS: ağ / DB / tarih "şimdi"si yok (test: contract-render.test.mjs).
import { MILESTONES, seatBudget, grantDefaultsForSeat, isOpenGrant } from './equity-rules.js';

export const CONTRACT_KINDS = [
  { value: 'founder', label: 'Kurucu (Team Lead)' },
  { value: 'member', label: 'Ekip üyesi' },
];
export const CONTRACT_KIND_LABEL = Object.fromEntries(CONTRACT_KINDS.map((k) => [k.value, k.label]));

// Hangi metin? Lider koltuğu (ya da hibrit takvim) → kurucu metni, diğerleri → üye.
export function contractKindFor(seat, grant) {
  if (seat?.seatKind === 'lead' || grant?.schedule === 'lead_hybrid') return 'founder';
  return 'member';
}

// Metinde kullanılabilen alanlar (HR'daki yayın formunda listelenir).
export const CONTRACT_FIELDS = [
  ['ad', 'Kişinin adı soyadı'],
  ['eposta', 'Kişinin e-postası'],
  ['proje', 'Proje adı'],
  ['koltuk', 'Koltuk / rol'],
  ['pay', 'Pay sözü (yüzde, % işareti olmadan)'],
  ['sure', 'Hak ediş süresi (ay)'],
  ['bekleme', 'Bekleme süresi (ay)'],
  ['saat', 'Haftalık saat beklentisi'],
  ['kilometre_taslari', 'Kilometre taşları (yalnızca lider)'],
  ['taraflar', 'Start-Hub adına taraflar (Yetkiler’deki cofounder adları)'],
];

const fmtPct = (n) => {
  const x = Math.round(Number(n || 0) * 1000) / 1000;
  return String(x).replace('.', ',');
};

// Özet kartındaki rakamlar — kabul kaydına (terms) da bu nesne yazılır.
export function contractTerms({ grant, seat, projectName, weeklyHours }) {
  const hybrid = grant.schedule === 'lead_hybrid';
  return {
    holderName: grant.holderName || '',
    holderEmail: String(grant.holderEmail || '').toLowerCase(),
    project: projectName || '—',
    seat: seat?.title || '—',
    grantPct: Number(grant.grantPct),
    vestMonths: Number(grant.vestMonths),
    cliffMonths: Number(grant.cliffMonths),
    schedule: grant.schedule,
    weeklyHours: Number(weeklyHours) > 0 ? Number(weeklyHours) : null,
    milestoneBonusPct: hybrid ? Number(grant.milestoneBonusPct || 0) : 0,
    milestones: hybrid ? MILESTONES.map((m) => m.label) : [],
    retroCreditMonths: Number(grant.retroCreditMonths || 0),
    startRule: 'Hak ediş, sözleşmenin onaylandığı gün başlar.',
  };
}

export function contractVars(terms, parties = []) {
  return {
    ad: terms.holderName,
    eposta: terms.holderEmail,
    proje: terms.project,
    koltuk: terms.seat,
    pay: fmtPct(terms.grantPct),
    sure: String(terms.vestMonths),
    bekleme: String(terms.cliffMonths),
    saat: terms.weeklyHours ? `haftada ~${terms.weeklyHours} saat (yalnızca beklenti)` : 'belirtilmedi',
    kilometre_taslari: terms.milestones.length
      ? `${terms.milestones.join(', ')} — her biri +${fmtPct(terms.milestoneBonusPct)} puan hızlandırma`
      : '—',
    taraflar: parties.filter(Boolean).join(' ve ') || 'Start-Hub kurucuları',
  };
}

// {alan} yerlerini doldurur; bilinmeyen alan olduğu gibi kalır (yayın formu uyarır).
export function renderContract(body, vars) {
  return String(body || '').replace(/\r\n/g, '\n').replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function unknownFields(body) {
  const known = new Set(CONTRACT_FIELDS.map(([k]) => k));
  const out = new Set();
  for (const m of String(body || '').matchAll(/\{([a-z_]+)\}/g)) if (!known.has(m[1])) out.add(m[1]);
  return [...out];
}

// Gönderim kilidi — sunucu bunu uygular; HR yalnızca önceden gösterir.
// settings: { testMode, testEmails[] }, template: { isPlaceholder }
export function recipientLock(settings, template, email) {
  const e = String(email || '').trim().toLowerCase();
  const list = (settings?.testEmails || []).map((x) => String(x).toLowerCase());
  const inList = list.includes(e);
  const testMode = settings?.testMode !== false;
  const placeholder = !!template?.isPlaceholder;
  if ((testMode || placeholder) && !inList) {
    return {
      ok: false,
      reason: placeholder
        ? 'Bu sözleşme metni yer tutucu — yalnızca test adreslerine gönderilebilir. Gerçek metin yeni sürümle yayınlanınca bu kilit kalkar.'
        : 'Gönderim test modunda — yalnızca test adreslerine gönderilebilir. Yönetim › Sözleşme Metinleri’nden “Canlıya aç” ile kapatılır.',
    };
  }
  return { ok: true, testOnly: testMode || placeholder };
}

// Karar maili (önizleme + "Evet, eminim" ile gider). Herkese açık bağlantı YOK:
// kişi Ekip Paneli'ne kendi hesabıyla girip "Payım"dan onaylar.
export function contractInviteMail(terms, { teamUrl = 'https://www.starthub-community.com/team/' } = {}) {
  const lines = [
    `Merhaba ${terms.holderName || ''},`.trim(),
    '',
    `${terms.project} projesindeki “${terms.seat}” rolün için pay sözü sözleşmen onayını bekliyor.`,
    '',
    `• Pay sözü: %${fmtPct(terms.grantPct)}`,
    `• Hak ediş süresi: ${terms.vestMonths} ay, bekleme süresi: ${terms.cliffMonths} ay`,
  ];
  if (terms.weeklyHours) lines.push(`• Haftalık saat beklentisi: haftada ~${terms.weeklyHours} saat`);
  if (terms.milestones.length) lines.push(`• Kilometre taşları: ${terms.milestones.join(', ')}`);
  lines.push(
    '',
    'Sözleşmenin tam metnini okuyup onaylamak için:',
    `1) Ekip Paneli'ne bu e-posta adresinle giriş yap: ${teamUrl}`,
    '2) Sağ üstteki “💼 Payım” düğmesine bas, “Sözleşmeni onayla” kartını aç.',
    '',
    'Hak edişin, sözleşmeyi onayladığın gün başlar.',
    'Henüz giriş yapmadıysan önce davet mailindeki bağlantıyla şifreni belirle (bulamazsan giriş ekranındaki “Şifremi unuttum”).',
    '',
    'Sorun olursa bu maile yanıt verebilirsin.',
    'Start-Hub',
  );
  return {
    subject: `Pay sözü sözleşmen onayını bekliyor — ${terms.project}`,
    body: lines.join('\n'),
  };
}

// Europe/Istanbul takvim günü (hak ediş başlangıcı = onay günü).
export function istanbulDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export const mapTemplateFromDb = (r) => ({
  id: r.id, kind: r.kind, version: r.version, title: r.title, body: r.body,
  isPlaceholder: !!r.is_placeholder, note: r.note, publishedAt: r.published_at, publishedBy: r.published_by,
});
export const mapSettingsFromDb = (r) => ({
  testMode: r ? r.test_mode !== false : true, testEmails: r?.test_emails || [],
  liveEnabledAt: r?.live_enabled_at || null, liveEnabledBy: r?.live_enabled_by || null,
});
export const mapAcceptanceFromDb = (r) => ({
  id: r.id, grantId: r.grant_id, templateId: r.template_id, templateKind: r.template_kind,
  templateVersion: r.template_version, holderEmail: r.holder_email, typedName: r.typed_name,
  consent: r.consent, acceptedAt: r.accepted_at, ip: r.ip, userAgent: r.user_agent,
  textSha256: r.text_sha256, textSnapshot: r.text_snapshot, terms: r.terms,
});

// ── B (0061): kabul sonrası — PDF, bilgi mailleri, indirme bütünlüğü ─────

// Arayüzde/PDF'te/mailde geçmemesi gereken kelimeler (kullanıcı kuralı).
export const FORBIDDEN_WORDS = ['taslak', 'avukat'];
export function forbiddenWordsIn(text) {
  const low = String(text || '').toLocaleLowerCase('tr-TR');
  return FORBIDDEN_WORDS.filter((w) => low.includes(w));
}

// Cofounder "onaylandı" mailinin alıcıları: test modunda YALNIZCA test adresleri;
// canlıda HR'daki etkin cofounder kayıtlarının e-postaları (koda sabit adres yok).
export function cofounderMailRecipients(settings, cofounderEmails = []) {
  const norm = (xs) => [...new Set((xs || []).map((x) => String(x || '').trim().toLowerCase()).filter((x) => x.includes('@')))];
  return settings?.testMode !== false ? norm(settings?.testEmails) : norm(cofounderEmails);
}

const slug = (s) => String(s || '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'proje';
export const pdfFileName = (project, version) => `StartHub-Pay-Sozu-${slug(project)}-v${version}.pdf`;

// Kişiye bilgi maili (tek adım) — PDF ekte.
export function acceptedHolderMail(terms, { acceptedAtText, startDate, version }) {
  return {
    subject: `Sözleşmen onaylandı — ${terms.project}`,
    body: [
      `Merhaba ${terms.holderName || ''},`.trim(),
      '',
      `${terms.project} projesindeki “${terms.seat}” rolün için pay sözü sözleşmeni ${acceptedAtText} tarihinde onayladın.`,
      '',
      `• Pay sözü: %${fmtPct(terms.grantPct)}`,
      `• Hak ediş süresi: ${terms.vestMonths} ay, bekleme süresi: ${terms.cliffMonths} ay`,
      `• Hak ediş başlangıcı: ${startDate}`,
      '',
      `Onayladığın metnin (sürüm v${version}) PDF kopyası bu mailin ekinde. Saklamanı öneririz.`,
      'Payının durumunu Ekip Paneli’nde “💼 Payım”dan takip edebilirsin.',
      '',
      'Start-Hub',
    ].join('\n'),
  };
}

// Cofounder'lara "onaylandı" bilgi maili — ek yok, ayrıntı HR'da.
export function acceptedCofounderMail(terms, { typedName, acceptedAtText, startDate, version }) {
  return {
    subject: `Sözleşme onaylandı — ${terms.holderName || typedName}, ${terms.project}`,
    body: [
      `${typedName} (${terms.holderEmail}) pay sözü sözleşmesini onayladı.`,
      '',
      `• Proje / koltuk: ${terms.project} · ${terms.seat}`,
      `• Pay sözü: %${fmtPct(terms.grantPct)} · ${terms.vestMonths} ay, bekleme ${terms.cliffMonths} ay`,
      `• Onay zamanı: ${acceptedAtText}`,
      `• Hak ediş başlangıcı: ${startDate}`,
      `• Metin sürümü: v${version}`,
      '',
      'Kabul kaydı ve PDF: Kurucu Hattı › Pay Sözleri.',
    ].join('\n'),
  };
}

// HR "PDF'i indir": dosyanın SHA-256'sı kayıttakiyle aynı değilse indirme verilmez.
// doc: contract_documents satırı (ya da null), actualSha: depodaki dosyanın SHA-256'sı (ya da null)
export function pdfDownloadDecision(doc, actualSha) {
  if (!doc) return { ok: false, reason: 'missing', message: 'Bu kabul için henüz PDF yok.' };
  if (!actualSha) return { ok: false, reason: 'file_missing', message: 'PDF dosyası depoda bulunamadı.', logEvent: true };
  if (String(actualSha).toLowerCase() !== String(doc.pdf_sha256).toLowerCase()) {
    return { ok: false, reason: 'tampered', message: 'Bu dosya değiştirilmiş olabilir — indirme durduruldu.', logEvent: true };
  }
  return { ok: true };
}

// ── Otomatik gönderim (Ekibe Al → sözleşme, 2026-10-13) ───────────────────
// Davet mailine eklenen satır (Team App davet mailleri + önizleme aynı metni kullanır).
export const INVITE_EQUITY_LINE = 'Giriş yapınca “💼 Payım”da sözleşmen seni bekliyor (pay sözü olan rollerde).';

// Rolün koltuğundan Ekibe Al'da açılacak sözün önizlemesi: koltuğun yüzdesi, kalan bütçeyi aşmaz.
// seat yoksa / kapalıysa / bütçe bittiyse null döner (söz açılmaz, cofounder'a hatırlatılır).
export function seatPreview(seat, seatGrants = []) {
  if (!seat || seat.active === false) return null;
  const avail = seatBudget(seat, seatGrants).available;
  if (!(avail > 0)) return null;
  return { pct: grantDefaultsForSeat(seat, avail).grantPct, title: seat.title, available: avail };
}

// Sözleşme gönderilsin mi? (otomatik ve elle aynı kural; çift gönderimi de burada keser)
export function shouldAutoSend({ status, lock, overBudget, alreadySentAt }) {
  if (status !== 'pending_confirm') return { send: false, reason: status === 'pending_signature' ? 'already_sent' : status === 'active' ? 'already_signed' : 'not_pending' };
  if (alreadySentAt) return { send: false, reason: 'already_sent' };
  if (!lock || !lock.ok) return { send: false, reason: 'locked' };
  if (overBudget) return { send: false, reason: 'over_budget' };
  return { send: true };
}
export const AUTO_SEND_REASON_TR = {
  already_sent: 'sözleşme zaten gönderilmiş',
  already_signed: 'sözleşme zaten imzalanmış',
  not_pending: 'söz teyit bekleyen durumda değil',
  locked: 'test modu / yer tutucu metin kilidi — alıcı test listesinde değil',
  over_budget: 'koltuk bütçesi yetmiyor',
  mail_failed: 'mail gönderilemedi',
};
