// templates.jsx — Şablonlar (§8.5). Kaynak tipine göre metinler,
// {{ad}} {{kanıt}} {{proje}} değişkenleri, A/B varyant, varyant başına
// cevap oranı. Ret ve davet metinleri de burada. CRUD yalnızca cofounder.
//
// Mesaj gönderme akışının kendisi aday kartındadır (§8.5b) — burası
// yalnızca metinlerin yönetimi ve performansı.
import React, { useState, useMemo } from 'react';
import { AIcon, Modal, Field, Input, Textarea, Select, ConfirmDialog } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import { SOURCES } from '../hub-constants';

export const TEMPLATE_TYPES = [
  { value: '', label: 'Genel' },
  ...SOURCES.map((s) => ({ value: s.value, label: s.label })),
  { value: 'reject', label: 'Ret' },
  { value: 'invite', label: 'Davet' },
];
const typeLabel = (v) => TEMPLATE_TYPES.find((t) => t.value === (v || ''))?.label || v;

const VAR_RE = /\{\{\s*([\wğüşıöçĞÜŞİÖÇ]+)\s*\}\}/g;
export function templateVars(body) {
  const out = new Set();
  let m;
  while ((m = VAR_RE.exec(body || ''))) out.add(m[1]);
  return [...out];
}
// {{ad}} → fullName · {{kanıt}} → whyThisOne · {{proje}} → extra.project
export function fillTemplate(body, candidate, extra = {}) {
  const map = {
    ad: candidate?.fullName || '',
    kanıt: candidate?.whyThisOne || '',
    kanit: candidate?.whyThisOne || '',
    proje: extra.project || '',
  };
  return (body || '').replace(VAR_RE, (_, k) => (k in map ? map[k] : `{{${k}}}`));
}

const rate = (t) => (t.sentCount ? Math.round((100 * (t.replyCount || 0)) / t.sentCount) : null);

const BLANK = { name: '', sourceType: '', subject: '', body: '', active: true };

export default function TemplatesPage() {
  const { templates, addItem, updateItem, deleteItem } = useHubStore();
  const { can } = usePerms();
  const canWrite = can('templates.manage');

  const [editing, setEditing] = useState(null); // {} (new) | row | null
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const groups = useMemo(() => {
    const g = new Map();
    [...templates].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .forEach((t) => {
        if (!g.has(t.name)) g.set(t.name, []);
        g.get(t.name).push(t);
      });
    return [...g.entries()];
  }, [templates]);

  const save = async () => {
    const t = editing;
    if (!t.name.trim() || !t.body.trim()) { flash('Ad ve gövde zorunlu.'); return; }
    const payload = { ...t, variables: templateVars(t.body) };
    try {
      if (t.id) await updateItem('templates', t.id, payload);
      else await addItem('templates', payload);
      setEditing(null);
      flash('Şablon kaydedildi.');
    } catch (e) { flash('Kaydedilemedi: ' + e.message); }
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Şablonlar</h1>
          <p className="adm-page-head__desc">
            {templates.length} metin · gönderimi her zaman insan yapar, sistem yalnızca taslak üretir
          </p>
        </div>
        {canWrite && (
          <div className="adm-page-head__actions">
            <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setEditing({ ...BLANK })}>
              <AIcon name="edit" size={14} /> Yeni şablon
            </button>
          </div>
        )}
      </div>

      {!canWrite && (
        <div className="hub-ai" style={{ marginBottom: 12 }}>
          Şablon düzenleme yalnızca <b>kurucu</b> rolünde açık. Metinleri görüntüleyebilirsin.
        </div>
      )}

      {groups.length === 0 && <div className="adm-empty">İlk şablonunu ekle — sağ üstteki “Yeni şablon”.</div>}

      {groups.map(([name, variants]) => (
        <div key={name} className="adm-card" style={{ marginBottom: 12 }}>
          <div className="adm-card__header">
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', fontSize: 14 }}>{name}</span>
            <span className="hub-pill hub-pill--source">{typeLabel(variants[0].sourceType)}</span>
          </div>
          <table className="adm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Konu</th>
                <th style={{ width: 80 }}>Gönderim</th>
                <th style={{ width: 80 }}>Cevap</th>
                <th style={{ width: 110 }}>Cevap oranı</th>
                <th style={{ width: 60 }}>Aktif</th>
                {canWrite && <th style={{ width: 90 }}></th>}
              </tr>
            </thead>
            <tbody>
              {variants.map((t) => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--adm-text-secondary)' }}>{t.subject || <span style={{ color: 'var(--adm-text-dim)' }}>—</span>}</td>
                  <td>{t.sentCount || 0}</td>
                  <td>{t.replyCount || 0}</td>
                  <td>
                    {rate(t) == null ? <span style={{ color: 'var(--adm-text-dim)' }}>—</span>
                      : <strong style={{ color: rate(t) >= 20 ? 'var(--adm-green)' : 'var(--adm-text)' }}>%{rate(t)}</strong>}
                  </td>
                  <td>{t.active ? '✓' : '—'}</td>
                  {canWrite && (
                    <td>
                      <div className="adm-table__actions">
                        <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(t)}><AIcon name="edit" size={14} /></button>
                        <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(t)}><AIcon name="trash" size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Şablonu düzenle' : 'Yeni şablon'}>
        {editing && (
          <div>
            <div className="adm-form-grid">
              <Field label="Ad" required><Input value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} placeholder="Hackathon ilk temas" /></Field>
              <Field label="Tür"><Select value={editing.sourceType || ''} onChange={(v) => setEditing({ ...editing, sourceType: v })} options={TEMPLATE_TYPES} /></Field>
              <Field label="Aktif"><Select value={editing.active ? '1' : '0'} onChange={(v) => setEditing({ ...editing, active: v === '1' })} options={[{ value: '1', label: 'Evet' }, { value: '0', label: 'Hayır' }]} /></Field>
            </div>
            <Field label="Konu (e-posta için)"><Input value={editing.subject || ''} onChange={(v) => setEditing({ ...editing, subject: v })} /></Field>
            <Field label="Gövde" required hint="Değişkenler: {{ad}} · {{kanıt}} · {{proje}}. Kişiselleştirme satırı burada DEĞİL — kopyalama anında aday kartında ayrı alanda yazılır.">
              <Textarea value={editing.body} onChange={(v) => setEditing({ ...editing, body: v })} rows={8} />
            </Field>
            <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
              Bulunan değişkenler: {templateVars(editing.body).map((v) => `{{${v}}}`).join(' ') || '—'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={save}>Kaydet</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { deleteItem('templates', confirm.id).then(() => { setConfirm(null); flash('Şablon silindi.'); }); }}
        title="Şablonu sil?" message={`“${confirm?.name}” kalıcı olarak silinecek.`} />

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
