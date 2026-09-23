// join-form-fields.jsx — HR › Ayarlar › "Katılım Formu Metinleri"
// Sitedeki Katıl formundaki ilgi alanı seçenekleri + birkaç temel alan etiketini
// HR'dan düzenlemek için basit, sade bir alan (2026-09-23 — admin panele gitmeden
// buradan da değiştirilebilsin istendi). join_form_settings tablosunu (id=1) admin
// panelle PAYLAŞIR: field_labels/interest_labels JSON'ları önce tam olarak okunur,
// yalnızca buradaki anahtarlar değiştirilip geri yazılır — admin panelin ayarladığı
// diğer anahtarlara (m_*, s_*, kart başlıkları…) dokunulmaz.
import React, { useState, useEffect } from 'react';
import { Field, Input } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { usePerms } from '../../lib/use-perms';

// Site tarafındaki JOIN_INTERESTS (other-pages.jsx) ile aynı anahtar+varsayılan TR
// metin — ayrı tutuldu ki HR paketi (bundle) site sayfası kodunu (layout/blog vb.)
// içine çekmesin. Anahtarlar (`value`) hub_candidates.interest ile birebir aynı
// olmalı; TR metin yalnızca görünüm, değişirse iki yerde de güncellenir.
const JOIN_INTERESTS = [
  { key: 'frontend',  tr: 'Frontend' },
  { key: 'backend',   tr: 'Backend' },
  { key: 'mobile',    tr: 'Mobil Uygulama' },
  { key: 'data',      tr: 'Veri & Yapay Zekâ' },
  { key: 'design',    tr: 'UI/UX Tasarım' },
  { key: 'product',   tr: 'Ürün & Proje Yönetimi' },
  { key: 'marketing', tr: 'Pazarlama & Growth' },
  { key: 'business',  tr: 'İş Geliştirme' },
  { key: 'content',   tr: 'İçerik & Yazı' },
  { key: 'other',     tr: 'Diğer' },
];

const BASIC_FIELDS = [
  { key: 'c_role', label: 'İlgi alanı sorusu', fallback: 'Hangi alanda yer almak istersin?' },
  { key: 'c_name', label: 'Ad Soyad etiketi', fallback: 'Ad Soyad' },
  { key: 'c_email', label: 'E-posta etiketi', fallback: 'E-posta' },
  { key: 'c_university', label: 'Üniversite etiketi', fallback: 'Üniversite' },
  { key: 'c_department', label: 'Bölüm etiketi', fallback: 'Bölüm' },
];

export default function JoinFormFields() {
  const { can } = usePerms();
  const [fieldLabels, setFieldLabels] = useState({});
  const [interestLabels, setInterestLabels] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from('join_form_settings').select('field_labels, interest_labels').eq('id', 1).single()
      .then(({ data }) => {
        if (data) {
          setFieldLabels(data.field_labels && typeof data.field_labels === 'object' ? data.field_labels : {});
          setInterestLabels(data.interest_labels && typeof data.interest_labels === 'object' ? data.interest_labels : {});
        }
        setLoaded(true);
      }).catch(() => setLoaded(true));
  }, []);

  if (!can('settings.write') || !loaded) return null;

  const setField = (key, v) => setFieldLabels((p) => ({ ...p, [key]: v }));
  const setInterest = (key, v) => setInterestLabels((p) => ({ ...p, [key]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('join_form_settings').upsert({
      id: 1, field_labels: fieldLabels, interest_labels: interestLabels, updated_at: new Date().toISOString(),
    });
    setBusy(false);
    setMsg(error ? { text: 'Kaydedilemedi: ' + error.message, err: true } : { text: 'Kaydedildi.' });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <h3 className="hub-h4">Katılım Formu Metinleri</h3>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '6px 0 12px', maxWidth: 640 }}>
        Sitedeki "Katıl" sayfasında ilgi alanı seçenekleri ve birkaç temel alan etiketi — boş bırakılan
        her şey mevcut varsayılan metniyle görünmeye devam eder, hiçbir şey silinmiş olmaz.
      </p>
      <div className="adm-card">
        <div className="adm-card__body">
          <div className="adm-form-grid">
            {BASIC_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input value={fieldLabels[f.key] ?? ''} onChange={(v) => setField(f.key, v)} placeholder={f.fallback} />
              </Field>
            ))}
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, margin: '18px 0 8px' }}>İlgi alanı seçenekleri</div>
          <div className="adm-form-grid">
            {JOIN_INTERESTS.map((o) => (
              <Field key={o.key} label={o.tr}>
                <Input value={interestLabels[o.key] ?? ''} onChange={(v) => setInterest(o.key, v)} placeholder={o.tr} />
              </Field>
            ))}
          </div>

          <button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 14 }} disabled={busy} onClick={save}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          {msg && (
            <div style={{ marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.err ? '#FEF2F2' : '#F0FDF4', color: msg.err ? '#DC2626' : '#16A34A' }}>{msg.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
