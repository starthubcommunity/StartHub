// new-candidate.jsx — elle tek aday ekleme (v2 §6). Wizard: 4 soru.
import React, { useMemo } from 'react';
import { useHubStore } from '../hub-store';
import { SOURCES } from '../hub-constants';
import HubWizard from '../components/wizard';

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

  const steps = useMemo(() => [
    { key: 'fullName', type: 'text', q: 'Adayın adı soyadı?', ph: 'Ada Yılmaz' },
    { key: 'link', type: 'text', q: 'Tek link (GitHub / LinkedIn / e-posta)?', ph: 'github.com/adayilmaz', optional: true, sub: 'Tip otomatik algılanır.' },
    { key: 'source', type: 'options', q: 'Kaynak?', options: SOURCES.map((s) => ({ value: s.value, label: s.label })) },
    { key: 'ownerId', type: 'options', q: 'Kim sorumlu?', options: members.map((m) => ({ value: m.id, label: m.fullName || m.email })) },
  ], [members]);

  const submit = async (a) => {
    if (!String(a.fullName || '').trim()) throw new Error('Ad zorunlu.');
    await store.addCandidate({
      fullName: a.fullName.trim(),
      ...linkFields(a.link),
      source: a.source || 'referral',
      ownerId: a.ownerId || null,
      stage: 'pool',
    });
  };

  return (
    <HubWizard
      title="Yeni aday"
      steps={steps}
      initial={{ source: 'referral', ownerId: currentMember?.id || '' }}
      submitLabel="Ekle"
      onComplete={submit}
      onCancel={onClose}
    />
  );
}
