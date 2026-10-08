// equity.jsx — Pay Sözleri (HR › Yönetim, yalnızca cofounder: equity.read/manage).
// Proje başına: havuz dağılımı (20/30/50 + rezerv), kilometre taşları,
// koltuklar (Kural 4b bütçe tavanı) ve her koltuktaki pay sözleri.
// "Şu an ne kadar kazanıldı" DB'de değil — src/lib/equity-rules.js hesaplar.
// Koltuk/söz SİLİNMEZ: koltuk kapatılır, söz "ayrılma" ile sonlandırılır.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AIcon, PageHead, Modal, Field, Input, Textarea, Select } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';
import {
  SEAT_KINDS, SEAT_KIND, MILESTONES, MILESTONE_LABEL, POOLS, isMemberSeat,
  computeVesting, vestedOnExit, removalNeedsReview, seatBudget, projectAllocation,
  validateSeat, validateGrant, grantDefaultsForSeat, iso, toDate, compareRoster,
  mapSeatFromDb, mapSeatToDb, mapGrantFromDb, mapGrantToDb, mapMilestoneFromDb, mapEventFromDb,
} from '../../lib/equity-rules';

const today = () => iso(toDate(new Date()));
const pct = (n) => `%${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 3 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATUS_LABEL = { active: 'Aktif', left_good: 'Ayrıldı (iyi niyetli)', left_bad: 'Çıkarıldı (ihlal)', removed: 'Çıkarıldı' };
const EVENT_LABEL = {
  info_notice: 'Bilgilendirme', written_warning: 'Yazılı uyarı', review: 'Değerlendirme',
  decision: 'Karar', starthub_review: 'Start-Hub kontrolü (Kural 12)', note: 'Not',
};
const OUTCOME_LABEL = { stay: 'Kalsın', role_change: 'Rolü değişsin', remove: 'Çıkarılsın' };

function Notice({ tone = 'warn', children }) {
  const c = tone === 'err' ? 'var(--adm-red, #DC2626)' : tone === 'ok' ? 'var(--adm-green, #16A34A)' : '#B45309';
  return (
    <div style={{ borderLeft: `3px solid ${c}`, background: `color-mix(in srgb, ${c} 8%, transparent)`, padding: '8px 12px', borderRadius: 6, fontSize: 13, margin: '6px 0' }}>
      {children}
    </div>
  );
}

function FormFooter({ err, saving, onClose, label = 'Kaydet', disabled }) {
  return (
    <div className="adm-form__footer">
      {err && <span className="adm-form__err">{err}</span>}
      <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose} disabled={saving}>İptal</button>
      <button type="submit" className="adm-btn adm-btn--primary" disabled={saving || disabled}>
        <AIcon name="save" size={16} /> {saving ? 'Kaydediliyor…' : label}
      </button>
    </div>
  );
}

// ── Havuz dağılım çubuğu ────────────────────────────────────────────────
function AllocationBar({ seats }) {
  const a = projectAllocation(seats);
  const parts = [
    { label: 'Start-Hub', v: POOLS.starthub, color: '#57534E', sub: a.starthub ? `${pct(a.starthub)} mentor/CTO` : null },
    { label: 'Team Lead', v: POOLS.lead, color: 'var(--adm-accent, #DC2626)', sub: a.lead ? `${pct(a.lead)} koltukta` : 'koltuk yok' },
    { label: 'Üye koltukları', v: a.members, color: '#2563EB' },
    { label: 'Gelecek Katılımcı Rezervi', v: a.reserve, color: '#CBD5E1' },
  ].filter((p) => p.v > 0);
  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div className="adm-card__body">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Proje payı dağılımı</div>
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: '#F1F5F9' }}>
          {parts.map((p) => <div key={p.label} title={`${p.label} ${pct(p.v)}`} style={{ width: `${p.v}%`, background: p.color }} />)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 10, fontSize: 13 }}>
          {parts.map((p) => (
            <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
              {p.label} <b>{pct(p.v)}</b>{p.sub && <span style={{ color: 'var(--adm-text-dim)' }}>· {p.sub}</span>}
            </span>
          ))}
        </div>
        {a.membersOver > 0 && <Notice tone="err">Üye koltukları %{POOLS.members} havuzunu {pct(a.membersOver)} aşıyor.</Notice>}
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 8 }}>
          Üye havuzu kişi sayısına bölünmez (Kural 4) — dağıtılmayan kısım rezervde kalır, kimsenin üzerinde durmaz (Kural 19).
        </div>
      </div>
    </div>
  );
}

// ── Kilometre taşları ───────────────────────────────────────────────────
function MilestonesCard({ startupId, milestones, canManage, onChanged, flash }) {
  const [draft, setDraft] = useState({});
  const byKind = Object.fromEntries(milestones.map((m) => [m.kind, m]));
  const save = async (kind) => {
    const date = draft[kind];
    if (!date) return;
    const existing = byKind[kind];
    const q = existing
      ? supabase.from('equity_milestones').update({ achieved_at: date }).eq('id', existing.id)
      : supabase.from('equity_milestones').insert({ startup_id: startupId, kind, achieved_at: date });
    const { error } = await q;
    if (error) { flash('Kaydedilemedi: ' + error.message); return; }
    setDraft((d) => ({ ...d, [kind]: undefined }));
    onChanged();
  };
  const clear = async (kind) => {
    const { error } = await supabase.from('equity_milestones').delete().eq('id', byKind[kind].id);
    if (error) { flash('Geri alınamadı: ' + error.message); return; }
    onChanged();
  };
  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div className="adm-card__body">
        <div style={{ fontWeight: 700 }}>Kilometre taşları</div>
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '2px 0 10px' }}>
          Lider için her taş +5 puan hızlandırma; bekleme süresi dolmadan gerçekleşirse bekleme sonunda açılır (Kural 2).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {MILESTONES.map((m) => {
            const got = byKind[m.value];
            return (
              <div key={m.value} style={{ border: '1px solid var(--adm-border, #E5E7EB)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                  <AIcon name={got ? 'check' : 'target'} size={14} style={{ color: got ? 'var(--adm-green, #16A34A)' : 'var(--adm-text-dim)' }} />
                  {m.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '4px 0 6px' }}>
                  {got ? `Gerçekleşti: ${fmtDate(got.achievedAt)}` : 'Henüz gerçekleşmedi'}
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" className="adm-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={draft[m.value] ?? got?.achievedAt ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [m.value]: e.target.value }))} />
                    {draft[m.value] && draft[m.value] !== got?.achievedAt && (
                      <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => save(m.value)}>Kaydet</button>
                    )}
                    {got && !draft[m.value] && (
                      <button className="adm-icon-btn" title="Geri al" onClick={() => clear(m.value)}><AIcon name="x" size={14} /></button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Koltuk formu ────────────────────────────────────────────────────────
function SeatForm({ seat, startupId, projectSeats, onClose, onSaved }) {
  const blank = { startupId, title: '', seatKind: 'member_standard', budgetPct: 10, reserveTopupPct: 0, note: '', active: true };
  const [f, setF] = useState(seat ? { ...seat } : blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const check = validateSeat({ ...f, budgetPct: Number(f.budgetPct) }, projectSeats);
  const submit = async () => {
    if (check.errors.length) { setErr(check.errors[0]); return; }
    setSaving(true); setErr('');
    const row = mapSeatToDb(f);
    const { error } = seat
      ? await supabase.from('equity_seats').update(row).eq('id', seat.id)
      : await supabase.from('equity_seats').insert(row);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };
  const onKind = (v) => setF((p) => ({ ...p, seatKind: v, budgetPct: seat ? p.budgetPct : SEAT_KIND[v].band[1] }));
  return (
    <Modal open onClose={onClose} title={seat ? `${seat.title} — koltuğu düzenle` : 'Yeni koltuk'}>
      <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Koltuk adı" required hint='Örn. "Team Lead", "Mobil geliştirici"'><Input value={f.title} onChange={(v) => set('title', v)} /></Field>
        <Field label="Koltuk tipi" required>
          <Select value={f.seatKind} onChange={onKind} options={SEAT_KINDS.map((k) => ({ value: k.value, label: `${k.label} (önerilen %${k.band[0]}–${k.band[1]})` }))} />
        </Field>
        <Field label="Koltuk bütçesi (%)" required hint="Bu koltuktan geçecek HERKESİN toplam tavanı — her yeni kişiye sıfırdan verilmez (Kural 4b).">
          <Input type="number" step="0.25" min="0" value={f.budgetPct} onChange={(v) => set('budgetPct', v)} />
        </Field>
        {seat && (
          <Field label="Rezervden takviye (%)" hint="Bütçe bittiğinde, Start-Hub onayıyla Gelecek Katılımcı Rezervi'nden eklenir.">
            <Input type="number" step="0.25" min="0" value={f.reserveTopupPct} onChange={(v) => set('reserveTopupPct', v)} />
          </Field>
        )}
        <Field label="Not"><Textarea value={f.note} onChange={(v) => set('note', v)} rows={2} /></Field>
        {seat && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '4px 0 10px' }}>
            <input type="checkbox" checked={f.active === false} onChange={(e) => set('active', !e.target.checked)} />
            Koltuğu kapat (silinmez; dağılımdan düşer)
          </label>
        )}
        {check.warnings.map((w) => <Notice key={w}>{w}</Notice>)}
        <FormFooter err={err} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

// ── Pay sözü formu ──────────────────────────────────────────────────────
function GrantForm({ grant, seat, seatGrants, milestones, prefill, onClose, onSaved }) {
  const avail = seatBudget(seat, seatGrants.filter((g) => g.id !== grant?.id)).available;
  const blank = { seatId: seat.id, holderName: '', holderEmail: '', startDate: today(), retroCreditMonths: 0, retroCreditNote: '', note: '', ...grantDefaultsForSeat(seat, avail), ...(prefill || {}) };
  const [f, setF] = useState(grant ? { ...grant } : blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const norm = { ...f, grantPct: Number(f.grantPct), vestMonths: Number(f.vestMonths), cliffMonths: Number(f.cliffMonths), retroCreditMonths: Number(f.retroCreditMonths || 0) };
  const check = validateGrant(norm, seat, seatGrants);
  const preview = check.errors.length ? null : computeVesting(norm, milestones, today());
  const submit = async () => {
    if (check.errors.length) { setErr(check.errors[0]); return; }
    setSaving(true); setErr('');
    const row = mapGrantToDb(norm);
    const { error } = grant
      ? await supabase.from('equity_grants').update(row).eq('id', grant.id)
      : await supabase.from('equity_grants').insert(row);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={grant ? `${grant.holderName} — pay sözünü düzenle` : `${seat.title} — yeni pay sözü`}>
      <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Notice tone="ok">Koltukta kalan bütçe: <b>{pct(avail)}</b></Notice>
        <Field label="Ad Soyad" required><Input value={f.holderName} onChange={(v) => set('holderName', v)} /></Field>
        <Field label="E-posta" required hint="Ekip Paneli'nde giriş yaptığı adres — “Payım” bu adresle eşleşir.">
          <Input type="email" value={f.holderEmail} onChange={(v) => set('holderEmail', v)} />
        </Field>
        <div className="hub-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Pay sözü (%)" required><Input type="number" step="0.25" min="0" value={f.grantPct} onChange={(v) => set('grantPct', v)} /></Field>
          <Field label="Başlangıç (imza) tarihi" required><Input type="date" value={f.startDate} onChange={(v) => set('startDate', v)} /></Field>
          <Field label="Hak ediş süresi (ay)" required hint="Kural 16: yüksek performansta kısaltılabilir"><Input type="number" min="1" value={f.vestMonths} onChange={(v) => set('vestMonths', v)} /></Field>
          <Field label="Bekleme süresi (ay)" required hint={isMemberSeat(seat.seatKind) ? 'Üyede en az 6 (Kural 3)' : undefined}>
            <Input type="number" min="0" value={f.cliffMonths} onChange={(v) => set('cliffMonths', v)} />
          </Field>
        </div>
        <Field label="Takvim">
          <Select value={f.schedule} onChange={(v) => set('schedule', v)} options={[
            { value: 'time', label: 'Zamana bağlı' },
            { value: 'lead_hybrid', label: 'Hibrit — zaman + kilometre taşı (+5 puan/taş)' },
          ]} />
        </Field>
        <Field label="Geriye dönük kredi (ay, en fazla 3)" hint="Kural 8 — sözleşme öncesi belgelenmiş çalışma. Otomatik değil: Lider önerisi + Start-Hub onayı.">
          <Input type="number" min="0" max="3" value={f.retroCreditMonths} onChange={(v) => set('retroCreditMonths', v)} />
        </Field>
        {Number(f.retroCreditMonths) > 0 && (
          <Field label="Kanıt / onay notu" required><Textarea rows={2} value={f.retroCreditNote} onChange={(v) => set('retroCreditNote', v)} placeholder="Görev kayıtları, tarihler, kim önerdi, kim onayladı" /></Field>
        )}
        <Field label="Not"><Textarea rows={2} value={f.note} onChange={(v) => set('note', v)} /></Field>
        {check.warnings.map((w) => <Notice key={w}>{w}</Notice>)}
        {preview && (
          <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', margin: '6px 0' }}>
            Önizleme: bekleme süresi {fmtDate(preview.cliffDate)} tarihinde dolar · tamamı {fmtDate(preview.fullyVestedDate)} · bugün kazanılmış {pct(preview.vested)}
          </div>
        )}
        <FormFooter err={err} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

// ── Ayrılma / çıkarma ───────────────────────────────────────────────────
function ExitForm({ grant, milestones, events, onClose, onSaved }) {
  const [f, setF] = useState({ status: 'left_good', date: today(), clawedBack: false, note: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const review = removalNeedsReview(grant, milestones, f.date);
  const isRemoval = f.status !== 'left_good';
  const hasWarningRecord = events.some((e) => e.kind === 'written_warning');
  // Kural 12: ≤30 gün kala çıkarmada kayıt eksikse kazanılmamışın iptali 30 gün ertelenir.
  const postpone = isRemoval && f.status !== 'left_bad' && review.needsReview && !hasWarningRecord;
  const effectiveEnd = postpone && f.date ? iso(new Date(toDate(f.date).getTime() + 30 * 86400000)) : f.date;
  const frozen = vestedOnExit(grant, milestones, effectiveEnd);
  const submit = async () => {
    if (!f.date) { setErr('Tarih zorunlu.'); return; }
    if (isRemoval && !f.note.trim()) { setErr('Çıkarmada gerekçe zorunlu.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('equity_grants').update({
      status: f.status, ended_at: effectiveEnd, vested_at_end: frozen,
      clawed_back: f.status === 'left_bad' && f.clawedBack,
    }).eq('id', grant.id);
    if (error) { setSaving(false); setErr(error.message); return; }
    const evs = [{ grant_id: grant.id, seat_id: grant.seatId, kind: 'decision', outcome: isRemoval ? 'remove' : null, note: `${STATUS_LABEL[f.status]} — ${f.note || 'gerekçe yok'}` }];
    if (isRemoval && review.needsReview) {
      evs.push({ grant_id: grant.id, seat_id: grant.seatId, kind: 'starthub_review',
        note: `Bir sonraki hak edişe ${review.daysToNext} gün kala çıkarma (${fmtDate(review.nextVest)}). ${hasWarningRecord ? 'Yazılı uyarı kaydı var.' : 'Yazılı uyarı kaydı YOK — kazanılmamış payın iptali 30 gün ertelendi.'}` });
    }
    const { error: e2 } = await supabase.from('equity_events').insert(evs);
    setSaving(false);
    if (e2) { setErr('Söz güncellendi ama olay kaydı yazılamadı: ' + e2.message); return; }
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={`${grant.holderName} — ayrılma / çıkarma`}>
      <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Durum" required>
          <Select value={f.status} onChange={(v) => set('status', v)} options={[
            { value: 'left_good', label: 'Kendi isteğiyle / iyi niyetli ayrıldı' },
            { value: 'removed', label: 'Çıkarıldı — sıradan ihlal (görev kaçırma, sessizlik)' },
            { value: 'left_bad', label: 'Çıkarıldı — ağır ihlal (dolandırıcılık, IP, rakibe geçme)' },
          ]} />
        </Field>
        <Field label="Karar tarihi" required><Input type="date" value={f.date} onChange={(v) => set('date', v)} /></Field>
        <Field label={isRemoval ? 'Gerekçe' : 'Not'} required={isRemoval}><Textarea rows={2} value={f.note} onChange={(v) => set('note', v)} /></Field>
        {f.status === 'left_bad' && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '4px 0 10px' }}>
            <input type="checkbox" checked={f.clawedBack} onChange={(e) => set('clawedBack', e.target.checked)} />
            Kazanılmış payı da nominal fiyattan geri al (Kural 10 — şirketin hakkı, zorunluluğu değil)
          </label>
        )}
        {isRemoval && review.needsReview && (
          <Notice tone="err">
            Bir sonraki hak edişe <b>{review.daysToNext} gün</b> kala ({fmtDate(review.nextVest)}) çıkarma — Start-Hub kontrolü kaydı otomatik açılır (Kural 12).
            {postpone && <> Bu söz için <b>yazılı uyarı kaydı yok</b>: kazanılmamış payın iptali 30 gün ertelenir ({fmtDate(effectiveEnd)}).</>}
          </Notice>
        )}
        <Notice tone="ok">
          Donacak kazanılmış pay: <b>{pct(f.status === 'left_bad' && f.clawedBack ? 0 : frozen)}</b> · havuza dönecek: <b>{pct(grant.grantPct - (f.status === 'left_bad' && f.clawedBack ? 0 : frozen))}</b>
        </Notice>
        <FormFooter err={err} saving={saving} onClose={onClose} label="Sonlandır" />
      </form>
    </Modal>
  );
}

// ── Uyarı / süreç kaydı (Kural 11) ──────────────────────────────────────
function EventForm({ grant, onClose, onSaved }) {
  const [f, setF] = useState({ kind: 'info_notice', taskRef: '', taskDue: '', fixDeadline: '', outcome: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => {
    const n = { ...p, [k]: v };
    if (k === 'kind' && v === 'written_warning' && !p.fixDeadline) n.fixDeadline = iso(new Date(toDate(today()).getTime() + 7 * 86400000));
    return n;
  });
  const submit = async () => {
    if (f.kind !== 'note' && f.kind !== 'review' && !f.taskRef.trim()) { setErr('Hangi görev? (somut, Kural 11)'); return; }
    if (f.kind === 'written_warning' && !f.fixDeadline) { setErr('Düzeltme süresi sonu zorunlu (7-10 gün).'); return; }
    if (f.kind === 'review' && !f.outcome) { setErr('Değerlendirme sonucu seç.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('equity_events').insert({
      grant_id: grant.id, seat_id: grant.seatId, kind: f.kind, task_ref: f.taskRef || null, task_due: f.taskDue || null,
      fix_deadline: f.fixDeadline || null, outcome: f.outcome || null, note: f.note || null,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={`${grant.holderName} — süreç kaydı`}>
      <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Adım" required>
          <Select value={f.kind} onChange={(v) => set('kind', v)} options={[
            { value: 'info_notice', label: '1 · Bilgilendirme (sözlü/yazılı)' },
            { value: 'written_warning', label: '2 · Yazılı uyarı + düzeltme süresi' },
            { value: 'review', label: '3 · Değerlendirme' },
            { value: 'note', label: 'Not' },
          ]} />
        </Field>
        {f.kind !== 'note' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Hangi görev"><Input value={f.taskRef} onChange={(v) => set('taskRef', v)} placeholder="Görev adı / bağlantısı" /></Field>
            <Field label="Görevin bitiş tarihi"><Input type="date" value={f.taskDue} onChange={(v) => set('taskDue', v)} /></Field>
          </div>
        )}
        {f.kind === 'written_warning' && (
          <Field label="Düzeltme süresi sonu" required hint="7-10 gün (bir sprint)"><Input type="date" value={f.fixDeadline} onChange={(v) => set('fixDeadline', v)} /></Field>
        )}
        {f.kind === 'review' && (
          <Field label="Sonuç" required>
            <Select value={f.outcome} onChange={(v) => set('outcome', v)} placeholder="Seç…" options={Object.entries(OUTCOME_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
        )}
        <Field label="Not"><Textarea rows={2} value={f.note} onChange={(v) => set('note', v)} /></Field>
        {f.kind === 'review' && f.outcome === 'remove' && <Notice>Çıkarma kararını uygulamak için ardından sözde “Sonlandır”ı kullan.</Notice>}
        <FormFooter err={err} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

// ── Çift şart (Kural 7) ─────────────────────────────────────────────────
function AccelForm({ grant, onClose, onSaved }) {
  const [f, setF] = useState({ sale: false, unfair: false, date: today(), note: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!f.sale || !f.unfair) { setErr('İki şart birlikte gerçekleşmeden hızlanma uygulanmaz.'); return; }
    if (!f.note.trim()) { setErr('Satış/devir ve çıkarma bilgisi zorunlu.'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('equity_grants').update({ accelerated_at: f.date, acceleration_note: f.note }).eq('id', grant.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };
  return (
    <Modal open onClose={onClose} title={`${grant.holderName} — çift şartlı hızlanma`}>
      <form className="adm-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Notice>Satış ya da yatırım TEK BAŞINA hiçbir payı açmaz (Kural 7). İki şart birlikte gerekir.</Notice>
        <label style={{ display: 'flex', gap: 8, fontSize: 13, margin: '8px 0' }}>
          <input type="checkbox" checked={f.sale} onChange={(e) => setF((p) => ({ ...p, sale: e.target.checked }))} /> 1 · Proje satıldı / kontrolü değişti
        </label>
        <label style={{ display: 'flex', gap: 8, fontSize: 13, margin: '8px 0' }}>
          <input type="checkbox" checked={f.unfair} onChange={(e) => setF((p) => ({ ...p, unfair: e.target.checked }))} /> 2 · Kişi bu değişiklikten sonraki 12 ay içinde haksız yere çıkarıldı / rolü ciddi küçültüldü
        </label>
        <Field label="Tarih" required><Input type="date" value={f.date} onChange={(e) => setF((p) => ({ ...p, date: e }))} /></Field>
        <Field label="Açıklama" required><Textarea rows={2} value={f.note} onChange={(v) => setF((p) => ({ ...p, note: v }))} /></Field>
        <FormFooter err={err} saving={saving} onClose={onClose} label="Tamamını aç" disabled={!f.sale || !f.unfair} />
      </form>
    </Modal>
  );
}

// ── Koltuk kartı ────────────────────────────────────────────────────────
function SeatCard({ seat, grants, milestones, eventsByGrant, canManage, orphanIds, onEditSeat, onNewGrant, onEditGrant, onExit, onEvent, onAccel }) {
  const b = seatBudget(seat, grants);
  const k = SEAT_KIND[seat.seatKind];
  const w = (x) => (b.cap ? `${(x / b.cap) * 100}%` : '0%');
  const [openHist, setOpenHist] = useState(null);
  return (
    <div className="adm-card" style={{ marginBottom: 14, opacity: seat.active === false ? 0.6 : 1 }}>
      <div className="adm-card__body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{seat.title} {seat.active === false && <span className="hub-pill">Kapalı</span>}</div>
            <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)' }}>{k?.label} · bütçe {pct(seat.budgetPct)}{seat.reserveTopupPct ? ` + rezervden ${pct(seat.reserveTopupPct)}` : ''}</div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onEditSeat}><AIcon name="edit" size={14} /> Koltuk</button>
              {seat.active !== false && b.available > 0 && (
                <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={onNewGrant}><AIcon name="plus" size={14} /> Pay sözü</button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#F1F5F9', margin: '10px 0 4px' }}>
          <div style={{ width: w(b.consumed), background: '#94A3B8' }} title="Ayrılanlarca kullanılan" />
          <div style={{ width: w(b.committed), background: '#2563EB' }} title="Aktif sözler" />
        </div>
        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
          Ayrılanlarca kalıcı kullanılan {pct(b.consumed)} · aktif sözler {pct(b.committed)} · <b style={{ color: 'inherit' }}>kalan {pct(b.available)}</b>
          {b.overBy > 0 && <span style={{ color: '#DC2626' }}> · bütçe {pct(b.overBy)} aşılmış</span>}
        </div>

        {grants.length > 0 && (
          <div className="adm-table-wrap" style={{ marginTop: 12 }}>
            <table className="adm-table">
              <thead><tr><th>Kişi</th><th>Söz</th><th>Kazanılmış</th><th>Kazanılmamış</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                {grants.map((g) => {
                  const v = computeVesting(g, milestones);
                  const evs = eventsByGrant[g.id] || [];
                  const active = g.status === 'active';
                  return (
                    <React.Fragment key={g.id}>
                      <tr>
                        <td><div style={{ fontWeight: 600 }}>{g.holderName}</div><div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{g.holderEmail}</div>
                          {orphanIds?.has(g.id) && <div style={{ fontSize: 11.5, color: 'var(--adm-red, #DC2626)', marginTop: 2 }}>Bu e-posta ekipte yok — Payım'da görünmez</div>}</td>
                        <td>{pct(g.grantPct)}<div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>{g.vestMonths} ay · bekleme {g.cliffMonths}{g.retroCreditMonths ? ` · ${g.retroCreditMonths} ay kredi` : ''}</div></td>
                        <td><b>{pct(v.vested)}</b>{v.bonusVested > 0 && <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>{pct(v.bonusVested)} kilometre taşından</div>}</td>
                        <td>{pct(v.unvested)}</td>
                        <td style={{ fontSize: 12.5 }}>
                          {!active ? <>{STATUS_LABEL[g.status]}<div style={{ color: 'var(--adm-text-dim)' }}>{fmtDate(g.endedAt)}{v.clawedBack ? ' · geri alındı' : ''}</div></>
                            : v.accelerated ? 'Tamamı açıldı (çift şart)'
                            : !v.cliffPassed ? <>Bekleme süresinde<div style={{ color: 'var(--adm-text-dim)' }}>dolum {fmtDate(v.cliffDate)}</div></>
                            : v.nextVest ? <>{v.monthsIn}/{v.vestMonths} ay<div style={{ color: 'var(--adm-text-dim)' }}>sonraki {fmtDate(v.nextVest)}</div></>
                            : 'Tamamen hak edildi'}
                        </td>
                        <td><div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                          <button className="adm-icon-btn" title="Geçmiş" onClick={() => setOpenHist(openHist === g.id ? null : g.id)}><AIcon name="clock" size={14} /></button>
                          {canManage && active && <>
                            <button className="adm-icon-btn" title="Düzenle" onClick={() => onEditGrant(g)}><AIcon name="edit" size={14} /></button>
                            <button className="adm-icon-btn" title="Süreç kaydı (uyarı)" onClick={() => onEvent(g)}><AIcon name="penEdit" size={14} /></button>
                            {!g.acceleratedAt && <button className="adm-icon-btn" title="Çift şartlı hızlanma" onClick={() => onAccel(g)}><AIcon name="zap" size={14} /></button>}
                            <button className="adm-icon-btn adm-icon-btn--danger" title="Ayrılma / çıkarma" onClick={() => onExit(g)}><AIcon name="x" size={14} /></button>
                          </>}
                        </div></td>
                      </tr>
                      {openHist === g.id && (
                        <tr><td colSpan={6} style={{ background: 'var(--adm-bg-soft, #FAFAF9)' }}>
                          {evs.length === 0 ? <span style={{ fontSize: 12.5, color: 'var(--adm-text-dim)' }}>Süreç kaydı yok.</span> : (
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                              {evs.map((e) => (
                                <li key={e.id} style={{ margin: '3px 0' }}>
                                  <b>{EVENT_LABEL[e.kind]}</b> · {fmtDate(e.happenedAt)}
                                  {e.taskRef && <> · görev: {e.taskRef}{e.taskDue ? ` (bitiş ${fmtDate(e.taskDue)})` : ''}</>}
                                  {e.fixDeadline && <> · düzeltme sonu {fmtDate(e.fixDeadline)}</>}
                                  {e.outcome && <> · {OUTCOME_LABEL[e.outcome]}</>}
                                  {e.note && <> — {e.note}</>}
                                  <span style={{ color: 'var(--adm-text-dim)' }}> ({e.createdBy || 'sistem'})</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Ekip ↔ pay sözü (2026-10-08) ───────────────────────────────────────
// Seçili projenin Team App ekibi (hub-equity-roster → hub-bridge-team-roster)
// ile bu projedeki AKTİF pay sözleri e-postayla karşılaştırılır. Team App
// admin'leri listede yok (yönetici; pay sözü konusu değil).
function RosterCard({ roster, missing, orphanCount, canManage, onAdd }) {
  if (!roster || roster.loading) return null;
  const box = (children, tone) => (
    <div className="adm-card" style={{ marginBottom: 16, borderColor: tone === 'warn' ? '#FDE68A' : undefined }}>
      <div className="adm-card__body">{children}</div>
    </div>
  );
  if (roster.err) return box(<div style={{ fontSize: 13, color: 'var(--adm-red)' }}>Ekip listesi alınamadı: {roster.err}</div>);
  if (!roster.teamAppId) return box(<div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Bu proje bir Ekip Paneli (Team App) ekibine bağlı değil — üye karşılaştırması yapılamıyor.</div>);
  if (!missing.length && !orphanCount) {
    return box(<div style={{ fontSize: 13, color: 'var(--adm-green, #16A34A)' }}>✓ Ekipteki herkesin aktif bir pay sözü var ve her sözün e-postası ekipte eşleşiyor.</div>);
  }
  return box(<>
    <div style={{ fontWeight: 700 }}>Ekip ↔ pay sözü</div>
    <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '2px 0 10px' }}>
      Ekip Paneli'ndeki {roster.teamName || 'ekip'} ile karşılaştırıldı (e-postayla). Yöneticiler hariç.
    </div>
    {missing.length > 0 && (
      <>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#B45309', marginBottom: 6 }}>Pay sözü olmayan üyeler ({missing.length})</div>
        <div style={{ display: 'grid', gap: 6, marginBottom: orphanCount ? 10 : 0 }}>
          {missing.map((m) => (
            <div key={m.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <span style={{ fontWeight: 600 }}>{m.name || m.email}</span>
                <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}> · {m.email} · {m.role === 'lead' ? 'Team Lead' : 'Üye'}</span>
              </div>
              {canManage && <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => onAdd(m)}><AIcon name="plus" size={13} /> Söz ekle</button>}
            </div>
          ))}
        </div>
      </>
    )}
    {orphanCount > 0 && (
      <Notice tone="err">{orphanCount} aktif sözün e-postası ekipte yok — o kişiler sözlerini Payım'da göremez. Aşağıda kırmızıyla işaretli; e-postayı Ekip Paneli'ndeki giriş adresiyle düzelt.</Notice>
    )}
  </>, 'warn');
}

// Söz eklerken koltuk seçimi (adı/e-postası önceden dolu gelir).
function SeatPicker({ seats, grantsBySeat, person, onPick, onClose }) {
  const open = seats.filter((s) => s.active !== false);
  return (
    <Modal open onClose={onClose} title={`${person.name || person.email} — hangi koltuk?`}>
      {open.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Bu projede açık koltuk yok — önce “Yeni koltuk” ile bir koltuk aç.</div>
      ) : (
        <div className="hub-wz__opts">
          {open.every((s) => seatBudget(s, grantsBySeat[s.id] || []).available <= 0) && (
            <Notice>Açık koltukların bütçesi dolu. Koltuğu “Koltuk” ile düzenleyip rezervden takviye ekle (Kural 4b) ya da yeni bir koltuk aç.</Notice>
          )}
          {open.map((s) => {
            const b = seatBudget(s, grantsBySeat[s.id] || []);
            return (
              <button key={s.id} type="button" className="hub-wz__opt" disabled={b.available <= 0} onClick={() => onPick(s)}>
                <span className="hub-wz__opt-l">{s.title}</span>
                <span className="hub-wz__opt-r">{SEAT_KIND[s.seatKind]?.label} · kalan {pct(b.available)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Sayfa ───────────────────────────────────────────────────────────────
export default function EquityPage() {
  const { can } = usePerms();
  const canManage = can('equity.manage');
  const [projects, setProjects] = useState([]);
  const [startupId, setStartupId] = useState('');
  const [data, setData] = useState({ seats: [], grants: [], milestones: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [roster, setRoster] = useState(null);   // { loading, err, teamAppId, teamName, members }
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    supabase.from('startups').select('id, name').order('name').then(({ data: rows, error }) => {
      if (error) { flash('Projeler yüklenemedi: ' + error.message); return; }
      setProjects(rows || []);
      setStartupId((cur) => cur || (rows?.[0] ? String(rows[0].id) : ''));
    });
  }, []);

  const load = async () => {
    if (!startupId) { setLoading(false); return; }
    setLoading(true);
    const sid = Number(startupId);
    const { data: seatRows, error: e1 } = await supabase.from('equity_seats').select('*').eq('startup_id', sid).order('created_at');
    if (e1) { flash('Yüklenemedi: ' + e1.message); setLoading(false); return; }
    const seatIds = (seatRows || []).map((s) => s.id);
    const [g, m, ev] = await Promise.all([
      seatIds.length ? supabase.from('equity_grants').select('*').in('seat_id', seatIds).order('start_date') : { data: [] },
      supabase.from('equity_milestones').select('*').eq('startup_id', sid),
      seatIds.length ? supabase.from('equity_events').select('*').in('seat_id', seatIds).neq('kind', 'audit').order('happened_at') : { data: [] },
    ]);
    const err = g.error || m.error || ev.error;
    if (err) flash('Yüklenemedi: ' + err.message);
    setData({
      seats: (seatRows || []).map(mapSeatFromDb),
      grants: (g.data || []).map(mapGrantFromDb),
      milestones: (m.data || []).map(mapMilestoneFromDb),
      events: (ev.data || []).map(mapEventFromDb),
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, [startupId]);

  // Ekip listesi (Team App) — proje değişince; pay verisinden bağımsız yüklenir.
  const loadRoster = async () => {
    if (!startupId) { setRoster(null); return; }
    setRoster({ loading: true });
    const { data: res, error } = await supabase.functions.invoke('hub-equity-roster', { body: { startupId: Number(startupId) } });
    if (error || !res?.ok) { setRoster({ loading: false, err: res?.error || error?.message || 'hata' }); return; }
    setRoster({ loading: false, teamAppId: res.teamAppId, teamName: res.teamName, members: res.members || [] });
  };
  useEffect(() => { loadRoster(); }, [startupId]);
  const rosterCmp = useMemo(
    () => (roster && !roster.loading && !roster.err && roster.teamAppId ? compareRoster(roster.members, data.grants) : { missing: [], orphanIds: new Set() }),
    [roster, data.grants],
  );

  const grantsBySeat = useMemo(() => {
    const out = {};
    for (const g of data.grants) (out[g.seatId] ||= []).push(g);
    return out;
  }, [data.grants]);
  const eventsByGrant = useMemo(() => {
    const out = {};
    for (const e of data.events) if (e.grantId) (out[e.grantId] ||= []).push(e);
    return out;
  }, [data.events]);

  const done = (msg) => { setModal(null); flash(msg); load(); };
  const seatOf = (g) => data.seats.find((s) => s.id === g.seatId);
  const projectName = projects.find((p) => String(p.id) === startupId)?.name || '';

  return (
    <div>
      <PageHead title="Pay Sözleri" desc="Koltuk bütçeleri, pay sözleri ve hak ediş durumu — hesaplama kurallardan, elle değil."
        actions={canManage && startupId && (
          <button className="adm-btn adm-btn--primary" onClick={() => setModal({ type: 'seat' })}><AIcon name="plus" size={16} /> Yeni koltuk</button>
        )} />
      {toast && <div className="adm-toast">{toast}</div>}

      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <Field label="Proje">
          <Select value={startupId} onChange={setStartupId} options={projects.map((p) => ({ value: String(p.id), label: p.name || `#${p.id}` }))} placeholder={projects.length ? undefined : 'Proje yok'} />
        </Field>
      </div>

      <Notice>Taslak çerçeve — Equity Promise'in nihai hukuki dili avukat incelemesinden sonra güncellenecek. Buradaki kayıtlar gerçek hisse değil, şirketleşmeye bağlı taahhüttür.</Notice>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>Yükleniyor…</div>
      ) : (
        <>
          <RosterCard roster={roster} missing={rosterCmp.missing} orphanCount={rosterCmp.orphanIds.size} canManage={canManage}
            onAdd={(m) => setModal({ type: 'pickSeat', person: m })} />
          <AllocationBar seats={data.seats} />
          <MilestonesCard startupId={Number(startupId)} milestones={data.milestones} canManage={canManage} onChanged={load} flash={flash} />
          {data.seats.length === 0 ? (
            <div className="adm-card"><div className="adm-card__body" style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>
              {projectName} için henüz koltuk yok. Önce bir koltuk (ör. “Team Lead”, %30) aç, sonra o koltuğa pay sözü ekle.
            </div></div>
          ) : data.seats.map((s) => (
            <SeatCard key={s.id} seat={s} grants={grantsBySeat[s.id] || []} milestones={data.milestones} eventsByGrant={eventsByGrant} canManage={canManage} orphanIds={rosterCmp.orphanIds}
              onEditSeat={() => setModal({ type: 'seat', seat: s })}
              onNewGrant={() => setModal({ type: 'grant', seat: s })}
              onEditGrant={(g) => setModal({ type: 'grant', seat: s, grant: g })}
              onExit={(g) => setModal({ type: 'exit', grant: g })}
              onEvent={(g) => setModal({ type: 'event', grant: g })}
              onAccel={(g) => setModal({ type: 'accel', grant: g })} />
          ))}
        </>
      )}

      {modal?.type === 'seat' && <SeatForm seat={modal.seat} startupId={Number(startupId)} projectSeats={data.seats} onClose={() => setModal(null)} onSaved={() => done('Koltuk kaydedildi.')} />}
      {modal?.type === 'pickSeat' && <SeatPicker seats={data.seats} grantsBySeat={grantsBySeat} person={modal.person} onClose={() => setModal(null)}
        onPick={(s) => setModal({ type: 'grant', seat: s, prefill: { holderName: modal.person.name || '', holderEmail: modal.person.email } })} />}
      {modal?.type === 'grant' && <GrantForm grant={modal.grant} seat={modal.seat} prefill={modal.prefill} seatGrants={grantsBySeat[modal.seat.id] || []} milestones={data.milestones} onClose={() => setModal(null)} onSaved={() => done('Pay sözü kaydedildi.')} />}
      {modal?.type === 'exit' && <ExitForm grant={modal.grant} milestones={data.milestones} events={eventsByGrant[modal.grant.id] || []} onClose={() => setModal(null)} onSaved={() => done('Söz sonlandırıldı.')} />}
      {modal?.type === 'event' && <EventForm grant={modal.grant} onClose={() => setModal(null)} onSaved={() => done('Süreç kaydı eklendi.')} />}
      {modal?.type === 'accel' && seatOf(modal.grant) && <AccelForm grant={modal.grant} onClose={() => setModal(null)} onSaved={() => done('Tamamı açıldı (çift şart).')} />}
    </div>
  );
}
