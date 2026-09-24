// new-candidate.jsx — elle tek aday ekleme (v2 §6). Wizard: 4 soru.
import React, { useMemo } from 'react';
import { useHubStore } from '../hub-store';
import { SOURCES, INTEREST_AREAS } from '../hub-constants';
import { findDuplicate } from '../hub-parse';
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

// presetRoleId: "+ Bu role aday ekle" (Açık Pozisyonlar) ile açılınca —
// aday eklenir eklenmez o role bağlanır, track role'den miras alınır
// (linkCandidateRole zaten bu mirası uyguluyor, tekrar sormuyoruz).
// presetFolderId: bir klasörün İÇİNDEYKEN "Aday Ekle" ile açılınca — aday
// eklenir eklenmez o klasöre düşer (dosya gezgini "buraya ekle" mantığı, 0045).
export default function NewCandidateModal({ onClose, presetRoleId, presetFolderId }) {
  const store = useHubStore();
  const { members, currentMember } = store;

  const steps = useMemo(() => [
    { key: 'fullName', type: 'text', q: 'Adayın adı soyadı?', ph: 'Ada Yılmaz' },
    { key: 'link', type: 'text', q: 'Tek link (GitHub / LinkedIn / e-posta)?', ph: 'github.com/adayilmaz', optional: true, sub: 'Tip otomatik algılanır.' },
    // Görev dağılımı ilgi alanına göre yapılıyor — inbound (form) ile aynı şekilde zorunlu (2026-09-23).
    { key: 'interest', type: 'options', q: 'Hangi alanda yer alacak?', options: INTEREST_AREAS.map((a) => ({ value: a.value, label: a.label })) },
    { key: 'source', type: 'options', q: 'Kaynak?', options: SOURCES.map((s) => ({ value: s.value, label: s.label })) },
    // A6 — "neden bu kişi" ZORUNLU (optional yok): AI taslağının ve eleme kararının tek girdisi
    { key: 'whyThisOne', type: 'textarea', q: 'Neden bu kişi?', ph: 'Ne yapmış? Somut bir iş, proje veya sonuç yaz.',
      sub: 'Sıfat değil, somut eser: repo / proje / yarışma / yazı / etkinlik.' },
    { key: 'ownerId', type: 'options', q: 'Kim sorumlu?', options: members.map((m) => ({ value: m.id, label: m.fullName || m.email })) },
  ], [members]);

  const submit = async (a) => {
    if (!String(a.fullName || '').trim()) throw new Error('Ad zorunlu.');
    if (!String(a.whyThisOne || '').trim()) throw new Error('"Neden bu kişi" zorunlu.');
    const link = linkFields(a.link);
    // D2 — kesin mükerrer (e-posta / GitHub / LinkedIn) yeni kayıt açtırmaz.
    const dup = findDuplicate({ fullName: a.fullName.trim(), university: '', ...link }, store.candidates);
    if (dup?.certain) {
      throw new Error(`Zaten kayıtlı (${dup.reason}). Aynı kişiyse listeden mevcut kartını aç ve düzenle.`);
    }
    const created = await store.addCandidate({
      fullName: a.fullName.trim(),
      ...link,
      interest: a.interest || null,
      source: a.source || 'referral',
      whyThisOne: a.whyThisOne.trim(),
      ownerId: a.ownerId || null,
      stage: 'pool',
      folderId: presetFolderId || null,
    });
    if (presetRoleId && created?.id) await store.linkCandidateRole(created.id, presetRoleId);
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
