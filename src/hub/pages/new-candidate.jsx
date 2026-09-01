// new-candidate.jsx — elle tek aday ekleme (v2 §6). Modal, 4 alan.
import React, { useState } from 'react';
import { AIcon, Modal, Field, Input, Select } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { SOURCES } from '../hub-constants';

// Tek "Link" alanı — tip otomatik algılanır (v2 §4).
function linkFields(v) {
  const s = (v || '').trim();
  if (!s) return {};
  if (/github\.com/i.test(s)) return { github: s };
  if (/linkedin\.com/i.test(s)) return { linkedin: s };
  if (/@/.test(s) && !/^https?:/i.test(s)) return { email: s };
  return { linkedin: s };
}

export default function NewCandidateModal({ onClose }) {
  const store = useHubStore();
  const { members, currentMember } = store;
  const [f, setF] = useState({ fullName: '', link: '', source: 'referral', ownerId: currentMember?.id || '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.fullName.trim()) { setErr('Ad zorunlu.'); return; }
    setBusy(true); setErr('');
    try {
      await store.addCandidate({
        fullName: f.fullName.trim(),
        ...linkFields(f.link),
        source: f.source,
        ownerId: f.ownerId || null,
        stage: 'pool',
      });
      onClose();
    } catch (e) { setErr(e.message || 'Eklenemedi.'); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Yeni aday">
      <div className="adm-form">
        <Field label="Ad" required><Input value={f.fullName} onChange={(v) => set('fullName', v)} placeholder="Ada Yılmaz" /></Field>
        <Field label="Link" hint="GitHub / LinkedIn / e-posta — tip otomatik algılanır">
          <Input value={f.link} onChange={(v) => set('link', v)} placeholder="github.com/adayilmaz" />
        </Field>
        <div className="adm-form-grid">
          <Field label="Kaynak"><Select value={f.source} onChange={(v) => set('source', v)} options={SOURCES.map((s) => ({ value: s.value, label: s.label }))} /></Field>
          <Field label="Sorumlu">
            <Select value={f.ownerId} onChange={(v) => set('ownerId', v)} placeholder="Seç…"
              options={members.map((m) => ({ value: m.id, label: m.fullName || m.email }))} />
          </Field>
        </div>
        <div className="adm-form__footer">
          {err && <span className="adm-form__err">{err}</span>}
          <button className="adm-btn adm-btn--ghost" onClick={onClose} disabled={busy}>İptal</button>
          <button className="adm-btn adm-btn--primary" onClick={save} disabled={busy}>
            <AIcon name="save" size={15} /> {busy ? 'Ekleniyor…' : 'Ekle'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
