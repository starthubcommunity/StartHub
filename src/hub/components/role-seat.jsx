// role-seat.jsx — "Bu rol için pay" (2026-10-13). Rol açılırken (ya da sonradan rol kartından)
// cofounder (equity.manage) rolün pay koltuğunu belirler: koltuk tipi + yüzde → ayrı
// "Evet, eminim" onayı. Koltuk equity_seats'e open_role_id = rol ile yazılır; bu rolde biri
// "Ekibe Al" ile alınınca sözleşme o yüzdeyle OTOMATİK gider (move-to-team-core).
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AIcon, Modal, Field, Input, Select } from '../../admin/admin-ui';
import { SEAT_KINDS, SEAT_KIND, validateSeat, mapSeatFromDb } from '../../lib/equity-rules';

const pctText = (n) => `%${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 3 })}`;

export default function RoleSeatDialog({ role, onClose, onSaved }) {
  const defKind = role.track === 'founder' ? 'lead' : 'member_standard';
  const [f, setF] = useState({ seatKind: defKind, budgetPct: SEAT_KIND[defKind].band[1], title: role.track === 'founder' ? 'Team Lead' : (role.title || '') });
  const [projectSeats, setProjectSeats] = useState([]);
  const [step, setStep] = useState('form');   // 'form' | 'confirm'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (role.startupId == null) return;
    supabase.from('equity_seats').select('*').eq('startup_id', role.startupId)
      .then(({ data }) => setProjectSeats((data || []).map(mapSeatFromDb)));
  }, [role.startupId]);

  const seat = { startupId: role.startupId, title: f.title, seatKind: f.seatKind, budgetPct: Number(f.budgetPct), active: true };
  const check = validateSeat(seat, projectSeats);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const next = () => {
    if (role.startupId == null) { setErr('Rol bir projeye bağlı değil — önce rolü bir projeye bağla.'); return; }
    if (check.errors.length) { setErr(check.errors[0]); return; }
    setErr(''); setStep('confirm');
  };
  const save = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.from('equity_seats').insert({
      startup_id: role.startupId, title: f.title.trim(), seat_kind: f.seatKind, budget_pct: Number(f.budgetPct),
      open_role_id: role.id, note: 'Rol açılırken belirlendi (Açık Pozisyonlar).',
    });
    setBusy(false);
    if (error) { setErr(error.message); setStep('form'); return; }
    onSaved?.();
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title={`Bu rol için pay — ${role.title}`}>
      {step === 'form' ? (
        <form className="adm-form" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', marginBottom: 12, lineHeight: 1.55 }}>
            Bu role girecek kişiye verilecek pay sözünü şimdi belirle. Bu rolde biri ekibe alınınca sözleşme bu yüzdeyle otomatik gider.
          </div>
          <Field label="Koltuk tipi" required>
            <Select value={f.seatKind} onChange={(v) => setF((p) => ({ ...p, seatKind: v, budgetPct: SEAT_KIND[v].band[1] }))}
              options={SEAT_KINDS.map((k) => ({ value: k.value, label: `${k.label} (önerilen %${k.band[0]}–${k.band[1]})` }))} />
          </Field>
          <Field label="Pay (%)" required hint="Bu koltuktan geçecek herkesin toplam tavanı; ilk kişiye bu yüzde önerilir.">
            <Input type="number" step="0.25" min="0" value={f.budgetPct} onChange={(v) => set('budgetPct', v)} />
          </Field>
          <Field label="Koltuk adı"><Input value={f.title} onChange={(v) => set('title', v)} /></Field>
          {check.warnings.map((w) => <div key={w} style={{ fontSize: 12.5, color: '#B45309', margin: '4px 0' }}>{w}</div>)}
          <div className="adm-form__footer">
            {err && <span className="adm-form__err">{err}</span>}
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>Şimdilik geç</button>
            <button type="submit" className="adm-btn adm-btn--primary">Devam</button>
          </div>
        </form>
      ) : (
        <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          <b>{role.title}</b> rolü için <b>{pctText(f.budgetPct)}</b> pay ({SEAT_KIND[f.seatKind]?.label}).
          <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 8, background: '#F0FDF4', color: '#166534', fontSize: 13 }}>
            Bu rolde biri ekibe alınınca sözleşme otomatik gider.
          </div>
          {err && <div style={{ fontSize: 12.5, color: 'var(--adm-red)', marginTop: 10 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button className="adm-btn adm-btn--ghost" onClick={() => setStep('form')} disabled={busy}>Geri</button>
            <button className="adm-btn adm-btn--primary" onClick={save} disabled={busy}><AIcon name="check" size={14} /> {busy ? 'Kaydediliyor…' : 'Evet, eminim'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
