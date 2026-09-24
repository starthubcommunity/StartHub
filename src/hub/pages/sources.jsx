// sources.jsx — Kaynak kütüğü (HUB_SPEC v3 §11, PROMPT_V3 E1).
// "Avın nerede yapılacağı" birinin aklında değil, burada durur. GitHub taraması
// E5'te ayrı ele alınır (aday ekleme yöntemi, edge function proxy) — bu ekran
// artık yalnızca kütük + kaynak verimi.
import React, { useState, useMemo } from 'react';
import { AIcon, Field, Input, Select, Modal, ConfirmDialog } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { SOURCES, SOURCE_LABEL } from '../hub-constants';
import { sourceStats, intervalToDays } from '../hub-metrics';

// v3 6 kaynak tipi + spesifik örnek adlar (kütüğe başlangıç).
const SEED_SOURCES = [
  ['Referans (üyelerden isim iste)', 'referral', ''],
  ['Teknofest sonuç sayfaları (kategori bazında)', 'hackathon', 'https://www.teknofest.org'],
  ['Banka / operatör hackathon finalist listeleri', 'hackathon', ''],
  ['Kuluçka / hızlandırıcı demo day listeleri', 'incubator', ''],
  ['GitHub (konum / dil / aktiflik araması)', 'github', 'https://github.com/search'],
  ['Site başvuruları (inbound)', 'inbound', ''],
];

const CHECK_OPTS = [
  { value: '7 days', label: 'Haftalık' },
  { value: '14 days', label: '2 haftada bir' },
  { value: '30 days', label: 'Aylık' },
  { value: '90 days', label: '3 ayda bir' },
];
const STATUS_OPTS = [
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Duraklatıldı' },
  { value: 'dead', label: 'Ölü' },
];
const BLANK_SRC = { name: '', url: '', source: 'hackathon', note: '', checkEvery: '7 days', ownerId: '', status: 'active' };
const EIGHT_WEEKS = 56 * 86400000;

// 2026-09-24 CRM-lite Round 2 — kontrol sıklığı/zamanlama/"pasifleştir öner"
// ops-takibi karmaşıklığı SİLİNMEDİ, yalnızca varsayılan görünümden bir
// "Gelişmiş" çipiyle açılan ikinci bir katmana taşındı. Basit görünümde kaynak
// eklerken yalnızca Ad/URL/Tip sorulur; sıklık/sorumlu/durum sessiz varsayılanla
// ('7 days' / oturum sahibi / 'active') kaydedilir, istenirse Gelişmiş'ten değiştirilir.
function SourceRegistry() {
  const store = useHubStore();
  const { sources, candidates, touches, stageLog, members, currentMember } = store;
  const { can } = usePerms();
  const canWrite = can('sources.manage');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Kaynak TİPİ başına verim (kütük satırları tip düzeyinde).
  const byType = useMemo(
    () => sourceStats(candidates, touches, stageLog, (c) => c.source || 'other'),
    [candidates, touches, stageLog]
  );
  // 8 haftadır işe alıma/cevaba dönüşmemiş tip → "pasifleştir öner".
  const stale = useMemo(() => {
    const oldest = {};
    for (const c of candidates) {
      const t = c.createdAt ? Date.parse(c.createdAt) : Date.now();
      const s = c.source || 'other';
      if (!(s in oldest) || t < oldest[s]) oldest[s] = t;
    }
    const rec = {};
    for (const s of Object.keys(byType)) {
      const r = byType[s];
      rec[s] = oldest[s] && Date.now() - oldest[s] >= EIGHT_WEEKS && r.total >= 3 && r.replied === 0 && r.hired === 0;
    }
    return rec;
  }, [byType, candidates]);

  const seed = async () => {
    for (const [name, source, url] of SEED_SOURCES) {
      await store.addItem('sources', { ...BLANK_SRC, name, source, url, ownerId: currentMember?.id ?? null });
    }
    flash(`${SEED_SOURCES.length} kaynak eklendi.`);
  };
  const save = async () => {
    if (!editing.name.trim()) { flash('Ad zorunlu.'); return; }
    try {
      if (editing.id) await store.updateItem('sources', editing.id, editing);
      else await store.addItem('sources', { ...editing, ownerId: editing.ownerId || currentMember?.id || null });
      setEditing(null);
    } catch (e) { flash('Hata: ' + e.message); }
  };
  const markChecked = (s) => store.updateItem('sources', s.id, { ...s, lastChecked: new Date().toISOString() });
  const pause = (src) => {
    sources.filter((s) => s.source === src && s.status === 'active')
      .forEach((s) => store.updateItem('sources', s.id, { ...s, status: 'paused' }));
    flash(`"${SOURCE_LABEL[src] || src}" kaynakları duraklatıldı.`);
  };
  const memberName = (id) => members.find((m) => m.id === id)?.fullName || '—';

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Kaynak kütüğü</h1>
          <p className="adm-page-head__desc">Avın nerede yapılacağı birinin aklında değil, burada durur.</p>
        </div>
        <div className="adm-page-head__actions">
          <button type="button" className={`adm-chip ${advanced ? 'adm-chip--active' : ''}`} onClick={() => setAdvanced((v) => !v)}>
            <AIcon name="settings" size={13} /> Gelişmiş
          </button>
          {canWrite && sources.length === 0 && <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={seed}>Örnek kaynakları ekle</button>}
          {canWrite && (
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setEditing({ ...BLANK_SRC, ownerId: currentMember?.id || '' })}>
              <AIcon name="plus" size={14} /> Kaynak ekle
            </button>
          )}
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="adm-empty">Kütük boş. "Örnek kaynakları ekle" ile başla.</div>
      ) : (
        <div className="adm-card" style={{ overflowX: 'auto' }}>
          <table className="adm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Ad</th><th>Tip</th>
                {advanced && <><th>Sıklık</th><th>Son kontrol</th><th>Sorumlu</th></>}
                <th style={{ textAlign: 'right' }}>Aday</th>
                <th style={{ textAlign: 'right' }}>Cevap %</th>
                <th style={{ textAlign: 'right' }}>İşe alım</th>
                <th>Durum</th>{canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const r = byType[s.source] || { total: 0, replyRate: null, hired: 0 };
                const due = !s.lastChecked || Date.now() - Date.parse(s.lastChecked) >= intervalToDays(s.checkEvery) * 86400000;
                return (
                  <tr key={s.id}>
                    <td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-blue)' }}>{s.name}</a> : s.name}</td>
                    <td>{SOURCE_LABEL[s.source] || s.source}</td>
                    {advanced && (<>
                      <td>{CHECK_OPTS.find((c) => c.value === s.checkEvery)?.label || s.checkEvery}</td>
                      <td style={{ color: due ? 'var(--adm-red)' : 'var(--adm-text-dim)' }}>
                        {s.lastChecked ? String(s.lastChecked).slice(0, 10) : 'hiç'}{due ? ' · zamanı geldi' : ''}
                      </td>
                      <td>{memberName(s.ownerId)}</td>
                    </>)}
                    <td style={{ textAlign: 'right' }}>{r.total}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.replyRate == null ? '—' : `%${r.replyRate}`}
                      {advanced && stale[s.source] && (
                        <button className="hub-pill hub-pill--flag" style={{ marginLeft: 6, cursor: 'pointer', border: 'none' }}
                          onClick={() => pause(s.source)} title="8 haftadır cevap/işe alım yok — duraklatmayı öner">
                          pasifleştir öner
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: r.hired > 0 ? 700 : 400 }}>{r.hired}</td>
                    <td><span className="hub-pill">{STATUS_OPTS.find((o) => o.value === s.status)?.label}</span></td>
                    {canWrite && (
                      <td>
                        <div className="adm-table__actions">
                          {advanced && <button className="adm-icon-btn" title="Kontrol edildi işaretle" onClick={() => markChecked(s)}><AIcon name="check" size={14} /></button>}
                          <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(s)}><AIcon name="edit" size={14} /></button>
                          <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(s)}><AIcon name="trash" size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Kaynağı düzenle' : 'Yeni kaynak'}>
        {editing && (
          <div>
            <Field label="Ad" required hint="Spesifik: “Teknofest 2026 ulaşım kategorisi”"><Input value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} /></Field>
            <Field label="URL"><Input value={editing.url} onChange={(v) => setEditing({ ...editing, url: v })} placeholder="https://…" /></Field>
            {advanced ? (<>
              <div className="adm-form-grid">
                <Field label="Tip"><Select value={editing.source} onChange={(v) => setEditing({ ...editing, source: v })} options={SOURCES} /></Field>
                <Field label="Kontrol sıklığı"><Select value={editing.checkEvery} onChange={(v) => setEditing({ ...editing, checkEvery: v })} options={CHECK_OPTS} /></Field>
                <Field label="Sorumlu"><Select value={editing.ownerId || ''} onChange={(v) => setEditing({ ...editing, ownerId: v })} options={members.map((m) => ({ value: m.id, label: m.fullName || m.email }))} placeholder="—" /></Field>
                <Field label="Durum"><Select value={editing.status} onChange={(v) => setEditing({ ...editing, status: v })} options={STATUS_OPTS} /></Field>
              </div>
              <Field label="Not"><Input value={editing.note} onChange={(v) => setEditing({ ...editing, note: v })} /></Field>
            </>) : (
              <Field label="Tip"><Select value={editing.source} onChange={(v) => setEditing({ ...editing, source: v })} options={SOURCES} /></Field>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={save}>Kaydet</button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { store.deleteItem('sources', confirm.id).then(() => setConfirm(null)); }}
        title="Kaynağı sil?" message={confirm?.name} />
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}

export default function SourcesPage() {
  return <SourceRegistry />;
}
