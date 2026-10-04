// gate-templates.jsx — HR › Şablonlar › "Kapı A görevleri" (0053).
// Start-Hub önceden doldurur; Kapı A'yı atayan (HR, Adım 4'ten sonra Team
// App'teki kurucu) bu listeden SEÇER. Okuma: templates.read, düzenleme:
// templates.manage. Kullanımdan kalkan şablon silinmek yerine pasifleştirilir
// (geçmiş kapılar template_id ile ona bağlı kalabilir — silinse de kayıt
// task_text'te durur, bağlantı null olur).
import React, { useMemo, useState } from 'react';
import { AIcon, Modal, Field, Input, Textarea, Select, ConfirmDialog } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import {
  GATE_TEMPLATE_CATEGORIES, GATE_CATEGORY_LABEL, DELIVERY_TYPES, DELIVERY_LABEL,
  DURATION_DAY_OPTIONS, validateGateTemplate,
} from '../gate-templates';

const BLANK = { category: 'frontend', title: '', description: '', durationHours: 72, deliveryType: 'link', sortOrder: 0, active: true };

export default function GateTemplatesSection({ flash }) {
  const { gateTemplates = [], gates = [], addItem, updateItem, deleteItem } = useHubStore();
  const { can } = usePerms();
  const canWrite = can('templates.manage');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const usage = useMemo(() => {
    const m = {};
    for (const g of gates) if (g.templateId) m[g.templateId] = (m[g.templateId] || 0) + 1;
    return m;
  }, [gates]);

  const groups = useMemo(() => GATE_TEMPLATE_CATEGORIES
    .map((c) => ({
      ...c,
      items: gateTemplates
        .filter((t) => t.category === c.value && (showInactive || t.active !== false))
        .sort((a, b) => (a.sortOrder - b.sortOrder) || a.title.localeCompare(b.title, 'tr')),
    }))
    .filter((g) => g.items.length > 0), [gateTemplates, showInactive]);

  const save = async () => {
    const errs = validateGateTemplate(editing);
    if (errs.length) { flash(errs[0]); return; }
    try {
      if (editing.id) await updateItem('gateTemplates', editing.id, editing);
      else await addItem('gateTemplates', editing);
      setEditing(null);
      flash('Kapı A şablonu kaydedildi.');
    } catch (e) { flash('Kaydedilemedi: ' + e.message); }
  };

  const toggleActive = async (t) => {
    try {
      await updateItem('gateTemplates', t.id, { ...t, active: !t.active });
      flash(t.active ? 'Şablon pasifleştirildi.' : 'Şablon yeniden aktif.');
    } catch (e) { flash('Değiştirilemedi: ' + e.message); }
  };

  const inactiveCount = gateTemplates.filter((t) => t.active === false).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--adm-text-secondary)', minWidth: 240 }}>
          Kapı A'yı atayan yazmaz, bu listeden <b>seçer</b>; açıklamayı değiştirmek isteğe bağlıdır. Görev gerçek projeye ait,
          küçük ve tek çıktılı olmalı — yapay bir test değil.
        </div>
        {inactiveCount > 0 && (
          <button type="button" className={`adm-chip ${showInactive ? 'adm-chip--active' : ''}`} onClick={() => setShowInactive((v) => !v)}>
            Pasifleri göster ({inactiveCount})
          </button>
        )}
        {canWrite && (
          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setEditing({ ...BLANK })}>
            <AIcon name="plus" size={14} /> Yeni Kapı A görevi
          </button>
        )}
      </div>

      {groups.length === 0 && <div className="adm-empty">Henüz Kapı A şablonu yok.</div>}

      {groups.map((g) => (
        <div key={g.value} className="adm-card" style={{ marginBottom: 12 }}>
          <div className="adm-card__header">
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', fontSize: 14 }}>{g.label}</span>
            <span className="hub-pill">{g.items.length} görev</span>
          </div>
          <div className="adm-card__body" style={{ display: 'grid', gap: 10 }}>
            {g.items.map((t) => (
              <div key={t.id} style={{ border: '1px solid var(--adm-border)', borderRadius: 10, padding: '10px 12px', opacity: t.active === false ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{t.title} {t.active === false && <span className="hub-pill">Pasif</span>}</div>
                    <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', marginTop: 3, whiteSpace: 'pre-wrap' }}>{t.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 6 }}>
                      {Math.round(t.durationHours / 24)} gün · teslim: {DELIVERY_LABEL[t.deliveryType]}
                      {usage[t.id] ? ` · ${usage[t.id]} kez kullanıldı` : ''}
                    </div>
                  </div>
                  {canWrite && (
                    <div className="adm-table__actions">
                      <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(t)}><AIcon name="edit" size={14} /></button>
                      <button className="adm-icon-btn" title={t.active === false ? 'Aktif et' : 'Pasifleştir'} onClick={() => toggleActive(t)}>
                        <AIcon name={t.active === false ? 'check' : 'pause'} size={14} />
                      </button>
                      {!usage[t.id] && (
                        <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(t)}><AIcon name="trash" size={14} /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Kapı A görevini düzenle' : 'Yeni Kapı A görevi'}>
        {editing && (
          <div>
            <div className="adm-form-grid">
              <Field label="Kategori" required>
                <Select value={editing.category} onChange={(v) => setEditing({ ...editing, category: v })} options={GATE_TEMPLATE_CATEGORIES} />
              </Field>
              <Field label="Süre" required>
                <Select value={String(Math.round(editing.durationHours / 24))} onChange={(v) => setEditing({ ...editing, durationHours: Number(v) * 24 })} options={DURATION_DAY_OPTIONS} />
              </Field>
              <Field label="Teslim türü" required>
                <Select value={editing.deliveryType} onChange={(v) => setEditing({ ...editing, deliveryType: v })} options={DELIVERY_TYPES} />
              </Field>
            </div>
            <Field label="Başlık" required><Input value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} placeholder="Tek ekranlı prototip" /></Field>
            <Field label="Açıklama" required hint="Adaya giden görev tanımı + teslim formatı.">
              <Textarea value={editing.description} onChange={(v) => setEditing({ ...editing, description: v })} rows={6} />
            </Field>
            <Field label="Sıra" hint="Aynı kategoride küçük sayı önce (varsayılan öneri ilk sıradaki).">
              <Input type="number" value={editing.sortOrder} onChange={(v) => setEditing({ ...editing, sortOrder: v })} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={save}>Kaydet</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => {
          deleteItem('gateTemplates', confirm.id)
            .then(() => { setConfirm(null); flash('Şablon silindi.'); })
            .catch((e) => { setConfirm(null); flash('Silinemedi: ' + e.message); });
        }}
        title="Kapı A şablonunu sil?" message={`“${confirm?.title}” hiç kullanılmadı; kalıcı olarak silinecek.`} />
    </div>
  );
}
